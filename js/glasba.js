// Generativna funky glasba (Web Audio, brez datotek).
// Vsaka »pesem« ima naključno tonaliteto, tempo, zaporedje akordov, basovske in bobnarske vzorce
// ter melodični motiv. Pesem gre skozi dele (uvod, A, B, premor …); po zadnjem delu se rodi nova.
// Zemljevid ima mirnejši slog (rhodes, mehak bas), igra bolj funky (slap bas, clav, 16-inke).

const Glasba = (() => {
  const KLJUC = 'dorin-kras-glasba';
  const GLASNOST = 0.42;
  let vklopljena = true;
  try { vklopljena = localStorage.getItem(KLJUC) !== '0'; } catch (_) {}

  let ctx = null, izhod = null, odmev = null, sum = null;
  let tece = false, casovnik = null;
  let zeljeni = 'zemljevid', pesem = null;
  let korak = 0, naslednji = 0, napetost = 0;
  let kljucZadnji = 0, molZadnji = true; // za efekte, tudi ko glasba ne igra

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const izberi = a => a[Math.floor(Math.random() * a.length)];
  const p = v => Math.random() < v;

  // ---------- Glasbena teorija ----------

  const AKORDI = {
    m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17],
    d9: [0, 4, 7, 10, 14], d13: [0, 4, 10, 14, 21], d7s9: [0, 4, 7, 10, 15],
    M7: [0, 4, 7, 11], M9: [0, 4, 7, 11, 14],
  };
  // [stopnja v poltonih od tonike, akord]; mol: ali melodija uporablja molovo pentatoniko
  const NAPREDKI = {
    igra: [
      { mol: true, a: [[0, 'm9'], [5, 'd9']] },
      { mol: true, a: [[0, 'd9'], [0, 'd9'], [10, 'd9'], [5, 'd13']] },
      { mol: true, a: [[0, 'm9'], [8, 'M7'], [10, 'd9'], [0, 'm9']] },
      { mol: true, a: [[0, 'm11'], [3, 'M7'], [5, 'm9'], [10, 'd9']] },
      { mol: true, a: [[0, 'd7s9'], [0, 'd7s9'], [5, 'd9'], [7, 'd9']] },
      { mol: false, a: [[2, 'm9'], [7, 'd13'], [0, 'M9'], [9, 'm9']] },
    ],
    zemljevid: [
      { mol: false, a: [[0, 'M9'], [9, 'm9'], [2, 'm9'], [7, 'd13']] },
      { mol: false, a: [[0, 'M7'], [5, 'M9'], [4, 'm7'], [9, 'm9']] },
      { mol: true, a: [[0, 'm9'], [5, 'd9']] },
      { mol: false, a: [[5, 'M9'], [4, 'm7'], [2, 'm9'], [0, 'M9']] },
      { mol: true, a: [[0, 'm9'], [3, 'M9'], [8, 'M7'], [7, 'd7s9']] },
    ],
  };
  const PENTA = { mol: [0, 3, 5, 7, 10], dur: [0, 2, 4, 7, 9] };

  // ---------- Vzorci (16 korakov na takt) ----------
  // bas: R tonika, O oktava, 5 kvinta, 7 septima, 3 terca, G mrtva nota, A kromatični prehod, . pavza
  const BAS = {
    igra: ['R..R..O.R.7.5..A', 'R.GR..R.O..R.7GA', 'R...R.OR..5.7.R.', 'R.R..OR.G.R.5.7A', 'R..O..R.GR..5O7.', 'RG.R.O.RG.R.7.5A', 'R..R.G.O..R.G7.5'],
    zemljevid: ['R.......5...R...', 'R.....R...5.7...', 'R...5...O...7.5.', 'R......R..5.....', 'R.....5.R...3...'],
  };
  const BOBEN = {
    igra: ['x.....x...x.....', 'x..x....x.x.....', 'x.....x.x.....x.', 'x..x..x...x..x..', 'x.x...x...x..x..'],
    zemljevid: ['x.......x.......', 'x.........x.....', 'x.....x...x.....'],
  };
  // tipke: x kratek udarec, L dolg akord
  const TIPKE = {
    igra: ['..x...x...x..x..', '.x..x...x.x...x.', '..x..x....x..x..', 'x..x..x...x.x...', '...x..x...x..x..'],
    zemljevid: ['L.........L.....', 'L.......L.......', 'L.....x...L.....', 'L.........x.x...'],
  };
  const RITMI_MOTIVA = ['x..x.x..x...x.x.', 'x.x...x.x..x....', '..x.x.x...x..x..', 'x...x.x.x.x.....', 'x..x..x.....x.x.'];

  function motiv(mol) {
    // dva takta: naključen sprehod po pentatoniki
    const lest = mol ? PENTA.mol : PENTA.dur;
    const note = [];
    let st = 2 + Math.floor(Math.random() * 3);
    for (let takt = 0; takt < 2; takt++) {
      const ritem = izberi(RITMI_MOTIVA);
      for (let k = 0; k < 16; k++) {
        if (ritem[k] !== 'x') continue;
        st += p(0.7) ? izberi([-1, 1]) : izberi([-2, 2]);
        st = Math.max(0, Math.min(9, st));
        note.push({ k: takt * 16 + k, st, d: izberi([1, 1, 2, 3]) });
      }
    }
    if (note.length) note[note.length - 1].d = 4;
    return { note, lest };
  }

  function novaPesem(nacin) {
    const igra = nacin === 'igra';
    const napredek = izberi(NAPREDKI[nacin]);
    const kljuc = Math.floor(Math.random() * 12);
    kljucZadnji = kljuc;
    molZadnji = napredek.mol;
    return {
      nacin, igra, napredek, kljuc,
      tempo: igra ? 102 + Math.random() * 14 : 86 + Math.random() * 12,
      swing: igra ? 0.1 + Math.random() * 0.1 : 0.16 + Math.random() * 0.1,
      basA: izberi(BAS[nacin]), basB: izberi(BAS[nacin]),
      boben: izberi(BOBEN[nacin]), tipke: izberi(TIPKE[nacin]), tipkeB: izberi(TIPKE[nacin]),
      motiv: motiv(napredek.mol),
      deli: igra ? ['uvod', 'a', 'b', 'a', 'premor', 'b', 'a2'] : ['uvod', 'a', 'b', 'premor', 'a', 'b'],
      del: 0, vDelu: 0, takt: 0,
      akord: null, naslAkord: null, glasovi: null,
    };
  }
  const dolzinaDela = d => (d === 'uvod' || d === 'premor' ? 4 : 8);

  // ---------- Instrumenti ----------

  function ovoj(g, t, napad, vrh, upad, konec = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vrh, t + napad);
    g.gain.exponentialRampToValueAtTime(konec, t + napad + upad);
  }
  function posli(v, delez) {
    if (!delez) return;
    const s = ctx.createGain();
    s.gain.value = delez;
    v.connect(s).connect(odmev);
  }
  function sumNode(t, trajanje) {
    const src = ctx.createBufferSource();
    src.buffer = sum;
    src.start(t, Math.random() * 1.5);
    src.stop(t + trajanje + 0.05);
    return src;
  }

  function kick(t, g) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    ovoj(v, t, 0.003, g, 0.34);
    o.connect(v).connect(izhod);
    o.start(t); o.stop(t + 0.4);
  }
  function snare(t, g, odm = 0.12) {
    const n = sumNode(t, 0.2), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'bandpass'; fl.frequency.value = 1900; fl.Q.value = 0.8;
    ovoj(v, t, 0.002, g, 0.17);
    n.connect(fl).connect(v).connect(izhod);
    posli(v, odm);
    const o = ctx.createOscillator(), vo = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    ovoj(vo, t, 0.002, g * 0.5, 0.09);
    o.connect(vo).connect(izhod);
    o.start(t); o.stop(t + 0.15);
  }
  function hat(t, g, odprt) {
    const n = sumNode(t, odprt ? 0.3 : 0.06), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'highpass'; fl.frequency.value = 7500;
    ovoj(v, t, 0.002, g, odprt ? 0.28 : 0.035);
    n.connect(fl).connect(v).connect(izhod);
  }
  function shaker(t, g) {
    const n = sumNode(t, 0.1), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'bandpass'; fl.frequency.value = 6000; fl.Q.value = 1;
    ovoj(v, t, 0.015, g, 0.06);
    n.connect(fl).connect(v).connect(izhod);
  }
  function cinela(t, g) {
    const n = sumNode(t, 1.6), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'highpass'; fl.frequency.value = 5000;
    ovoj(v, t, 0.003, g, 1.5);
    n.connect(fl).connect(v).connect(izhod);
    posli(v, 0.3);
  }
  function bas(t, midi, trajanje, g, slap) {
    const f = mtof(midi);
    const fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'lowpass';
    fl.Q.value = slap ? 7 : 2;
    fl.frequency.setValueAtTime(slap ? 3000 : 1000, t);
    fl.frequency.exponentialRampToValueAtTime(160 + f * 2, t + Math.min(0.2, trajanje));
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.006);
    v.gain.setValueAtTime(g * 0.8, t + trajanje * 0.8);
    v.gain.exponentialRampToValueAtTime(0.0001, t + trajanje + 0.04);
    fl.connect(v).connect(izhod);
    ['sawtooth', 'square'].forEach((tip, i) => {
      const o = ctx.createOscillator();
      o.type = tip;
      o.frequency.value = f;
      o.detune.value = i ? -6 : 0;
      o.connect(fl);
      o.start(t); o.stop(t + trajanje + 0.06);
    });
    const sub = ctx.createOscillator(), sv = ctx.createGain();
    sub.frequency.value = f;
    sv.gain.setValueAtTime(0.0001, t);
    sv.gain.exponentialRampToValueAtTime(g * 0.7, t + 0.008);
    sv.gain.exponentialRampToValueAtTime(0.0001, t + trajanje + 0.04);
    sub.connect(sv).connect(izhod);
    sub.start(t); sub.stop(t + trajanje + 0.06);
    if (slap) {
      const n = sumNode(t, 0.03), hf = ctx.createBiquadFilter(), nv = ctx.createGain();
      hf.type = 'highpass'; hf.frequency.value = 2500;
      ovoj(nv, t, 0.001, g * 0.35, 0.02);
      n.connect(hf).connect(nv).connect(izhod);
    }
  }
  function mrtvaNota(t, midi, g) {
    const n = sumNode(t, 0.05), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'bandpass'; fl.frequency.value = mtof(midi) * 3; fl.Q.value = 4;
    ovoj(v, t, 0.002, g, 0.04);
    n.connect(fl).connect(v).connect(izhod);
  }
  // Rhodes: FM z mehko zvonasto začetno barvo
  function rhodes(t, note, trajanje, g) {
    const v = ctx.createGain();
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.008);
    v.gain.exponentialRampToValueAtTime(g * 0.45, t + 0.6);
    v.gain.setValueAtTime(g * 0.45, t + Math.max(0.61, trajanje));
    v.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.61, trajanje) + 0.25);
    v.connect(izhod);
    posli(v, 0.3);
    const konec = t + Math.max(0.61, trajanje) + 0.3;
    note.forEach(m => {
      const f = mtof(m);
      const nos = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      nos.frequency.value = f;
      mod.frequency.value = f;
      mg.gain.setValueAtTime(f * 1.4, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.35);
      mod.connect(mg).connect(nos.frequency);
      nos.connect(v);
      nos.start(t); mod.start(t);
      nos.stop(konec); mod.stop(konec);
    });
  }
  // Clav: kratek pulz skozi »wah« filter
  function clav(t, note, g) {
    const fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'bandpass'; fl.Q.value = 4;
    fl.frequency.setValueAtTime(2600, t);
    fl.frequency.exponentialRampToValueAtTime(800, t + 0.12);
    ovoj(v, t, 0.002, g, 0.14);
    fl.connect(v).connect(izhod);
    posli(v, 0.1);
    note.forEach(m => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = mtof(m);
      o.connect(fl);
      o.start(t); o.stop(t + 0.18);
    });
  }
  // Melodija: igra = »synth lead« z vibratom, zemljevid = vibrafon/zvonček
  function vodilni(t, midi, trajanje, g, igra) {
    const f = mtof(midi);
    const v = ctx.createGain();
    if (igra) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 2400; fl.Q.value = 2;
      v.gain.setValueAtTime(0.0001, t);
      v.gain.exponentialRampToValueAtTime(g, t + 0.02);
      v.gain.setValueAtTime(g, t + trajanje * 0.85);
      v.gain.exponentialRampToValueAtTime(0.0001, t + trajanje + 0.08);
      fl.connect(v).connect(izhod);
      posli(v, 0.3);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.2);
      lfo.connect(lg);
      [['square', 0], ['sawtooth', 7]].forEach(([tip, c]) => {
        const o = ctx.createOscillator();
        o.type = tip;
        o.frequency.value = f;
        o.detune.value = c;
        lg.connect(o.frequency);
        o.connect(fl);
        o.start(t); o.stop(t + trajanje + 0.1);
      });
      lfo.start(t); lfo.stop(t + trajanje + 0.1);
    } else {
      const nos = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      nos.frequency.value = f;
      mod.frequency.value = f * 4;
      mg.gain.setValueAtTime(f * 0.9, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.5);
      mod.connect(mg).connect(nos.frequency);
      ovoj(v, t, 0.004, g, 1.1);
      nos.connect(v).connect(izhod);
      posli(v, 0.45);
      nos.start(t); mod.start(t);
      nos.stop(t + 1.2); mod.stop(t + 1.2);
    }
  }
  function blazina(t, note, trajanje, g) {
    const fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = 1300;
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.5);
    v.gain.setValueAtTime(g, t + trajanje);
    v.gain.exponentialRampToValueAtTime(0.0001, t + trajanje + 0.7);
    fl.connect(v).connect(izhod);
    posli(v, 0.4);
    note.forEach(m => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = mtof(m);
      o.connect(fl);
      o.start(t); o.stop(t + trajanje + 0.8);
    });
  }

  // ---------- Sekvencer ----------

  function glasovi(pesem, [stopnja, kakovost]) {
    // akordni toni brez tonike, stisnjeni v obseg A3–C5
    return AKORDI[kakovost].slice(1).map(i => {
      let m = 48 + pesem.kljuc + stopnja + i;
      while (m < 57) m += 12;
      while (m >= 74) m -= 12;
      return m;
    }).sort((a, b) => a - b);
  }
  const basovaTonika = (pesem, stopnja) => {
    let m = 33 + ((pesem.kljuc + stopnja) % 12);
    if (m > 44) m -= 12;
    return m;
  };

  function zacniTakt(ps) {
    // zamenjava zaslona (zemljevid ↔ igra): nova pesem v pravem slogu že ob naslednjem taktu
    if (ps.nacin !== zeljeni) ps = pesem = novaPesem(zeljeni);
    const del = ps.deli[ps.del];
    if (ps.vDelu >= dolzinaDela(del)) {
      ps.vDelu = 0;
      ps.del++;
      if (ps.del >= ps.deli.length) {
        pesem = novaPesem(zeljeni);
        return zacniTakt(pesem);
      }
    }
    const a = ps.napredek.a;
    ps.akord = a[ps.takt % a.length];
    ps.naslAkord = a[(ps.takt + 1) % a.length];
    ps.glasovi = glasovi(ps, ps.akord);
    return ps;
  }

  function igrajKorak(k, t) {
    let ps = pesem;
    const s = k % 16;
    if (s === 0) { ps = zacniTakt(ps); }
    const del = ps.deli[ps.del], igra = ps.igra;
    const zadnjiTakt = ps.vDelu === dolzinaDela(del) - 1 && ps.del < ps.deli.length - 1;
    const fill = zadnjiTakt && s >= 12 && del !== 'premor';
    const korakSek = 60 / ps.tempo / 4;

    // --- bobni ---
    if (s === 0 && ps.vDelu === 0 && del !== 'uvod' && del !== 'premor') cinela(t, igra ? 0.16 : 0.1);
    if (del !== 'premor') {
      if (ps.boben[s] === 'x' && !fill) kick(t, igra ? 0.85 : 0.6);
      if (s === 4 || s === 12) snare(t, igra ? 0.42 : 0.24, igra ? 0.1 : 0.25);
      else if (igra && del !== 'uvod' && [7, 9, 14, 15].includes(s) && p(0.22)) snare(t, 0.08, 0);
    } else if (s === 0 && ps.vDelu % 2 === 0) kick(t, 0.35);
    if (fill) snare(t, 0.14 + (s - 12) * 0.08, 0.05);
    if (!fill) {
      const gostota = igra ? (napetost > 0.5 || del === 'a2' ? 1 : 2) : 2;
      if (s % gostota === 0) hat(t, (s % 4 === 2 ? 0.16 : 0.09) * (igra ? 1 : 0.7), false);
      if (igra && (s === 14 || (del === 'a2' && s === 6))) hat(t, 0.1, true);
      if ((napetost > 0.5 || del === 'b') && s % 2 === 1) shaker(t, 0.05);
    }

    // --- bas ---
    const vzorec = del === 'b' ? ps.basB : ps.basA;
    const c = del === 'premor' ? (s === 0 ? 'R' : '.') : vzorec[s];
    if (c !== '.') {
      const ton = basovaTonika(ps, ps.akord[0]);
      const ak = AKORDI[ps.akord[1]];
      let m = null, slap = false;
      if (c === 'R') m = ton;
      else if (c === 'O') { m = ton + 12; slap = igra; }
      else if (c === '5') m = ton + 7;
      else if (c === '7') m = ton + (ak.includes(11) ? 11 : 10);
      else if (c === '3') m = ton + (ak.includes(4) ? 4 : 3);
      else if (c === 'A') m = basovaTonika(ps, ps.naslAkord[0]) - 1;
      if (c === 'G') mrtvaNota(t, ton, igra ? 0.18 : 0.1);
      else if (m !== null) {
        // trajanje do naslednje note (največ 3 koraki), staccato
        let d = 1;
        while (d < 3 && vzorec[(s + d) % 16] === '.') d++;
        const zamik = igra && p(0.12) ? 12 : 0; // občasno oktava višje
        bas(t, m + zamik, d * korakSek * (igra ? 0.85 : 1.1), igra ? 0.3 : 0.26, slap || (zamik && igra));
      }
    }

    // --- tipke ---
    if (del !== 'uvod' || !igra) {
      const tv = del === 'b' || del === 'a2' ? ps.tipkeB : ps.tipke;
      const ch = del === 'premor' ? (s === 0 ? 'L' : '.') : tv[s];
      if (ch === 'x') {
        if (igra) {
          clav(t, ps.glasovi.slice(0, 3), 0.045);
          if (p(0.5)) rhodes(t, ps.glasovi, korakSek * 1.5, 0.05);
        } else rhodes(t, ps.glasovi, korakSek * 2, 0.055);
      } else if (ch === 'L') {
        if (del === 'premor') blazina(t, ps.glasovi, korakSek * 15, 0.035);
        rhodes(t, ps.glasovi, korakSek * (igra ? 6 : 12), igra ? 0.05 : 0.06);
      }
    }

    // --- melodija (dela B in A2): klic in odgovor ---
    if (del === 'b' || (del === 'a2' && ps.vDelu >= 4)) {
      const krog = ps.vDelu % 8;           // 0–1 klic, 2–3 odgovor, 4–5 klic, 6–7 odgovor navzgor
      const k32 = (krog % 2) * 16 + s;
      const lest = ps.motiv.lest;
      ps.motiv.note.forEach((n, i) => {
        if (n.k !== k32) return;
        let st = n.st;
        const odgovor = krog === 2 || krog === 3 || krog === 6 || krog === 7;
        if (odgovor && i >= ps.motiv.note.length - 2) st = Math.max(0, st - 2);
        if (krog >= 6) st += 2;
        const osnova = 72 + (ps.kljuc > 6 ? ps.kljuc - 12 : ps.kljuc);
        const m = osnova + lest[st % 5] + Math.floor(st / 5) * 12;
        vodilni(t, m, n.d * korakSek, igra ? 0.07 : 0.09, igra);
      });
    }

    if (s === 15) { ps.vDelu++; ps.takt++; }
  }

  function razporedi() {
    if (!tece || !pesem) return;
    if (naslednji < ctx.currentTime) naslednji = ctx.currentTime + 0.05; // po premoru ne lovi zamujenega
    while (naslednji < ctx.currentTime + 0.15) {
      const korakSek = 60 / pesem.tempo / 4;
      const zamik = korak % 2 ? pesem.swing * korakSek : 0;
      igrajKorak(korak, naslednji + zamik);
      naslednji += korakSek;
      korak++;
    }
  }

  function poveziJedro() {
    if (ctx) return true;
    const j = Zvok.jedro();
    if (!j) return false;
    ({ ctx, izhod, odmev, sum } = j);
    return true;
  }

  function zacni() {
    if (!vklopljena || tece || !poveziJedro()) return;
    pesem = novaPesem(zeljeni);
    korak = 0;
    naslednji = ctx.currentTime + 0.1;
    tece = true;
    izhod.gain.cancelScheduledValues(ctx.currentTime);
    izhod.gain.setValueAtTime(0.0001, ctx.currentTime);
    izhod.gain.exponentialRampToValueAtTime(GLASNOST, ctx.currentTime + 2);
    casovnik = setInterval(razporedi, 25);
    razporedi();
  }

  function ustavi() {
    if (!tece) return;
    tece = false;
    clearInterval(casovnik);
    izhod.gain.cancelScheduledValues(ctx.currentTime);
    izhod.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }

  // ob prvem dotiku (ko se zvok sme vklopiti) začni igrati
  Zvok.obZagonu(() => { if (vklopljena) zacni(); });

  return {
    get vklopljena() { return vklopljena; },
    nastavi(b) {
      vklopljena = b;
      try { localStorage.setItem(KLJUC, b ? '1' : '0'); } catch (_) {}
      if (b) zacni(); else ustavi();
    },
    // 'zemljevid' ali 'igra': nova pesem v pravem slogu začne ob naslednjem taktu
    nacin(n) { zeljeni = n; },
    // 0–1: v igri, ko zmanjkuje potez, več hi-hatov in shakerja
    napetost(v) { napetost = v; },
    // začasno potiša glasbo (fanfara ob zmagi, poraz)
    utisaj(sek) {
      if (!tece) return;
      const t = ctx.currentTime;
      izhod.gain.cancelScheduledValues(t);
      izhod.gain.setTargetAtTime(GLASNOST * 0.2, t, 0.08);
      izhod.gain.setTargetAtTime(GLASNOST, t + sek, 0.6);
    },
    // pentatonika trenutne pesmi od note 'od' navzgor (za uglašene efekte)
    lestvica(od) {
      const lest = (pesem ? pesem.napredek.mol : molZadnji) ? PENTA.mol : PENTA.dur;
      const kljuc = pesem ? pesem.kljuc : kljucZadnji;
      let osnova = od + ((kljuc - od) % 12 + 12) % 12;
      if (osnova - od > 6) osnova -= 12;
      const izid = [];
      for (let o = 0; o < 3; o++) lest.forEach(i => izid.push(osnova + o * 12 + i));
      return izid;
    },
  };
})();
