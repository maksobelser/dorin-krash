// Igralna plošča: menjava, iskanje trojk, Dorina bomba, padanje in polnjenje.
// Plosca.init(...) se pokliče enkrat, Plosca.zacni(...) ob vsaki stopnji.

const Plosca = (() => {
  const N = 8;
  const CAS = { menjava: 200, pok: 260, padec: 320, namig: 6000 };
  const TOCKE_NA_ELEMENT = 20;
  const KOMBO_BESEDILA = ['', '', 'Super!', 'Odlično!', 'Bravo, Dora!', 'Noro!', 'Dorin kraš!'];
  const POHVALE = ['Super!', 'Bravo!', 'Odlično!', 'Wow!', 'Fantastično!', 'Na zdravje!', 'Sladko!'];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let el, ovoj, grid = [], stEl = 6, stanje = null, povratni = {};
  let izbrana = null, zacetek = null, zaseden = false, namigTimer = null, igraId = 0;

  // ---------- Risanje ----------

  function vsebina(e) {
    if (e.slika) return `<img src="${e.slika}" alt="${e.ime}" draggable="false">`;
    if (e.emoji) return `<span class="ikona">${e.emoji}</span>`;
    return `<span class="napis">${e.ime}</span>`;
  }

  function narisi(t) {
    const e = t.tip === 'dora' ? DORA : ELEMENTI[t.tip];
    const id = t.tip === 'dora' ? 'dora' : e.id;
    t.el.className = 'ploscica' + (t.tip === 'dora' ? ' dora' : '');
    t.el.innerHTML = `<div class="element el-${id}" style="--barva:${e.barva}">${vsebina(e)}</div>` +
      (t.tip === 'dora' ? '<span class="strela">⚡</span>' : '');
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
      if (g[r][c] === 'dora') return [[r, c], c + 1 < N ? [r, c + 1] : [r, c - 1]];
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
    const dore = [a, b].filter(p => grid[p.r][p.c].tip === 'dora');
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
      const vrsta = sprozi.map(p => p.r * N + p.c);
      const zadeni = (r, c) => {
        if (r < 0 || r >= N || c < 0 || c >= N || !grid[r][c]) return;
        const k = r * N + c;
        pok.add(k);
        if (grid[r][c].tip === 'dora' && !sprozene.has(k)) vrsta.push(k);
      };
      while (vrsta.length) {
        const k = vrsta.pop();
        if (sprozene.has(k)) continue;
        sprozene.add(k);
        const r = Math.floor(k / N), c = k % N;
        laser(r);
        for (let cc = 0; cc < N; cc++) zadeni(r, cc);
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) zadeni(r + dr, c + dc);
      }
      const razstreljeno = new Set(pok);

      // Trojke; 4 ali več povezanih ustvari novo Doro
      const nove = [];
      for (const s of skupine) {
        s.forEach(k => pok.add(k));
        if (s.length >= 4) {
          const mesto = premik.map(p => p.r * N + p.c).find(k => s.includes(k)) ?? s[Math.floor(s.length / 2)];
          if (!razstreljeno.has(mesto)) nove.push(mesto);
        }
      }
      nove.forEach(k => pok.delete(k));

      stanje.tocke += pok.size * TOCKE_NA_ELEMENT * kombo;
      povratni.tocke(stanje.tocke);
      if (sprozene.size) {
        obvestilo('Dora! ⚡');
        Zvok.dora();
        blisk();
        tresi(true);
        const [b] = sprozene;
        plavajoceTocke(razstreljeno.size * TOCKE_NA_ELEMENT * kombo, Math.floor(b / N), b % N);
      } else if (kombo >= 2) {
        obvestilo(KOMBO_BESEDILA[Math.min(kombo, KOMBO_BESEDILA.length - 1)], kombo >= 4 ? 'vroce' : '');
      } else if (skupine.some(sk => sk.length >= 5)) {
        obvestilo('Fantastično!', 'roza');
      } else if (nove.length || pok.size >= 6) {
        obvestilo(POHVALE[Math.floor(Math.random() * POHVALE.length)]);
      }
      if (kombo >= 3 && !sprozene.size) tresi(false);
      Zvok.pok(kombo);
      if (nove.length) setTimeout(() => Zvok.nastala(), 120);
      skupine.forEach(sk => {
        const sredina = sk[Math.floor(sk.length / 2)];
        plavajoceTocke(sk.length * TOCKE_NA_ELEMENT * kombo, Math.floor(sredina / N), sredina % N);
      });

      const naIskro = Math.max(2, Math.floor(160 / Math.max(1, pok.size)));
      pok.forEach(k => {
        const t = grid[Math.floor(k / N)][k % N];
        t.el.classList.add('pok');
        iskre(Math.floor(k / N), k % N, barvaTipa(t.tip), Math.min(8, naIskro));
      });
      nove.forEach(k => {
        const t = grid[Math.floor(k / N)][k % N];
        t.tip = 'dora';
        narisi(t);
        t.el.classList.add('nova');
        postavi(t, Math.floor(k / N), k % N);
      });
      await sleep(CAS.pok);
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

  function laser(r) {
    const l = document.createElement('div');
    l.className = 'laser';
    l.style.top = (r * 100 / N) + '%';
    el.appendChild(l);
    setTimeout(() => l.remove(), 600);
  }

  function barvaTipa(tip) { return tip === 'dora' ? DORA.barva : ELEMENTI[tip].barva; }

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

  function obvestilo(besedilo, razred = '') {
    ovoj.querySelectorAll('.plavajoce').forEach(x => x.remove()); // vedno samo en napis
    const o = document.createElement('div');
    o.className = 'plavajoce ' + razred;
    o.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
    o.textContent = besedilo;
    ovoj.appendChild(o);
    setTimeout(() => o.remove(), 1000);
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
    pocistiNamig();
    if (stanje) stanje.konec = true;
  }

  return { init, zacni, ustavi, finale, napis: obvestilo, stanje: () => stanje };
})();
