// Igralna plošča: menjava, iskanje trojk, Dorina bomba, padanje in polnjenje.
// Plosca.init(...) se pokliče enkrat, Plosca.zacni(...) ob vsaki stopnji.

const Plosca = (() => {
  const N = 8;
  const CAS = { menjava: 200, pok: 260, padec: 320, namig: 5000 };
  const TOCKE_NA_ELEMENT = 20;
  const KOMBO_BESEDILA = ['', '', 'Super!', 'Kraš!', 'Dora power!', 'Noro dobro!', 'Dorin kraš!'];
  const POHVALE = ['Super!', 'Bravo!', 'Odlično!', 'Wow!', 'Fantastično!', 'Na zdravje!', 'Sladko!'];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let el, ovoj, grid = [], stEl = 6, stanje = null, povratni = {};
  let izbrana = null, zacetek = null, zaseden = false, namigTimer = null, igraId = 0;
  let laserPremor = 0, prekiniLaser = null;
  const jeDora = tip => tip === 'dora' || tip === 'dora-laser';
  const opisTipa = tip => tip === 'dora-laser' ? DORA_LASER : tip === 'dora' ? DORA : ELEMENTI[tip];

  // ---------- Risanje ----------

  function vsebina(e) {
    if (e.slika) return `<img src="${e.slika}" alt="${e.ime}" draggable="false">`;
    if (e.emoji) return `<span class="ikona">${e.emoji}</span>`;
    return `<span class="napis">${e.ime}</span>`;
  }

  function narisi(t) {
    const e = opisTipa(t.tip);
    const id = jeDora(t.tip) ? t.tip : e.id;
    t.el.className = 'ploscica' + (jeDora(t.tip) ? ' dora' : '') + (t.tip === 'dora-laser' ? ' laserska' : '');
    t.el.innerHTML = `<div class="element el-${id}" style="--barva:${e.barva}">${vsebina(e)}</div>` +
      (jeDora(t.tip) ? `<span class="strela">${t.tip === 'dora-laser' ? '🌀' : '⚡'}</span>` : '');
    t.el.title = t.tip === 'dora-laser' ? `Laserska Dora: premakni jo za ${DORA_LASER.zadetki} naključnih zadetkov!` : '';
  }

  function ustvari(tip, r, c) {
    const t = { tip, el: document.createElement('div') };
    narisi(t);
    postavi(t, r, c);
    el.appendChild(t.el);
    return t;
  }

  function postavi(t, r, c) {
    t.el.style.transform = `translate(${c * 100}%, ${r * 100}%)`;
  }

  function nakljucen() { return Math.floor(Math.random() * stEl); }

  // ---------- Logika ----------

  function tipi() { return grid.map(vrsta => vrsta.map(t => (t ? t.tip : null))); }

  // Vrne skupine povezanih celic (vrste in stolpci 3+ enakih, ki se stikajo).
  function najdiSkupine(g) {
    const vrste = [];
    for (let r = 0; r < N; r++) {
      let c = 0;
      while (c < N) {
        const t = g[r][c];
        let k = c + 1;
        if (typeof t === 'number') {
          while (k < N && g[r][k] === t) k++;
          if (k - c >= 3) vrste.push(Array.from({ length: k - c }, (_, i) => r * N + c + i));
        }
        c = k;
      }
    }
    for (let c = 0; c < N; c++) {
      let r = 0;
      while (r < N) {
        const t = g[r][c];
        let k = r + 1;
        if (typeof t === 'number') {
          while (k < N && g[k][c] === t) k++;
          if (k - r >= 3) vrste.push(Array.from({ length: k - r }, (_, i) => (r + i) * N + c));
        }
        r = k;
      }
    }
    const stars = vrste.map((_, i) => i);
    const koren = i => (stars[i] === i ? i : (stars[i] = koren(stars[i])));
    const lastnik = new Map();
    vrste.forEach((vrsta, i) => vrsta.forEach(k => {
      if (lastnik.has(k)) stars[koren(i)] = koren(lastnik.get(k));
      else lastnik.set(k, i);
    }));
    const skupine = new Map();
    vrste.forEach((vrsta, i) => {
      const s = skupine.get(koren(i)) || new Set();
      vrsta.forEach(k => s.add(k));
      skupine.set(koren(i), s);
    });
    return [...skupine.values()].map(s => [...s]);
  }

  // Vrne eno možno potezo [[r,c],[r,c]] ali null.
  function najdiPotezo(g) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (jeDora(g[r][c])) return [[r, c], c + 1 < N ? [r, c + 1] : [r, c - 1]];
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= N || c2 >= N) continue;
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        const ok = najdiSkupine(g).length > 0;
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        if (ok) return [[r, c], [r2, c2]];
      }
    }
    return null;
  }

  function napolni() {
    let g;
    do {
      g = [];
      for (let r = 0; r < N; r++) {
        g[r] = [];
        for (let c = 0; c < N; c++) {
          let t;
          do t = nakljucen();
          while ((c >= 2 && g[r][c - 1] === t && g[r][c - 2] === t) ||
                 (r >= 2 && g[r - 1][c] === t && g[r - 2][c] === t));
          g[r][c] = t;
        }
      }
    } while (!najdiPotezo(g));
    el.querySelectorAll('.ploscica').forEach(x => x.remove());
    // ena Dorina bomba že na začetku, da igralec vidi, kaj je (ne ustvari trojke, ker ni število)
    const br = 2 + Math.floor(Math.random() * (N - 4)), bc = 2 + Math.floor(Math.random() * (N - 4));
    g[br][bc] = 'dora';
    grid = g.map((vrsta, r) => vrsta.map((tip, c) => ustvari(tip, r - N - 1, c)));
    void el.offsetWidth;
    grid.forEach((vrsta, r) => vrsta.forEach((t, c) => {
      t.el.style.transition = `transform .5s cubic-bezier(.34, 1.5, .64, 1) ${(N - 1 - r) * 55 + c * 30}ms`;
      postavi(t, r, c);
    }));
    setTimeout(() => grid.forEach(v => v.forEach(t => { if (t) t.el.style.transition = ''; })), 1100);
  }

  function zamenjajVMrezi(a, b) {
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
    postavi(grid[a.r][a.c], a.r, a.c);
    postavi(grid[b.r][b.c], b.r, b.c);
  }

  async function zamenjaj(a, b) {
    if (zaseden || !stanje || stanje.konec || stanje.poteze <= 0) return;
    const id = igraId;
    zaseden = true;
    pocistiNamig();
    Zvok.menjava();
    zamenjajVMrezi(a, b);
    await sleep(CAS.menjava);
    if (id !== igraId) return;
    const dore = [a, b].filter(p => jeDora(grid[p.r][p.c].tip));
    if (!dore.length && !najdiSkupine(tipi()).length) {
      zamenjajVMrezi(a, b);
      Zvok.ne();
      grid[a.r][a.c].el.classList.add('ne');
      grid[b.r][b.c].el.classList.add('ne');
      await sleep(CAS.menjava + 150);
      if (id !== igraId) return;
      el.querySelectorAll('.ne').forEach(x => x.classList.remove('ne'));
      zaseden = false;
      nacrtujNamig();
      return;
    }
    stanje.poteze--;
    laserPremor = Math.max(0, laserPremor - 1);
    povratni.poteze(stanje.poteze);
    await razresi(dore.map(p => ({ r: p.r, c: p.c })), [b, a], id);
    if (id !== igraId) return;
    zaseden = false;
    preveriKonec();
  }

  async function razresi(sprozi, premik, id) {
    let kombo = 0;
    while (true) {
      const skupine = najdiSkupine(tipi());
      if (!skupine.length && !sprozi.length) break;
      kombo++;

      // Dorine bombe, tudi verižno
      const pok = new Set();
      const sprozene = new Set();
      const laserskiZadetki = new Set();
      let laserskih = 0;
      const vrsta = sprozi.map(p => p.r * N + p.c);
      const zadeni = (r, c) => {
        if (r < 0 || r >= N || c < 0 || c >= N || !grid[r][c]) return;
        const k = r * N + c;
        pok.add(k);
        if (jeDora(grid[r][c].tip) && !sprozene.has(k)) vrsta.push(k);
      };
      if (vrsta.length) {
        // naboj: bomba zraste in zažari, kratek premor pred udarcem
        vrsta.forEach(k => grid[Math.floor(k / N)][k % N].el.classList.add('polni'));
        Zvok.polni();
        await sleep(260);
        if (id !== igraId) return;
      }
      while (vrsta.length) {
        const k = vrsta.pop();
        if (sprozene.has(k)) continue;
        sprozene.add(k);
        const r = Math.floor(k / N), c = k % N;
        if (grid[r][c].tip === 'dora-laser') {
          laserskih++;
          zadeni(r, c);
          // Fisher–Yates: brez podvojenih tarč ali polj, ki so že zadeta.
          const kandidati = [];
          grid.forEach((v, rr) => v.forEach((t, cc) => {
            if (t && !pok.has(rr * N + cc)) kandidati.push(rr * N + cc);
          }));
          for (let i = kandidati.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [kandidati[i], kandidati[j]] = [kandidati[j], kandidati[i]];
          }
          const tarce = kandidati.slice(0, DORA_LASER.zadetki);
          tarce.forEach(k => { zadeni(Math.floor(k / N), k % N); laserskiZadetki.add(k); });
          await laserskiVrtinec(r, c, tarce, id);
          if (id !== igraId) return;
          continue;
        }
        laser(r);
        laser(c, true);
        udarniVal(r, c, true);
        for (let i = 0; i < N; i++) { zadeni(r, i); zadeni(i, c); }
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) zadeni(r + dr, c + dc);
      }
      const razstreljeno = new Set(pok);

      // Trojke; 4 ali več povezanih ustvari novo Doro
      const nove = [];
      let novLaser = null;
      for (const s of skupine) {
        s.forEach(k => pok.add(k));
        if (s.length >= 4) {
          const mesto = premik.map(p => p.r * N + p.c).find(k => s.includes(k)) ?? s[Math.floor(s.length / 2)];
          if (!razstreljeno.has(mesto)) nove.push(mesto);
        }
      }
      // veriga 3+ podari novo Dorino bombo
      if (kombo >= 3 && !nove.length && !sprozene.size) {
        const kandidati = [...pok].filter(k => !razstreljeno.has(k));
        if (kandidati.length) nove.push(kandidati[Math.floor(Math.random() * kandidati.length)]);
      }
      const mocnaSkupina = skupine.find(s => s.length >= DORA_LASER.ujemanje);
      const laserNaPlosci = grid.some(v => v.some(t => t && t.tip === 'dora-laser'));
      if (!laserPremor && !laserNaPlosci && !sprozene.size && (mocnaSkupina || kombo >= DORA_LASER.veriga)) {
        const kandidati = (mocnaSkupina || [...pok]).filter(k => !razstreljeno.has(k));
        novLaser = nove.find(k => kandidati.includes(k)) ?? kandidati[0] ?? null;
        if (novLaser !== null) {
          if (!nove.includes(novLaser)) nove.push(novLaser);
          laserPremor = DORA_LASER.premor;
        }
      }
      nove.forEach(k => pok.delete(k));

      stanje.tocke += pok.size * TOCKE_NA_ELEMENT * kombo;
      povratni.tocke(stanje.tocke);
      if (sprozene.size && !laserskih) {
        obvestilo(sprozene.size > 1 ? 'MEGA BUM! ⚡' : 'BUM! ⚡', 'vroce', 'Dorine strele');
        Zvok.dora();
        blisk();
        tresi(true);
        const [b] = sprozene;
        plavajoceTocke(razstreljeno.size * TOCKE_NA_ELEMENT * kombo, Math.floor(b / N), b % N);
      } else if (laserskih) {
        tresi(false);
      } else if (novLaser !== null) {
        obvestilo('Laserska Dora!', 'roza', 'Premakni jo za laserski vrtinec!');
      } else if (kombo >= 2) {
        obvestilo(KOMBO_BESEDILA[Math.min(kombo, KOMBO_BESEDILA.length - 1)], kombo >= 4 ? 'vroce' : '', `kombo ×${kombo}`);
      } else if (skupine.some(sk => sk.length >= 5)) {
        obvestilo('Fantastično!', 'roza');
      } else if (nove.length) {
        obvestilo('Dora bomba!', 'roza');
      } else if (pok.size >= 6) {
        obvestilo(POHVALE[Math.floor(Math.random() * POHVALE.length)]);
      }
      if (kombo >= 2 && !sprozene.size) tresi(false);
      Zvok.pok(kombo);
      if (nove.length) setTimeout(() => Zvok.nastala(), 120);
      skupine.forEach(sk => {
        const sredina = sk[Math.floor(sk.length / 2)];
        plavajoceTocke(sk.length * TOCKE_NA_ELEMENT * kombo, Math.floor(sredina / N), sredina % N);
        udarniVal(Math.floor(sredina / N), sredina % N, false);
      });

      const naIskro = Math.max(2, Math.floor(200 / Math.max(1, pok.size)));
      pok.forEach(k => {
        const r = Math.floor(k / N), c = k % N, t = grid[r][c];
        if (laserskiZadetki.has(k)) return; // že animirano ob prihodu žarka
        if (razstreljeno.has(k)) {
          // zadete od strele odletijo stran od bombe in se vrtijo
          const [b] = sprozene, br = Math.floor(b / N), bc = b % N;
          const dx = c - bc + (Math.random() - 0.5), dy = r - br + (Math.random() - 0.5) - 0.6;
          t.el.style.setProperty('--lx', dx * 70 + '%');
          t.el.style.setProperty('--ly', dy * 70 + '%');
          t.el.style.setProperty('--lr', (Math.random() * 720 - 360) + 'deg');
          t.el.classList.add('leti');
        } else t.el.classList.add('pok');
        iskre(r, c, barvaTipa(t.tip), Math.min(razstreljeno.has(k) ? 6 : 9, naIskro));
      });
      nove.forEach(k => {
        const t = grid[Math.floor(k / N)][k % N];
        t.tip = k === novLaser ? 'dora-laser' : 'dora';
        narisi(t);
        t.el.classList.add('nova');
        postavi(t, Math.floor(k / N), k % N);
      });
      await sleep(sprozene.size ? CAS.pok + 220 : CAS.pok);
      if (id !== igraId) return;
      pok.forEach(k => {
        const r = Math.floor(k / N), c = k % N;
        grid[r][c].el.remove();
        grid[r][c] = null;
      });

      // Padanje in polnjenje
      const novi = [];
      for (let c = 0; c < N; c++) {
        let pisi = N - 1;
        for (let r = N - 1; r >= 0; r--) {
          const t = grid[r][c];
          if (!t) continue;
          if (pisi !== r) {
            grid[pisi][c] = t;
            grid[r][c] = null;
            postavi(t, pisi, c);
          }
          pisi--;
        }
        const manjka = pisi + 1;
        for (let r = pisi; r >= 0; r--) {
          const t = ustvari(nakljucen(), r - manjka, c);
          grid[r][c] = t;
          novi.push([t, r, c]);
        }
      }
      void el.offsetWidth;
      novi.forEach(([t, r, c]) => postavi(t, r, c));
      el.querySelectorAll('.nova').forEach(x => x.classList.remove('nova'));
      await sleep(CAS.padec);
      if (id !== igraId) return;
      sprozi = [];
      premik = [];
    }
    if (!najdiPotezo(tipi())) {
      obvestilo('Mešam!');
      await sleep(700);
      if (id !== igraId) return;
      napolni();
      await sleep(CAS.padec + 100);
    }
  }

  function preveriKonec() {
    if (stanje.tocke >= stanje.cilj) {
      stanje.konec = true;
      povratni.konec(true);
    } else if (stanje.poteze <= 0) {
      stanje.konec = true;
      povratni.konec(false);
    } else {
      nacrtujNamig();
    }
  }

  // ---------- Učinki ----------

  // En obrat, več parov prožnih žarkov. Tarče izginejo šele ob dejanskem zadetku.
  // SVG je v koordinatah 8 × 100, zato ostane poravnan tudi na ozkem telefonu.
  function laserskiVrtinec(r, c, tarce, id) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 800 800');
    svg.setAttribute('class', 'laser-vrtinec');
    svg.setAttribute('aria-hidden', 'true');
    const tile = grid[r][c].el, portret = tile.querySelector('img');
    tile.classList.remove('polni');
    tile.classList.add('vrti');
    el.appendChild(svg);
    obvestilo('Laserski vrtinec!', 'roza laser-obvestilo', `${tarce.length} naključnih zadetkov`);
    const streli = tarce.map((k, i) => {
      const g = document.createElementNS(ns, 'g');
      g.style.opacity = '0';
      const poti = [];
      for (let oko = 0; oko < 2; oko++) {
        ['laser-jezik-rob', 'laser-jezik', 'laser-jezik-jedro'].forEach(razred => {
          const p = document.createElementNS(ns, 'path');
          p.setAttribute('class', razred);
          p.setAttribute('pathLength', '1');
          g.appendChild(p);
          poti.push({ p, oko });
        });
      }
      svg.appendChild(g);
      return { k, i, g, poti, zadet: false };
    });
    const trajanje = DORA_LASER.trajanje, dolzina = 440;
    const razmik = (trajanje - dolzina) / Math.max(1, tarce.length);
    const mirno = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(resolve => {
      let frame, zacetek;
      const koncaj = () => {
        cancelAnimationFrame(frame);
        svg.remove();
        tile.classList.remove('vrti');
        portret.style.transform = '';
        prekiniLaser = null;
        resolve();
      };
      prekiniLaser = koncaj;
      const korak = zdaj => {
        if (id !== igraId) return koncaj();
        if (zacetek === undefined) zacetek = zdaj;
        const ms = zdaj - zacetek, del = Math.min(1, ms / trajanje);
        const kot = mirno ? 0 : del * Math.PI * 2, cos = Math.cos(kot), sin = Math.sin(kot);
        portret.style.transform = `rotate(${mirno ? 0 : del * 360}deg)`;
        streli.forEach(s => {
          const t = (ms - s.i * razmik) / dolzina;
          if (t >= 0.42 && !s.zadet) {
            s.zadet = true;
            const rr = Math.floor(s.k / N), cc = s.k % N, cilj = grid[rr][cc];
            cilj.el.classList.add('laser-zadeta');
            iskre(rr, cc, DORA_LASER.barva, 5);
            udarniVal(rr, cc, false);
            Zvok.laserskiZadetek(s.i);
          }
          if (t < 0 || t > 1) { s.g.style.opacity = '0'; return; }
          s.g.style.opacity = '1';
          const tx = (s.k % N + 0.5) * 100, ty = (Math.floor(s.k / N) + 0.5) * 100;
          const odmik = t < 0.42 ? 1 - t / 0.42 : -(t - 0.42) / 0.58;
          s.poti.forEach(({ p, oko }) => {
            // Oči iz dora-laser.svg: x=105/151, y=129, ob povečavi 1.45.
            const ox = (oko ? 23 : -23) / 256 * 88 * 1.45, oy = 1 / 256 * 88 * 1.45;
            const sx = (c + 0.5) * 100 + ox * cos - oy * sin;
            const sy = (r + 0.5) * 100 + ox * sin + oy * cos;
            const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
            const upogib = Math.sin(t * Math.PI) * 55 * (s.i % 2 ? 1 : -1);
            p.setAttribute('d', `M ${sx} ${sy} C ${sx + sin * 85} ${sy - cos * 85}, ${tx - dx * 0.25 - dy / d * upogib} ${ty - dy * 0.25 + dx / d * upogib}, ${tx} ${ty}`);
            p.style.strokeDashoffset = odmik;
          });
        });
        if (del >= 1) return koncaj();
        frame = requestAnimationFrame(korak);
      };
      frame = requestAnimationFrame(korak);
    });
  }

  function laser(i, navpicno = false) {
    const l = document.createElement('div');
    l.className = navpicno ? 'laser navpicni' : 'laser';
    l.style[navpicno ? 'left' : 'top'] = (i * 100 / N) + '%';
    el.appendChild(l);
    setTimeout(() => l.remove(), 650);
  }

  // krožni udarni val iz polja (r, c); velik ob bombi
  function udarniVal(r, c, velik) {
    const v = document.createElement('div');
    v.className = 'val' + (velik ? ' velik' : '');
    v.style.left = ((c + 0.5) * 100 / N) + '%';
    v.style.top = ((r + 0.5) * 100 / N) + '%';
    ovoj.appendChild(v);
    setTimeout(() => v.remove(), velik ? 700 : 450);
  }

  function barvaTipa(tip) { return opisTipa(tip).barva; }

  // Razlet barvnih iskric iz polja (r, c)
  function iskre(r, c, barva, koliko = 7) {
    const w = el.clientWidth / N;
    for (let i = 0; i < koliko; i++) {
      const d = document.createElement('i');
      const kot = Math.random() * Math.PI * 2, dolzina = w * (0.6 + Math.random() * 1.1);
      d.className = 'iskrica' + (i % 3 === 0 ? ' bela' : '');
      d.style.left = ((c + 0.5) * 100 / N) + '%';
      d.style.top = ((r + 0.5) * 100 / N) + '%';
      d.style.setProperty('--b', barva);
      d.style.setProperty('--dx', Math.cos(kot) * dolzina + 'px');
      d.style.setProperty('--dy', Math.sin(kot) * dolzina + 'px');
      d.style.setProperty('--v', (w * (0.14 + Math.random() * 0.14)) + 'px');
      ovoj.appendChild(d);
      setTimeout(() => d.remove(), 700);
    }
  }

  function plavajoceTocke(n, r, c) {
    const d = document.createElement('div');
    d.className = 'tocke-plava';
    d.textContent = '+' + n;
    d.style.left = ((c + 0.5) * 100 / N) + '%';
    d.style.top = ((r + 0.5) * 100 / N) + '%';
    ovoj.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  function tresi(mocno) {
    const razred = mocno ? 'tresi-mocno' : 'tresi';
    ovoj.classList.remove('tresi', 'tresi-mocno');
    void ovoj.offsetWidth;
    ovoj.classList.add(razred);
    setTimeout(() => ovoj.classList.remove(razred), 500);
  }

  function blisk() {
    const b = document.createElement('div');
    b.className = 'blisk';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 450);
  }

  // Zaključek zmage: vsaka neporabljena poteza razstreli eno polje (bonus).
  async function finale(naKorak) {
    if (!stanje) return;
    const id = igraId;
    pocistiNamig();
    const ostale = Math.min(stanje.poteze, 15);
    if (!ostale) return;
    obvestilo('Dorin kraš!');
    tresi(true);
    Zvok.nastala();
    await sleep(700);
    const proste = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c]) proste.push([r, c]);
    for (let i = 0; i < ostale && proste.length; i++) {
      if (id !== igraId) return;
      const [r, c] = proste.splice(Math.floor(Math.random() * proste.length), 1)[0];
      const t = grid[r][c];
      t.el.classList.add('pok');
      iskre(r, c, barvaTipa(t.tip), 9);
      plavajoceTocke(BONUS_ZA_POTEZO, r, c);
      if (i % 4 === 3) laser(r);
      Zvok.bonus(i);
      naKorak(i + 1);
      await sleep(140);
    }
    await sleep(400);
  }

  function obvestilo(besedilo, razred = '', podnapis = '') {
    ovoj.querySelectorAll('.plavajoce, .plavajoce-pod').forEach(x => x.remove()); // vedno samo en napis
    const o = document.createElement('div');
    o.className = 'plavajoce ' + razred;
    o.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
    o.textContent = besedilo;
    ovoj.appendChild(o);
    setTimeout(() => o.remove(), 1000);
    if (podnapis) {
      const p = document.createElement('div');
      p.className = 'plavajoce-pod' + (razred.includes('laser-obvestilo') ? ' laser-obvestilo' : '');
      p.textContent = podnapis;
      ovoj.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  function pocistiNamig() {
    clearTimeout(namigTimer);
    el.querySelectorAll('.namig').forEach(x => x.classList.remove('namig'));
  }

  function nacrtujNamig() {
    pocistiNamig();
    const id = igraId;
    namigTimer = setTimeout(() => {
      if (id !== igraId || zaseden || !stanje || stanje.konec) return;
      const p = najdiPotezo(tipi());
      if (p) p.forEach(([r, c]) => grid[r][c].el.classList.add('namig'));
    }, CAS.namig);
  }

  // ---------- Vnos (dotik, poteg, klik) ----------

  function celica(e) {
    const rect = el.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / rect.width * N);
    const r = Math.floor((e.clientY - rect.top) / rect.height * N);
    return r >= 0 && r < N && c >= 0 && c < N ? { r, c } : null;
  }

  function izberi(p) {
    if (izbrana && grid[izbrana.r][izbrana.c]) grid[izbrana.r][izbrana.c].el.classList.remove('izbrana');
    izbrana = p;
    if (p) grid[p.r][p.c].el.classList.add('izbrana');
  }

  function dotik(p) {
    if (!izbrana) return izberi(p);
    if (izbrana.r === p.r && izbrana.c === p.c) return izberi(null);
    if (Math.abs(izbrana.r - p.r) + Math.abs(izbrana.c - p.c) === 1) {
      const a = izbrana;
      izberi(null);
      return zamenjaj(a, p);
    }
    izberi(p);
  }

  function init(plosca, ovojEl) {
    el = plosca;
    ovoj = ovojEl;
    el.addEventListener('pointerdown', e => {
      if (zaseden || !stanje || stanje.konec) return;
      const p = celica(e);
      if (!p) return;
      zacetek = { ...p, x: e.clientX, y: e.clientY, potegnil: false };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      pocistiNamig();
    });
    el.addEventListener('pointermove', e => {
      if (!zacetek || zacetek.potegnil) return;
      const dx = e.clientX - zacetek.x, dy = e.clientY - zacetek.y;
      const meja = el.getBoundingClientRect().width / N * 0.35;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < meja) return;
      zacetek.potegnil = true;
      const cilj = Math.abs(dx) > Math.abs(dy)
        ? { r: zacetek.r, c: zacetek.c + Math.sign(dx) }
        : { r: zacetek.r + Math.sign(dy), c: zacetek.c };
      if (cilj.r < 0 || cilj.r >= N || cilj.c < 0 || cilj.c >= N) return;
      izberi(null);
      zamenjaj({ r: zacetek.r, c: zacetek.c }, cilj);
    });
    el.addEventListener('pointerup', () => {
      if (zacetek && !zacetek.potegnil) dotik({ r: zacetek.r, c: zacetek.c });
      zacetek = null;
    });
    el.addEventListener('pointercancel', () => { zacetek = null; });
  }

  // stopnja: { poteze, cilj, elementi }; povratni: { tocke(n), poteze(n), konec(zmaga) }
  function zacni(stopnja, klici) {
    igraId++;
    if (prekiniLaser) prekiniLaser();
    laserPremor = 0;
    pocistiNamig();
    povratni = klici;
    stEl = Math.min(stopnja.elementi, ELEMENTI.length);
    stanje = { poteze: stopnja.poteze, cilj: stopnja.cilj, tocke: 0, konec: false };
    izbrana = null;
    zacetek = null;
    zaseden = false;
    napolni();
    povratni.tocke(0);
    povratni.poteze(stanje.poteze);
    zaseden = true;
    const id = igraId;
    setTimeout(() => {
      if (id !== igraId) return;
      zaseden = false;
      obvestilo('Gremo!', 'roza');
      Zvok.nastala();
      nacrtujNamig();
    }, 1700);
  }

  function ustavi() {
    igraId++;
    if (prekiniLaser) prekiniLaser();
    pocistiNamig();
    if (stanje) stanje.konec = true;
  }

  return { init, zacni, ustavi, finale, napis: obvestilo, stanje: () => stanje };
})();
