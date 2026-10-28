// 3D zemljevid: vrteči se svet s potokom Grosupeljščica, hišicami (stopnjami) in Doro na čolnu.
// Uporablja three.js r128 s CDN. Če WebGL ali three.js ni na voljo, aplikacija pokaže 2D zemljevid.
//
// Svet je valj, ki leži vodoravno (os X). Stopnje so razporejene po kotu okoli osi;
// ko svet zavrtiš, naslednje stopnje pridejo izza obzorja.

const Svet3D = (() => {
  const R = 60;           // polmer sveta
  const KORAK = 0.095;    // kot med stopnjama
  const SIRINA = 4.2;     // širina potoka
  const ODMIK_HISE = SIRINA / 2 + 2.6;

  const podprt = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.THREE && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (_) { return false; }
  })();

  let ovoj, renderer, scene, camera, svet, tla, vodaMat, kanu, veslo, sonce;
  let oznake = [], zastavica;
  let n = 0, odklenjeno = 1, zvezdice = {}, onStopnja = () => {};
  let kot = 0, ciljKot = 0, hitrost = 0, tece = false, zankaTece = false, zadnji = 0, cas = 0;
  let kanuKot = 0, kanuOd = 0, kanuDo = 0;
  // Potovanje čolna po zmagi: t < 0 čaka, 0..TRAJANJE pluje, nato odklep
  const TRAJANJE = 3.4;
  let potovanje = null, prikazano = 1, onOdklep = () => {}, odklep = null, razdalja = 40;
  let liki = [], delci = [], teksturaKroga, teksturaZvezde, napisPlatno, napisTekstura, brazdaCas = 0;
  let vlece = false, zacY = 0, zacKot = 0, zadnjiY = 0, premaknil = 0;

  const kotStopnje = st => st * KORAK; // 0 = dom, 1..n = stopnje, n+1 = zastavica
  const xNa = th => 3.5 * Math.sin(th * 9.5);
  const stranHise = st => (st % 2 ? 1 : -1);

  // ---------- Geometrija na površju valja ----------

  function tocka(th, x, r = R) { return new THREE.Vector3(x, r * Math.cos(th), -r * Math.sin(th)); }
  function normala(th) { return new THREE.Vector3(0, Math.cos(th), -Math.sin(th)); }

  function postavi(obj, th, x, r = R) {
    obj.position.copy(tocka(th, x, r));
    const Y = normala(th);
    const Z = new THREE.Vector3(0, Math.sin(th), Math.cos(th));
    const X = new THREE.Vector3().crossVectors(Y, Z);
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  }

  // Postavi predmet na potok, obrnjen v smeri toka
  function postaviNaPotok(obj, th, r) {
    const e = 0.001;
    const c = tocka(th, xNa(th), r);
    const Y = normala(th);
    const T = tocka(th + e, xNa(th + e), r).sub(tocka(th - e, xNa(th - e), r)).normalize();
    const Z = T.negate();
    const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
    Z.crossVectors(X, Y).normalize();
    obj.position.copy(c);
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  }

  // Trak vzdolž potoka (voda, breg)
  function trak(sirina, r, od, doKota, korakov) {
    const poz = [], uv = [], ind = [];
    let dolzina = 0, prej = null;
    for (let i = 0; i <= korakov; i++) {
      const th = od + (doKota - od) * i / korakov;
      const c = tocka(th, xNa(th), r);
      if (prej) dolzina += c.distanceTo(prej);
      prej = c.clone();
      const t = tocka(th + 0.0005, xNa(th + 0.0005), r).sub(tocka(th - 0.0005, xNa(th - 0.0005), r)).normalize();
      const s = new THREE.Vector3().crossVectors(t, normala(th)).normalize().multiplyScalar(sirina / 2);
      const L = c.clone().sub(s), D = c.clone().add(s);
      poz.push(L.x, L.y, L.z, D.x, D.y, D.z);
      uv.push(0, dolzina / sirina, 1, dolzina / sirina);
      if (i < korakov) { const a = i * 2; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind);
    g.computeVertexNormals();
    return g;
  }

  // ---------- Teksture iz emojijev in napisov ----------

  function teksturaLika(e, velikost = 128) {
    if (e.slika) return new THREE.TextureLoader().load(e.slika);
    const c = document.createElement('canvas');
    c.width = c.height = velikost;
    const g = c.getContext('2d');
    g.font = `${velikost * 0.78}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e.emoji || e.ime, velikost / 2, velikost * 0.56);
    return new THREE.CanvasTexture(c);
  }

  function lik(e, velikost) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: teksturaLika(e), transparent: true }));
    s.scale.set(velikost, velikost, 1);
    return s;
  }

  function narisiOznako(c, st) {
    const g = c.getContext('2d');
    const zaklenjena = st > prikazano;
    const zv = zvezdice[st] || 0;
    g.clearRect(0, 0, c.width, c.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    if (zaklenjena) {
      g.font = '70px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      g.fillText('🔒', 128, 110);
    } else {
      g.font = '800 110px "Baloo 2", system-ui, sans-serif';
      g.lineWidth = 16;
      g.strokeStyle = '#7a1f45';
      g.strokeText(st, 128, 105);
      g.fillStyle = '#fff';
      g.fillText(st, 128, 105);
      g.font = '58px system-ui, sans-serif';
      for (let k = 0; k < 3; k++) {
        const x = 68 + k * 60;
        g.lineWidth = 8;
        g.strokeStyle = '#7a4a00';
        g.strokeText('★', x, 200);
        g.fillStyle = k < zv ? '#ffd23f' : 'rgba(255,255,255,.55)';
        g.fillText('★', x, 200);
      }
    }
  }

  // ---------- Napis reke: diskretno na vodi, v smeri toka ----------

  function narisiNapisReke() {
    const g = napisPlatno.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, napisPlatno.width, napisPlatno.height);
    g.translate(napisPlatno.width / 2, napisPlatno.height / 2);
    g.rotate(-Math.PI / 2);
    g.font = '800 84px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const sirina = g.measureText('Grosupeljščica').width;
    const meja = napisPlatno.height * 0.94;
    if (sirina > meja) g.scale(meja / sirina, 1);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillText('Grosupeljščica', 0, 4);
    napisTekstura.needsUpdate = true;
  }

  function napisReke(od, doKota) {
    napisPlatno = document.createElement('canvas');
    napisPlatno.width = 128;
    napisPlatno.height = 1024;
    napisTekstura = new THREE.CanvasTexture(napisPlatno);
    const geo = trak(SIRINA * 0.6, R + 0.1, od, doKota, 60);
    const uv = geo.attributes.uv, dolzina = uv.getY(uv.count - 1);
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) / dolzina);
    svet.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: napisTekstura, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
    narisiNapisReke();
  }

  // ---------- Delci: konfeti, iskre, brazda za čolnom ----------

  function teksture() {
    const krog = document.createElement('canvas');
    krog.width = krog.height = 64;
    let g = krog.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    teksturaKroga = new THREE.CanvasTexture(krog);
    const zv = document.createElement('canvas');
    zv.width = zv.height = 64;
    g = zv.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 13 : 30, k = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(32 + r * Math.cos(k), 32 + r * Math.sin(k));
    }
    g.fill();
    teksturaZvezde = new THREE.CanvasTexture(zv);
  }

  // th, x, r: kje; barve; koliko; moc: hitrost razleta
  function razpok(th, x, r, barve, koliko, moc = 1, zvezde = false) {
    const n0 = normala(th);
    for (let i = 0; i < koliko; i++) {
      const m = new THREE.SpriteMaterial({ map: zvezde && i % 2 ? teksturaZvezde : teksturaKroga, color: barve[i % barve.length], transparent: true, depthWrite: false });
      const s = new THREE.Sprite(m);
      const v = (0.35 + Math.random() * 0.5) * (zvezde ? 1.3 : 1);
      s.scale.set(v, v, 1);
      s.position.copy(tocka(th, x, r));
      const smer = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).multiplyScalar(4 * moc);
      const hitrostD = n0.clone().multiplyScalar((5 + Math.random() * 6) * moc).add(smer);
      svet.add(s);
      delci.push({ s, v: hitrostD, g: n0, zivi: 1.4 + Math.random() * 0.4, cas: 0, teza: 11, rast: 0 });
    }
  }

  function brazda(th) {
    const za = th - 0.022;
    for (const stran of [-1, 1]) {
      const m = new THREE.SpriteMaterial({ map: teksturaKroga, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
      const s = new THREE.Sprite(m);
      s.scale.set(0.5, 0.5, 1);
      s.position.copy(tocka(za, xNa(za) + stran * 0.45, R + 0.2));
      const v = new THREE.Vector3(stran * (0.8 + Math.random() * 0.6), 0, 0);
      svet.add(s);
      delci.push({ s, v, g: normala(za), zivi: 1.1, cas: 0, teza: 0, rast: 1.2 });
    }
  }

  function posodobiDelce(dt) {
    delci = delci.filter(d => {
      d.cas += dt;
      if (d.cas >= d.zivi) {
        svet.remove(d.s);
        d.s.material.dispose();
        return false;
      }
      if (d.teza) d.v.addScaledVector(d.g, -d.teza * dt);
      d.v.multiplyScalar(1 - dt * 0.8);
      d.s.position.addScaledVector(d.v, dt);
      if (d.rast) { const k = d.s.scale.x + d.rast * dt; d.s.scale.set(k, k, 1); }
      d.s.material.opacity = Math.min(1, 2.2 * (1 - d.cas / d.zivi));
      d.s.material.rotation += dt * 3;
      return true;
    });
  }

  // ---------- Gradnja sveta ----------

  function mat(barva, opcije = {}) { return new THREE.MeshLambertMaterial({ color: barva, ...opcije }); }

  function hisa(barvaSten, barvaStrehe, velikost = 1) {
    const g = new THREE.Group();
    const stene = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 2.2), mat(barvaSten));
    stene.position.y = 0.85;
    const streha = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.5, 4), mat(barvaStrehe));
    streha.position.y = 1.7 + 0.75;
    streha.rotation.y = Math.PI / 4;
    const vrata = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.06), mat(0x8b5a2b));
    vrata.position.set(0, 0.48, 1.11);
    const okno1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), mat(0xbfe9ff, { emissive: 0x334455 }));
    okno1.position.set(0.78, 1.05, 1.11);
    const okno2 = okno1.clone();
    okno2.position.x = -0.78;
    const dimnik = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), mat(0xa0522d));
    dimnik.position.set(0.6, 2.6, -0.3);
    [stene, streha, vrata, okno1, okno2, dimnik].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    g.scale.setScalar(velikost);
    return g;
  }

  function zgradiKanu() {
    const g = new THREE.Group();
    const trup = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0xe8590c, shininess: 60, side: THREE.DoubleSide })
    );
    trup.scale.set(0.75, 0.6, 1.9);
    trup.position.y = 0.32;
    trup.castShadow = true;
    const robGeo = new THREE.TorusGeometry(1, 0.07, 8, 40);
    robGeo.rotateX(Math.PI / 2);
    const rob = new THREE.Mesh(robGeo, new THREE.MeshPhongMaterial({ color: 0xffd23f, shininess: 80 }));
    rob.scale.set(0.75, 1, 1.9);
    rob.position.y = 0.32;
    const dora = lik(DORA, 2.2);
    dora.position.y = 1.35;
    veslo = new THREE.Group();
    const drog = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat(0x8b5a2b));
    const lopata = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.7), mat(0xffd23f));
    lopata.position.y = -1.2;
    lopata.rotation.x = Math.PI / 2;
    veslo.add(drog, lopata);
    veslo.position.set(0, 0.9, 0);
    veslo.rotation.z = 1.05;
    const dno = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
    dno.rotation.x = -Math.PI / 2;
    dno.scale.set(0.62, 1.7, 1);
    dno.position.y = 0.12;
    const klop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.35), mat(0xa0522d));
    klop.position.y = 0.3;
    g.add(trup, dno, klop, rob, dora, veslo);
    g.scale.setScalar(1.35);
    return g;
  }

  function instance(geo, material, matrike, barve) {
    const m = new THREE.InstancedMesh(geo, material, matrike.length);
    matrike.forEach((mx, i) => {
      m.setMatrixAt(i, mx);
      if (barve) m.setColorAt(i, barve[i]);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function zgradi() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd8f3ff, 45, 95);
    camera = new THREE.PerspectiveCamera(50, 1, 0.5, 300);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8a3a, 0.8));
    sonce = new THREE.DirectionalLight(0xfff0d0, 0.7);
    sonce.castShadow = true;
    sonce.shadow.mapSize.set(1024, 1024);
    Object.assign(sonce.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 120 });
    scene.add(sonce, sonce.target);

    svet = new THREE.Group();
    scene.add(svet);
    const konec = kotStopnje(n + 1);

    // Tla: travnik z odtenki
    const tlaGeo = new THREE.CylinderGeometry(R, R, 160, 240, 60, true);
    tlaGeo.rotateZ(Math.PI / 2);
    const p = tlaGeo.attributes.position;
    const barve = [];
    const svetla = new THREE.Color(0x8fd15a), temna = new THREE.Color(0x4fa63a), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), th = Math.atan2(-p.getZ(i), p.getY(i));
      const v = 0.5 + 0.25 * Math.sin(x * 0.45 + th * 37) + 0.25 * Math.sin(th * 71 - x * 0.3);
      c.copy(temna).lerp(svetla, v);
      barve.push(c.r, c.g, c.b);
    }
    tlaGeo.setAttribute('color', new THREE.Float32BufferAttribute(barve, 3));
    tla = new THREE.Mesh(tlaGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    tla.receiveShadow = true;
    svet.add(tla);

    // Breg in voda
    const od = -0.4, doKota = konec + 0.6;
    const breg = new THREE.Mesh(trak(SIRINA + 2.4, R + 0.03, od, doKota, 700), mat(0xe8d39a, { side: THREE.DoubleSide }));
    breg.receiveShadow = true;
    svet.add(breg);
    const blato = new THREE.Mesh(trak(SIRINA + 0.6, R + 0.05, od, doKota, 700), mat(0xb89a64, { side: THREE.DoubleSide }));
    svet.add(blato);

    vodaMat = new THREE.ShaderMaterial({
      uniforms: { uCas: { value: 0 } },
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uCas;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        void main() {
          float preko = abs(vUv.x - 0.5) * 2.0;
          vec2 tok = vec2(vUv.x * 3.0, vUv.y * 2.0 + uCas * 0.55);
          float n = noise(tok * vec2(1.5, 2.5)) * 0.6 + noise(tok * vec2(4.0, 7.0) + 7.0) * 0.4;
          vec3 globoko = vec3(0.05, 0.42, 0.66), plitvo = vec3(0.30, 0.80, 0.86);
          vec3 barva = mix(globoko, plitvo, smoothstep(0.15, 1.0, preko) * 0.85 + (n - 0.5) * 0.3);
          float valovi = smoothstep(0.6, 0.72, noise(vec2(vUv.x * 7.0, vUv.y * 5.0 + uCas * 0.9)));
          barva += valovi * 0.16;
          float pena = smoothstep(0.80, 0.97, preko + (n - 0.5) * 0.3);
          barva = mix(barva, vec3(0.95, 0.99, 1.0), pena * 0.9);
          float iskra = step(0.992, hash(floor(vec2(vUv.x * 30.0, vUv.y * 40.0 + uCas * 5.0)))) * (1.0 - preko);
          barva += iskra * 0.7;
          gl_FragColor = vec4(barva, 1.0);
        }`,
    });
    svet.add(new THREE.Mesh(trak(SIRINA, R + 0.08, od, doKota, 700), vodaMat));

    // Hišice in liki
    const proste = []; // mesta, kjer ne sme rasti drevo
    const dom = hisa(0xfff1d6, 0xd9480f, 1.3);
    const xDom = xNa(0) - ODMIK_HISE - 0.6;
    postavi(dom, 0.005, xDom);
    svet.add(dom);
    proste.push([0, xDom]);
    liki = [];
    let stLika = 0;
    const dodajLik = (e, velikost, th, x, r) => {
      const s = lik(e, velikost);
      s.position.copy(tocka(th, x, r));
      svet.add(s);
      liki.push({ s, baza: s.position.clone(), n: normala(th), faza: Math.random() * 20, v: velikost });
    };
    dodajLik(MIRT, 3.4, -0.035, xDom + 2.6, R + 1.6);
    napisReke(-0.125, 0.02);

    const barveSten = [0xffe5ec, 0xfff3b0, 0xd8f3dc, 0xe0f0ff, 0xffe8cc, 0xf3e5ff];
    const barveStreh = [0xc9184a, 0x3a86ff, 0x8338ec, 0xfb5607, 0x2a9d8f, 0xe76f51];
    oznake = [];
    for (let st = 1; st <= n; st++) {
      const th = kotStopnje(st);
      const xH = xNa(th) + stranHise(st) * ODMIK_HISE;
      const h = hisa(barveSten[st % 6], barveStreh[st % 6]);
      postavi(h, th + 0.01, xH);
      svet.add(h);
      proste.push([th, xH]);

      // Ob vsaki hišici Mirt ali Tupko v svoji situaciji, med lihimi hišicami še en
      dodajLik(LIKI_OB_POTI[stLika++ % LIKI_OB_POTI.length], 3.2, th - 0.035, xH - stranHise(st) * 1.2, R + 1.5);
      if (st % 2 && st < n) {
        const thM = th + KORAK / 2, xM = xNa(thM) + stranHise(st) * (SIRINA / 2 + 1.9);
        dodajLik(LIKI_OB_POTI[stLika++ % LIKI_OB_POTI.length], 2.9, thM, xM, R + 1.35);
        proste.push([thM, xM]);
      }

      // Plošček stopnje na vodi
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.4, 40), new THREE.MeshPhongMaterial({ shininess: 90 }));
      const obroc = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.13, 12, 40), new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 90 }));
      obroc.rotation.x = Math.PI / 2;
      obroc.position.y = 0.2;
      const plosk = new THREE.Group();
      plosk.add(disk, obroc);
      disk.castShadow = true;
      postavi(plosk, th, xNa(th), R + 0.2);
      svet.add(plosk);

      const platno = document.createElement('canvas');
      platno.width = platno.height = 256;
      const napis = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(platno), transparent: true }));
      napis.scale.set(3.6, 3.6, 1);
      napis.position.copy(tocka(th, xNa(th), R + 2.6));
      svet.add(napis);
      disk.userData.st = napis.userData.st = st;
      oznake.push({ st, disk, plosk, platno, napis });
    }

    // Zastavica na koncu
    zastavica = new THREE.Group();
    const drog = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), mat(0xffffff));
    drog.position.y = 2;
    const platno = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), mat(0xff3366, { side: THREE.DoubleSide }));
    platno.position.set(0.9, 3.4, 0);
    zastavica.add(drog, platno);
    postavi(zastavica, konec, xNa(konec) + 3.2);
    svet.add(zastavica);

    // Drevesa, grmi, kamni, lokvanji
    const dummy = new THREE.Object3D();
    const debla = [], krosnje = [], smreke = [], barveK = [], barveS = [], grmi = [], barveG = [], kamni = [], lokvanji = [];
    const prosto = (th, x) => Math.abs(x - xNa(th)) > SIRINA / 2 + 2 &&
      proste.every(([t, xx]) => Math.hypot((t - th) * R, xx - x) > 3.8);
    let poskusi = 0;
    while (debla.length < 320 && poskusi++ < 5000) {
      const th = od + Math.random() * (doKota - od), x = (Math.random() - 0.5) * 70;
      if (!prosto(th, x)) continue;
      postavi(dummy, th, x);
      dummy.scale.setScalar(0.8 + Math.random() * 0.7);
      dummy.updateMatrix();
      debla.push(dummy.matrix.clone());
      const zelena = new THREE.Color().setHSL(0.27 + Math.random() * 0.08, 0.55, 0.32 + Math.random() * 0.12);
      if (Math.random() < 0.55) { krosnje.push(dummy.matrix.clone()); barveK.push(zelena); }
      else { smreke.push(dummy.matrix.clone()); barveS.push(zelena.offsetHSL(0.03, 0, -0.08)); }
    }
    poskusi = 0;
    const cvetje = [0xff6b9a, 0xffd23f, 0xffffff, 0xb388ff, 0xff8c42];
    while (grmi.length < 260 && poskusi++ < 4000) {
      const th = od + Math.random() * (doKota - od), x = (Math.random() - 0.5) * 40;
      if (Math.abs(x - xNa(th)) < SIRINA / 2 + 1.4) continue;
      postavi(dummy, th, x);
      dummy.scale.setScalar(0.25 + Math.random() * 0.35);
      dummy.updateMatrix();
      grmi.push(dummy.matrix.clone());
      barveG.push(new THREE.Color(Math.random() < 0.5 ? 0x5bb544 : cvetje[Math.floor(Math.random() * cvetje.length)]));
    }
    for (let i = 0; i < 160; i++) {
      const th = od + Math.random() * (doKota - od);
      const s = Math.random() < 0.5 ? 1 : -1;
      postavi(dummy, th, xNa(th) + s * (SIRINA / 2 + 0.4 + Math.random() * 0.9), R + 0.05);
      dummy.scale.set(0.18 + Math.random() * 0.25, 0.12 + Math.random() * 0.15, 0.18 + Math.random() * 0.25);
      dummy.rotateY(Math.random() * 6);
      dummy.updateMatrix();
      kamni.push(dummy.matrix.clone());
    }
    for (let i = 0; i < 90; i++) {
      const th = od + Math.random() * (doKota - od);
      if (oznake.some(o => Math.abs(kotStopnje(o.st) - th) * R < 2.2)) continue;
      const s = Math.random() < 0.5 ? 1 : -1;
      postavi(dummy, th, xNa(th) + s * (0.7 + Math.random() * 1.1), R + 0.1);
      dummy.scale.setScalar(0.35 + Math.random() * 0.3);
      dummy.updateMatrix();
      lokvanji.push(dummy.matrix.clone());
    }
    const debloGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.2, 6).translate(0, 0.6, 0);
    const krosnjaGeo = new THREE.IcosahedronGeometry(1.15, 1).translate(0, 2.0, 0);
    const smrekaGeo = new THREE.ConeGeometry(1.0, 2.8, 7).translate(0, 2.4, 0);
    svet.add(instance(debloGeo, mat(0x8b5a2b), debla));
    if (krosnje.length) svet.add(instance(krosnjaGeo, mat(0xffffff), krosnje, barveK));
    if (smreke.length) svet.add(instance(smrekaGeo, mat(0xffffff), smreke, barveS));
    svet.add(instance(new THREE.IcosahedronGeometry(1, 0).translate(0, 0.6, 0), mat(0xffffff), grmi, barveG));
    svet.add(instance(new THREE.DodecahedronGeometry(1, 0), mat(0x9aa0a6), kamni));
    const lokvanj = instance(new THREE.CylinderGeometry(1, 1, 0.05, 14, 1, false, 0.3, Math.PI * 2 - 0.6), mat(0x3f9b3a), lokvanji);
    lokvanj.castShadow = false;
    svet.add(lokvanj);

    kanu = zgradiKanu();
    svet.add(kanu);
    teksture();
  }

  // ---------- Stanje ----------

  function osveziOznake() {
    oznake.forEach(o => {
      const barva = o.st > prikazano ? 0x7d8ca3 : o.st === prikazano ? 0xff4f8b : 0xffc23d;
      o.disk.material.color.setHex(barva);
      narisiOznako(o.platno, o.st);
      o.napis.material.map.needsUpdate = true;
    });
  }

  function postaviKanu(th) {
    postaviNaPotok(kanu, th, R + 0.08);
    const pluje = potovanje && potovanje.t >= 0 && potovanje.t < TRAJANJE;
    const nihaj = Math.sin(cas * (pluje ? 6 : 2.2));
    let poskok = 0;
    if (odklep && odklep.t < 0.6) poskok = Math.sin(odklep.t / 0.6 * Math.PI) * 0.9;
    kanu.position.addScaledVector(normala(th), nihaj * (pluje ? 0.12 : 0.06) + poskok);
    kanu.rotateZ(nihaj * (pluje ? 0.1 : 0.05));
    if (pluje) kanu.rotateX(-0.06);
    veslo.rotation.x = Math.sin(cas * (pluje ? 9 : 2)) * (pluje ? 0.9 : 0.6);
  }

  // ---------- Kamera in velikost ----------

  function velikost() {
    const w = ovoj.clientWidth, h = ovoj.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fovH = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    razdalja = THREE.MathUtils.clamp(8.5 / Math.tan(fovH / 2), 28, 70);
    postaviKamero(1);
    camera.updateProjectionMatrix();
    scene.fog.near = razdalja * 1.05;
    scene.fog.far = razdalja * 1.9;
    sonce.position.set(20, R + 50, 30);
    sonce.target.position.set(0, R, -5);
  }

  function postaviKamero(f) {
    const d = razdalja * f;
    const smer = new THREE.Vector3(0, 0.7, 0.71).normalize();
    camera.position.set(0, R, 0).addScaledVector(smer, d);
    camera.lookAt(0, R - 1, -d * 0.32);
  }

  // ---------- Vnos ----------

  function klik(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mis = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mis, camera);
    const zadetki = ray.intersectObjects([tla, ...oznake.map(o => o.disk), ...oznake.map(o => o.napis)]);
    const st = zadetki.length && zadetki[0].object.userData.st;
    if (st && st <= odklenjeno) onStopnja(st);
  }

  function priklopiVnos(platno) {
    platno.addEventListener('pointerdown', e => {
      if (potovanje) return;
      vlece = true;
      zacY = zadnjiY = e.clientY;
      zacKot = ciljKot;
      premaknil = 0;
      hitrost = 0;
      try { platno.setPointerCapture(e.pointerId); } catch (_) {}
    });
    platno.addEventListener('pointermove', e => {
      if (!vlece) return;
      const dy = e.clientY - zacY;
      premaknil = Math.max(premaknil, Math.abs(dy));
      ciljKot = zacKot + dy * 0.0016;
      hitrost = (e.clientY - zadnjiY) * 0.0016;
      zadnjiY = e.clientY;
    });
    platno.addEventListener('pointerup', e => {
      vlece = false;
      if (premaknil < 8) { hitrost = 0; klik(e); }
    });
    platno.addEventListener('pointercancel', () => { vlece = false; });
    platno.addEventListener('wheel', e => {
      e.preventDefault();
      ciljKot += e.deltaY * 0.0005;
    }, { passive: false });
    window.addEventListener('resize', () => tece && velikost());
  }

  // ---------- Zanka ----------

  function zanka(t) {
    if (!tece) { zankaTece = false; return; }
    requestAnimationFrame(zanka);
    const dt = Math.min(0.05, (t - zadnji) / 1000 || 0.016);
    zadnji = t;
    cas += dt;
    let zoom = 1;
    if (potovanje) {
      const prej = potovanje.t;
      potovanje.t += dt;
      const t = potovanje.t;
      if (prej < -0.5 && t >= -0.5) {
        // opravljena stopnja: zlate zvezdice nad ploščkom
        const th0 = kanuOd + 0.05;
        razpok(th0, xNa(th0), R + 1, [0xffd23f, 0xffe98a, 0xffffff], 26, 0.9, true);
        Zvok.zvezda(2);
      }
      if (prej < 0 && t >= 0) Zvok.pljusk();
      const k = THREE.MathUtils.clamp(t / TRAJANJE, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      kanuKot = kanuOd + (kanuDo - kanuOd) * e;
      ciljKot = kanuKot + 0.02 * Math.sin(k * Math.PI);
      zoom = 1 - 0.16 * Math.sin(k * Math.PI);
      if (t >= 0 && t < TRAJANJE) {
        brazdaCas += dt;
        if (brazdaCas > 0.07) { brazdaCas = 0; brazda(kanuKot); }
      }
      if (t >= TRAJANJE) {
        potovanje = null;
        prikazano = odklenjeno;
        osveziOznake();
        odklep = { t: 0, st: odklenjeno };
        const th1 = kotStopnje(odklenjeno);
        razpok(th1, xNa(th1), R + 1.2, [0xff4f8b, 0xffd23f, 0x19b5c9, 0xb388ff, 0x57cc99, 0xffffff], 70, 1.3, true);
        onOdklep(odklenjeno);
      }
    } else if (!vlece) {
      ciljKot += hitrost;
      hitrost *= 0.92;
    }
    ciljKot = THREE.MathUtils.clamp(ciljKot, 0, kotStopnje(n + 1));
    kot += (ciljKot - kot) * Math.min(1, dt * (potovanje ? 4 : 7));
    svet.rotation.x = kot;
    postaviKamero(zoom);
    posodobiDelce(dt);
    liki.forEach(l => {
      const skok = Math.pow(Math.max(0, Math.sin(cas * 1.7 + l.faza)), 12) * 0.7;
      l.s.position.copy(l.baza).addScaledVector(l.n, skok);
      const dih = 1 + Math.sin(cas * 3 + l.faza) * 0.03;
      l.s.scale.set(l.v / Math.sqrt(dih), l.v * dih, 1);
    });
    vodaMat.uniforms.uCas.value = cas;
    postaviKanu(kanuKot);
    if (odklep) odklep.t += dt;
    oznake.forEach(o => {
      let s = o.st === prikazano ? 1 + Math.sin(cas * 4) * 0.07 : 1;
      let velN = 3.6;
      if (odklep && o.st === odklep.st && odklep.t < 1.2) {
        // elastičen pok novega ploščka
        const t = odklep.t / 1.2;
        const el = 1 + Math.sin(t * Math.PI * 4) * Math.pow(1 - t, 2) * 0.7;
        s *= el;
        velN *= el;
      }
      o.plosk.scale.set(s, 1, s);
      o.napis.scale.set(velN, velN, 1);
    });
    if (odklep && odklep.t > 1.5) odklep = null;
    zastavica.children[1].rotation.y = Math.sin(cas * 3) * 0.25;
    renderer.render(scene, camera);
  }

  // ---------- Javno ----------

  // podatki: { stStopenj, odklenjeno, zvezdice, prejsnje, onStopnja }
  function prikazi(vsebnik, podatki) {
    ({ odklenjeno, zvezdice, onStopnja } = podatki);
    onOdklep = podatki.onOdklep || (() => {});
    if (!renderer) {
      ovoj = vsebnik;
      n = podatki.stStopenj;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      ovoj.appendChild(renderer.domElement);
      zgradi();
      priklopiVnos(renderer.domElement);
    }
    const cilj = kotStopnje(Math.min(odklenjeno, n)) - 0.05;
    if (podatki.prejsnje && podatki.prejsnje < odklenjeno) {
      kanuOd = kotStopnje(podatki.prejsnje) - 0.05;
      kanuDo = cilj;
      potovanje = { t: -0.9 };
      prikazano = podatki.prejsnje;
      kanuKot = kanuOd;
      kot = ciljKot = kanuOd;
    } else {
      potovanje = null;
      prikazano = odklenjeno;
      kanuKot = cilj;
      kot = ciljKot = cilj;
    }
    hitrost = 0;
    const narisi = () => { osveziOznake(); if (napisPlatno) narisiNapisReke(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(narisi);
    narisi();
    tece = true;
    velikost();
    zadnji = performance.now();
    // največ ena zanka hkrati, tudi če se zemljevid odpre večkrat zapored
    if (!zankaTece) { zankaTece = true; requestAnimationFrame(zanka); }
  }

  function ustavi() { tece = false; }

  return { podprt, prikazi, ustavi };
})();
