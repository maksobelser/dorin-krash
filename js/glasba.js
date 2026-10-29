// Generativna vesela glasba (Web Audio, brez datotek).
// Vsaka »pesem« ima naključno durovo tonaliteto, tempo, zaporedje akordov, vzorce in melodijo.
// Slog: poskočen bas, ukulele na zadnji dobi, zvončki in piščalka, ploskanje, tamburin; vedno v duru.
// Pesem gre skozi dele (uvod, A, B, most …); po zadnjem delu se rodi nova.
// Zemljevid je bolj sproščen (marimba, mehkejši ritem), igra bolj poskočna.

const Glasba = (() => {
  const KLJUC = 'dorin-kras-glasba';
  const GLASNOST = 0.38;
  let vklopljena = true;
  try { vklopljena = localStorage.getItem(KLJUC) !== '0'; } catch (_) {}

  let ctx = null, izhod = null, odmev = null, sum = null;
  let tece = false, casovnik = null;
  let zeljeni = 'zemljevid', pesem = null;
  let korak = 0, naslednji = 0, napetost = 0;
  let kljucZadnji = 0; // za efekte, tudi ko glasba ne igra

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const izberi = a => a[Math.floor(Math.random() * a.length)];
  const p = v => Math.random() < v;

  // ---------- Glasbena teorija (samo dur) ----------

  const AKORDI = { dur: [0, 4, 7], mol: [0, 3, 7], dur6: [0, 4, 7, 9], sus: [0, 5, 7] };
  // [stopnja v poltonih od tonike, akord]
  const NAPREDKI = [
    [[0, 'dur'], [7, 'dur'], [9, 'mol'], [5, 'dur']],   // I V vi IV
    [[0, 'dur'], [5, 'dur'], [7, 'dur'], [5, 'dur']],   // I IV V IV
    [[0, 'dur'], [9, 'mol'], [5, 'dur'], [7, 'dur']],   // I vi IV V
    [[5, 'dur'], [7, 'dur'], [0, 'dur'], [0, 'dur6']],  // IV V I I
    [[0, 'dur'], [5, 'dur'], [0, 'dur'], [7, 'sus']],   // I IV I V
    [[0, 'dur6'], [2, 'mol'], [7, 'dur'], [0, 'dur']],  // I ii V I
  ];
  const PENTA = [0, 2, 4, 7, 9];
  const SVETLE_TONALITETE = [0, 2, 5, 7, 9, 10]; // C, D, F, G, A, B

  // ---------- Vzorci (16 korakov na takt) ----------
  // bas: R tonika, O oktava, 5 kvinta, 3 terca, . pavza
  const BAS = {
    igra: ['R.O.R.O.5.O.R.O.', 'R..R5...R..R5.3.', 'R.5.O.5.R.5.O.5.', 'R...5...R.R.5...', 'R.R.5...O.O.5.3.'],
    zemljevid: ['R...5...R...5...', 'R.....5.R...5...', 'R...O...5...O...', 'R...3...5...3...'],
  };
  const BOBEN = {
    igra: ['x...x...x...x...', 'x.....x.x.......', 'x...x...x..x....', 'x..x....x.x.....'],
    zemljevid: ['x.......x.......', 'x.....x...x.....', 'x.......x..x....'],
  };
  // ukulele: x udarec akorda, s brenkanje navzdol
  const UKULELE = {
    igra: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '..x.x...x.x..x..', 'x..x..x...x.x...'],
    zemljevid: ['x...x...x...x...', 'x.....x...x.....', '..x...x...x...x.'],
  };
  const RITMI = ['x.x.x...x.x.x...', 'x...x.x.x...x...', 'x.x.x.x.x.......', 'x..x..x.x.x.x...', 'x.x...x.x.x.....'];

  function melodija(dolgo) {
    // dva takta: sprehod po durovi pentatoniki, začne in konča na akordnem tonu
    const note = [];
    let st = izberi([2, 4, 5]);
    for (let takt = 0; takt < 2; takt++) {
      const ritem = izberi(RITMI);
      for (let k = 0; k < 16; k++) {
        if (ritem[k] !== 'x') continue;
        st += p(0.65) ? izberi([-1, 1]) : izberi([-2, 2, 1]);
        st = Math.max(0, Math.min(9, st));
        note.push({ k: takt * 16 + k, st, d: izberi(dolgo ? [2, 2, 3] : [1, 2, 2]) });
      }
    }
    if (note.length) { note[note.length - 1].st = izberi([0, 5]); note[note.length - 1].d = 4; }
    return note;
  }

  function novaPesem(nacin) {
    const igra = nacin === 'igra';
    const kljuc = izberi(SVETLE_TONALITETE);
    kljucZadnji = kljuc;
    const shuffle = p(0.4);
    return {
      nacin, igra, kljuc,
      napredek: izberi(NAPREDKI), napredekB: izberi(NAPREDKI),
      tempo: igra ? 120 + Math.random() * 14 : 104 + Math.random() * 12,
      swing: shuffle ? 0.28 : 0.04,
      basA: izberi(BAS[nacin]), basB: izberi(BAS[nacin]),
      boben: izberi(BOBEN[nacin]), uke: izberi(UKULELE[nacin]), ukeB: izberi(UKULELE[nacin]),
      melA: melodija(false), melB: melodija(true),
      zvokA: izberi(['zvoncek', 'piscalka', 'marimba']), zvokB: izberi(['piscalka', 'zvoncek']),
      deli: igra ? ['uvod', 'a', 'b', 'a', 'most', 'b', 'a2'] : ['uvod', 'a', 'b', 'most', 'a', 'b'],
      del: 0, vDelu: 0, takt: 0,
      akord: null, naslAkord: null, glasovi: null,
    };
  }
  const dolzinaDela = d => (d === 'uvod' || d === 'most' ? 4 : 8);

  // ---------- Instrumenti ----------

  function ovoj(g, t, napad, vrh, upad) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vrh, t + napad);
    g.gain.exponentialRampToValueAtTime(0.0001, t + napad + upad);
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
  function osc(tip, f, t, konec) {
    const o = ctx.createOscillator();
    o.type = tip;
    o.frequency.value = f;
    o.start(t); o.stop(konec);
    return o;
  }

  function kick(t, g) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    ovoj(v, t, 0.003, g, 0.22);
    o.connect(v).connect(izhod);
    o.start(t); o.stop(t + 0.3);
  }
  // ploskanje: trije hitri sunki šuma
  function plosk(t, g) {
    const fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 1.2;
    fl.connect(v).connect(izhod);
    posli(v, 0.15);
    v.gain.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach(z => {
      v.gain.setValueAtTime(g, t + z);
      v.gain.exponentialRampToValueAtTime(g * 0.2, t + z + 0.009);
    });
    v.gain.setValueAtTime(g * 0.7, t + 0.03);
    v.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    sumNode(t, 0.18).connect(fl);
  }
  function hat(t, g) {
    const n = sumNode(t, 0.05), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'highpass'; fl.frequency.value = 8000;
    ovoj(v, t, 0.002, g, 0.03);
    n.connect(fl).connect(v).connect(izhod);
  }
  function tamburin(t, g) {
    const n = sumNode(t, 0.14), fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'bandpass'; fl.frequency.value = 9000; fl.Q.value = 2;
    ovoj(v, t, 0.004, g, 0.12);
    n.connect(fl).connect(v).connect(izhod);
  }
  // lesena kocka
  function kocka(t, f, g) {
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.05);
    ovoj(v, t, 0.001, g, 0.06);
    o.connect(v).connect(izhod);
    o.start(t); o.stop(t + 0.1);
  }
  // poskočen, okrogel bas (kot tuba)
  function bas(t, midi, trajanje, g) {
    const f = mtof(midi);
    const fl = ctx.createBiquadFilter(), v = ctx.createGain();
    fl.type = 'lowpass'; fl.Q.value = 3;
    fl.frequency.setValueAtTime(1400, t);
    fl.frequency.exponentialRampToValueAtTime(380, t + 0.12);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.012);
    v.gain.exponentialRampToValueAtTime(g * 0.5, t + trajanje * 0.7);
    v.gain.exponentialRampToValueAtTime(0.0001, t + trajanje + 0.05);
    fl.connect(v).connect(izhod);
    const konec = t + trajanje + 0.08;
    const a = osc('square', f, t, konec), b = osc('triangle', f * 2, t, konec);
    a.frequency.setValueAtTime(f * 0.97, t);
    a.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const bg = ctx.createGain(); bg.gain.value = 0.4;
    a.connect(fl); b.connect(bg).connect(fl);
  }
  // ukulele: brenkanje akorda (nota za noto, hitro)
  function ukulele(t, note, g, navzdol) {
    note.forEach((m, i) => {
      const z = t + (navzdol ? i : note.length - 1 - i) * 0.014;
      const f = mtof(m);
      const fl = ctx.createBiquadFilter(), v = ctx.createGain();
      fl.type = 'lowpass'; fl.Q.value = 1;
      fl.frequency.setValueAtTime(4200, z);
      fl.frequency.exponentialRampToValueAtTime(700, z + 0.18);
      ovoj(v, z, 0.003, g, 0.32);
      fl.connect(v).connect(izhod);
      posli(v, 0.12);
      osc('sawtooth', f, z, z + 0.4).connect(fl);
    });
  }
  function marimba(t, midi, g, trajanje = 0.5) {
    const f = mtof(midi), v = ctx.createGain(), v2 = ctx.createGain();
    ovoj(v, t, 0.003, g, trajanje);
    ovoj(v2, t, 0.002, g * 0.5, 0.07);
    v.connect(izhod); v2.connect(izhod);
    posli(v, 0.2);
    osc('sine', f, t, t + trajanje + 0.05).connect(v);
    osc('sine', f * 4, t, t + 0.1).connect(v2);
  }
  // zvonček (igrača): svetel FM zvok
  function zvoncek(t, midi, g) {
    const f = mtof(midi);
    const nos = osc('sine', f, t, t + 0.9), mod = osc('sine', f * 3.5, t, t + 0.9);
    const mg = ctx.createGain(), v = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.3);
    mod.connect(mg).connect(nos.frequency);
    ovoj(v, t, 0.002, g, 0.8);
    nos.connect(v).connect(izhod);
    posli(v, 0.35);
  }
  // piščalka: čist ton z vibratom in drsenjem v noto
  function piscalka(t, midi, trajanje, g) {
    const f = mtof(midi), v = ctx.createGain();
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.03);
    v.gain.setValueAtTime(g, t + trajanje * 0.8);
    v.gain.exponentialRampToValueAtTime(0.0001, t + trajanje + 0.06);
    v.connect(izhod);
    posli(v, 0.3);
    const konec = t + trajanje + 0.1;
    const o = osc('sine', f, t, konec), o2 = osc('triangle', f * 2, t, konec);
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lfo = osc('sine', 6, t, konec), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.18);
    lfo.connect(lg).connect(o.frequency);
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    o.connect(v); o2.connect(g2).connect(v);
  }

  // ---------- Sekvencer ----------

  function glasovi(ps, [stopnja, kakovost]) {
    // akordni toni v obsegu ukulele (G4–A5)
    return AKORDI[kakovost].map(i => {
      let m = 60 + ps.kljuc + stopnja + i;
      while (m < 67) m += 12;
      while (m >= 81) m -= 12;
      return m;
    }).sort((a, b) => a - b);
  }
  const basovaTonika = (ps, stopnja) => {
    let m = 36 + ((ps.kljuc + stopnja) % 12);
    if (m > 46) m -= 12;
    return m;
  };

  function zacniTakt(ps) {
    // zamenjava zaslona (zemljevid ↔ igra): nova pesem v pravem slogu že ob naslednjem taktu
    if (ps.nacin !== zeljeni) ps = pesem = novaPesem(zeljeni);
    if (ps.vDelu >= dolzinaDela(ps.deli[ps.del])) {
      ps.vDelu = 0;
      ps.del++;
      if (ps.del >= ps.deli.length) {
        pesem = novaPesem(zeljeni);
        return zacniTakt(pesem);
      }
    }
    const a = ps.deli[ps.del] === 'b' ? ps.napredekB : ps.napredek;
    ps.akord = a[ps.takt % a.length];
    ps.naslAkord = a[(ps.takt + 1) % a.length];
    ps.glasovi = glasovi(ps, ps.akord);
    return ps;
  }

  function igrajMelodijo(ps, s, korakSek, del, t) {
    const b = del === 'b';
    const mel = b ? ps.melB : ps.melA;
    const k32 = (ps.vDelu % 2) * 16 + s;
    const visje = (del === 'a2' && ps.vDelu >= 4) || (b && ps.vDelu >= 6) ? 2 : 0; // proti koncu dela navzgor
    const zvok = b ? ps.zvokB : ps.zvokA;
    mel.forEach(n => {
      if (n.k !== k32) return;
      const st = n.st + visje;
      const m = 72 + (ps.kljuc > 6 ? ps.kljuc - 12 : ps.kljuc) + PENTA[st % 5] + Math.floor(st / 5) * 12;
      const g = ps.igra ? 1 : 0.85;
      if (zvok === 'piscalka') piscalka(t, m, n.d * korakSek, 0.075 * g);
      else if (zvok === 'zvoncek') zvoncek(t, m + 12, 0.06 * g);
      else marimba(t, m, 0.11 * g);
    });
  }
  function igrajKorak(k, t) {
    let ps = pesem;
    const s = k % 16;
    if (s === 0) ps = zacniTakt(ps);
    const del = ps.deli[ps.del], igra = ps.igra;
    const zadnjiTakt = ps.vDelu === dolzinaDela(del) - 1 && ps.del < ps.deli.length - 1;
    const fill = zadnjiTakt && s >= 12 && del !== 'most';
    const korakSek = 60 / ps.tempo / 4;

    // --- bobni ---
    if (del === 'most') {
      // odmor: samo ploskanje in lesena kocka, zvončki igrajo akord navzgor
      if (s === 4 || s === 12) plosk(t, 0.3);
      if (s % 4 === 2) kocka(t, 1200, 0.07);
      if (s % 2 === 0) zvoncek(t, ps.glasovi[(s / 2) % ps.glasovi.length] + 12, 0.035);
    } else {
      if (ps.boben[s] === 'x' && !fill) kick(t, igra ? 0.7 : 0.5);
      if ((s === 4 || s === 12) && del !== 'uvod') plosk(t, igra ? 0.32 : 0.22);
      if (s % 2 === 0) hat(t, (s % 4 === 2 ? 0.12 : 0.06) * (igra ? 1 : 0.7));
      if ((del === 'b' || del === 'a2' || napetost > 0.5) && s % 4 === 2) tamburin(t, 0.06);
      if (napetost > 0.5 && s % 2 === 1) hat(t, 0.05);
      if (del === 'uvod' && s % 4 === 0) kocka(t, s % 8 ? 900 : 1200, 0.08);
    }
    if (fill) kocka(t, 800 + (s - 12) * 200, 0.12);

    // --- bas ---
    const vzorec = del === 'b' ? ps.basB : ps.basA;
    const c = del === 'most' ? (s === 0 || s === 8 ? 'R' : '.') : vzorec[s];
    if (c !== '.') {
      const ton = basovaTonika(ps, ps.akord[0]);
      const ak = AKORDI[ps.akord[1]];
      const m = c === 'O' ? ton + 12 : c === '5' ? ton + 7 : c === '3' ? ton + ak[1] : ton;
      let d = 1;
      while (d < 2 && vzorec[(s + d) % 16] === '.') d++;
      bas(t, m, d * korakSek * 0.9, igra ? 0.32 : 0.27);
    }

    // --- ukulele / marimba (akordi) ---
    if (del !== 'most') {
      const uv = del === 'b' || del === 'a2' ? ps.ukeB : ps.uke;
      if (uv[s] === 'x') {
        if (igra || del !== 'uvod') ukulele(t, ps.glasovi, igra ? 0.045 : 0.04, s % 4 !== 2);
        if (!igra && s % 8 === 0) marimba(t, ps.glasovi[0] - 12, 0.08, 0.6);
      }
    }

    // --- melodija (A, B, A2; v uvodu ne) ---
    if (del === 'a' || del === 'b' || del === 'a2') igrajMelodijo(ps, s, korakSek, del, t);

    if (s === 15) { ps.vDelu++; ps.takt++; }
  }

  function razporedi() {
    if (!tece || !pesem || !vklopljena) return;
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
    izhod.gain.exponentialRampToValueAtTime(GLASNOST, ctx.currentTime + 1.5);
    clearInterval(casovnik);
    casovnik = setInterval(razporedi, 25);
    razporedi();
  }

  function ustavi() {
    tece = false;
    clearInterval(casovnik);
    casovnik = null;
    if (!ctx) return;
    // takoj utihne (tudi note, ki so že razporejene naprej)
    izhod.gain.cancelScheduledValues(0);
    izhod.gain.setValueAtTime(izhod.gain.value, ctx.currentTime);
    izhod.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
  }

  // ob prvem dotiku (ko se zvok sme vklopiti) začni igrati
  Zvok.obZagonu(() => { if (vklopljena) zacni(); });

  return {
    get vklopljena() { return vklopljena; },
    nastavi(b) {
      vklopljena = !!b;
      try { localStorage.setItem(KLJUC, vklopljena ? '1' : '0'); } catch (_) {}
      if (vklopljena) zacni(); else ustavi();
    },
    // 'zemljevid' ali 'igra': nova pesem v pravem slogu začne ob naslednjem taktu
    nacin(n) { zeljeni = n; },
    // 0–1: v igri, ko zmanjkuje potez, več hi-hatov in tamburina
    napetost(v) { napetost = v; },
    // začasno potiša glasbo (fanfara ob zmagi, poraz)
    utisaj(sek) {
      if (!tece || !vklopljena) return;
      const t = ctx.currentTime;
      izhod.gain.cancelScheduledValues(t);
      izhod.gain.setTargetAtTime(GLASNOST * 0.2, t, 0.08);
      izhod.gain.setTargetAtTime(GLASNOST, t + sek, 0.6);
    },
    // durova pentatonika trenutne pesmi od note 'od' navzgor (za uglašene efekte)
    lestvica(od) {
      const kljuc = pesem ? pesem.kljuc : kljucZadnji;
      let osnova = od + ((kljuc - od) % 12 + 12) % 12;
      if (osnova - od > 6) osnova -= 12;
      const izid = [];
      for (let o = 0; o < 3; o++) PENTA.forEach(i => izid.push(osnova + o * 12 + i));
      return izid;
    },
  };
})();
