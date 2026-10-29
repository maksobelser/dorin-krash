// Zvočni učinki, sintetizirani z Web Audio (brez zvočnih datotek).
// Zvok se vklopi ob prvem dotiku (zahteva brskalnikov). Efekti in glasba imata vsak svoj kanal
// in svoj odmev; efekti so uglašeni na tonaliteto, ki jo trenutno igra glasba (Glasba.lestvica).

const Zvok = (() => {
  const KLJUC = 'dorin-kras-zvok';
  let ctx = null, efekti, glasba, odmevE, odmevG, sum;
  let vklopljen = true;
  try { vklopljen = localStorage.getItem(KLJUC) !== '0'; } catch (_) {}
  const obZagonu = [];

  // Umetni odmev: šum, ki eksponentno pojema
  function impulz(sekunde, upad) {
    const n = Math.floor(ctx.sampleRate * sekunde);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let k = 0; k < 2; k++) {
      const d = buf.getChannelData(k);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, upad);
    }
    return buf;
  }

  function kanal(glasnost, cilj, odmevSek) {
    const g = ctx.createGain();
    g.gain.value = glasnost;
    g.connect(cilj);
    const odmev = ctx.createConvolver();
    odmev.buffer = impulz(odmevSek, 3);
    const og = ctx.createGain();
    og.gain.value = 0.9;
    odmev.connect(og).connect(g);
    return [g, odmev];
  }

  // iPhone s stikalom za tiho zvonjenje utiša Web Audio. Brskalniku povemo, da je to predvajanje
  // (novejši Safari), starejšim pa zavrtimo tiho zanko <audio>, ki preklopi zvok na zvočnik.
  let tihaZanka = null;
  function tihaWav() {
    const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const str = (o, t) => [...t].forEach((ch, i) => b[o + i] = ch.charCodeAt(0));
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
    let bin = ''; b.forEach(x => bin += String.fromCharCode(x));
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function naZvocnik() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
    } catch (_) {}
    if (!/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
    if (!tihaZanka) {
      tihaZanka = document.createElement('audio');
      tihaZanka.setAttribute('x-webkit-airplay', 'deny');
      tihaZanka.loop = true;
      tihaZanka.src = tihaWav();
    }
    if (tihaZanka.paused) tihaZanka.play().catch(() => {});
  }

  function zbudi() {
    naZvocnik();
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const komp = ctx.createDynamicsCompressor();
      komp.threshold.value = -14;
      komp.knee.value = 10;
      komp.ratio.value = 4;
      komp.attack.value = 0.004;
      komp.release.value = 0.2;
      const glavni = ctx.createGain();
      glavni.gain.value = 0.85;
      glavni.connect(komp).connect(ctx.destination);
      [efekti, odmevE] = kanal(vklopljen ? 0.7 : 0, glavni, 1.6);
      [glasba, odmevG] = kanal(0, glavni, 2.4); // glasnost glasbe upravlja Glasba
      sum = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = sum.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      obZagonu.forEach(f => f());
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  ['pointerdown', 'touchend', 'click'].forEach(d => window.addEventListener(d, zbudi, { passive: true }));
  // ko je zavihek skrit, zvok počiva (telefon v žepu, druga aplikacija)
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); if (tihaZanka) tihaZanka.pause(); }
    else { ctx.resume().catch(() => {}); if (tihaZanka) tihaZanka.play().catch(() => {}); }
  });

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const nakl = (a, b) => a + Math.random() * (b - a);

  // ---------- Gradniki ----------

  // Ton z ovojnico; f lahko drsi do doF, 'odmev' je delež v odmev
  function ton({ f, doF = f, tip = 'sine', t = 0.15, g = 0.3, cez = 0, napad = 0.008, odmev = 0, filter = 0, vib = 0 }) {
    if (!vklopljen || !zbudi()) return;
    const zac = ctx.currentTime + cez;
    const o = ctx.createOscillator();
    const v = ctx.createGain();
    o.type = tip;
    o.frequency.setValueAtTime(f, zac);
    if (doF !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, doF), zac + t);
    if (vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = f * vib;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(zac); lfo.stop(zac + t + 0.05);
    }
    v.gain.setValueAtTime(0.0001, zac);
    v.gain.exponentialRampToValueAtTime(g, zac + napad);
    v.gain.exponentialRampToValueAtTime(0.0001, zac + t);
    let zadnji = o;
    if (filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = filter;
      o.connect(fl);
      zadnji = fl;
    }
    zadnji.connect(v).connect(efekti);
    if (odmev) { const s = ctx.createGain(); s.gain.value = odmev; v.connect(s).connect(odmevE); }
    o.start(zac);
    o.stop(zac + t + 0.05);
  }

  // Šum skozi pasovni filter, ki drsi od 'od' do 'do'
  function sumi({ t = 0.3, g = 0.2, od = 2000, do: doF = 300, cez = 0, q = 1, tip = 'bandpass', napad = 0.005, odmev = 0 }) {
    if (!vklopljen || !zbudi()) return;
    const zac = ctx.currentTime + cez;
    const src = ctx.createBufferSource();
    src.buffer = sum;
    const fl = ctx.createBiquadFilter();
    fl.type = tip;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(od, zac);
    fl.frequency.exponentialRampToValueAtTime(doF, zac + t);
    const v = ctx.createGain();
    v.gain.setValueAtTime(0.0001, zac);
    v.gain.exponentialRampToValueAtTime(g, zac + napad);
    v.gain.exponentialRampToValueAtTime(0.0001, zac + t);
    src.connect(fl).connect(v).connect(efekti);
    if (odmev) { const s = ctx.createGain(); s.gain.value = odmev; v.connect(s).connect(odmevE); }
    src.start(zac, Math.random() * 1.5);
    src.stop(zac + t + 0.05);
  }

  // Zvonček (FM): svetel, iskriv, z odmevom
  function zvoncek(f, { t = 0.9, g = 0.12, cez = 0, odmev = 0.35, razmerje = 3.5 } = {}) {
    if (!vklopljen || !zbudi()) return;
    const zac = ctx.currentTime + cez;
    const nos = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), v = ctx.createGain();
    nos.frequency.value = f;
    mod.frequency.value = f * razmerje;
    mg.gain.setValueAtTime(f * 2.2, zac);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, zac + t * 0.7);
    mod.connect(mg).connect(nos.frequency);
    v.gain.setValueAtTime(0.0001, zac);
    v.gain.exponentialRampToValueAtTime(g, zac + 0.004);
    v.gain.exponentialRampToValueAtTime(0.0001, zac + t);
    nos.connect(v).connect(efekti);
    const s = ctx.createGain(); s.gain.value = odmev; v.connect(s).connect(odmevE);
    nos.start(zac); mod.start(zac);
    nos.stop(zac + t + 0.05); mod.stop(zac + t + 0.05);
  }

  // Pihala za fanfaro: trije razglašeni žagasti toni skozi filter, ki se odpre
  function trobila(midi, { t = 0.2, g = 0.09, cez = 0 } = {}) {
    if (!vklopljen || !zbudi()) return;
    const zac = ctx.currentTime + cez, f = mtof(midi);
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 2;
    fl.frequency.setValueAtTime(500, zac);
    fl.frequency.exponentialRampToValueAtTime(3200, zac + 0.05);
    fl.frequency.exponentialRampToValueAtTime(1200, zac + t);
    const v = ctx.createGain();
    v.gain.setValueAtTime(0.0001, zac);
    v.gain.exponentialRampToValueAtTime(g, zac + 0.02);
    v.gain.setValueAtTime(g, zac + t * 0.7);
    v.gain.exponentialRampToValueAtTime(0.0001, zac + t + 0.08);
    fl.connect(v).connect(efekti);
    const s = ctx.createGain(); s.gain.value = 0.25; v.connect(s).connect(odmevE);
    [-8, 0, 7].forEach(c => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = c;
      o.connect(fl);
      o.start(zac); o.stop(zac + t + 0.12);
    });
  }

  // Note pentatonike, ki jo trenutno igra glasba (če glasbe ni, C-dur)
  const note = od => (typeof Glasba !== 'undefined' ? Glasba.lestvica(od) : [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26].map(i => od + i));

  // ---------- Učinki ----------

  return {
    get vklopljen() { return vklopljen; },
    nastavi(b) {
      vklopljen = b;
      try { localStorage.setItem(KLJUC, vklopljen ? '1' : '0'); } catch (_) {}
      if (ctx) efekti.gain.setTargetAtTime(vklopljen ? 0.7 : 0, ctx.currentTime, 0.05);
      if (vklopljen) this.klik();
    },
    // za glasbo: skupni kontekst, njen kanal, odmev in šum
    jedro() { return zbudi() ? { ctx, izhod: glasba, odmev: odmevG, sum } : null; },
    obZagonu(f) { if (ctx) f(); else obZagonu.push(f); },

    // lesen klik gumba
    klik() {
      ton({ f: nakl(1150, 1250), doF: 1700, tip: 'triangle', t: 0.05, g: 0.1 });
      sumi({ t: 0.03, g: 0.05, od: 4000, do: 3000, q: 2 });
    },
    // menjava: kratek »vuš« in mehak plink
    menjava() {
      sumi({ t: 0.16, g: 0.09, od: 500, do: 3200, q: 1.2 });
      ton({ f: nakl(480, 520), doF: 820, t: 0.07, g: 0.07, cez: 0.02 });
    },
    // napačna poteza: gumijast »bonk«, ne nadležen brenčač
    ne() {
      ton({ f: 300, doF: 190, tip: 'triangle', t: 0.13, g: 0.16, filter: 900 });
      ton({ f: 230, doF: 150, tip: 'triangle', t: 0.16, g: 0.13, cez: 0.1, filter: 800 });
    },
    // pok: mehurček v tonaliteti glasbe, z vsakim kombom višji ton
    pok(kombo = 1) {
      const n = note(67);
      const m = n[Math.min(n.length - 1, (kombo - 1) * 2 + Math.floor(Math.random() * 2))];
      const f = mtof(m) * Math.pow(2, nakl(-8, 8) / 1200);
      ton({ f: f * 0.55, doF: f, t: 0.05, g: 0.22, napad: 0.003 });
      ton({ f, doF: f * 0.98, tip: 'triangle', t: 0.18, g: 0.12, cez: 0.03 });
      zvoncek(f * 2, { t: 0.5, g: 0.04 + Math.min(kombo, 5) * 0.012, cez: 0.03 });
      sumi({ t: 0.04, g: 0.06, od: 6000, do: 3000, q: 1.5 });
    },
    // gong / pojoča skleda iz joga studia: mehki delni toni z dolgim izzvenevanjem
    gong(g = 0.1) {
      const f = typeof Glasba !== 'undefined' ? 440 * Math.pow(2, (Glasba.lestvica(45)[0] - 69) / 12) : 110;
      ton({ f, t: 6, g, napad: 0.04, odmev: 0.5 });
      ton({ f: f * 1.004, t: 5.5, g: g * 0.6, napad: 0.05, odmev: 0.5 });
      ton({ f: f * 2.76, t: 3.6, g: g * 0.3, napad: 0.03, odmev: 0.6 });
      ton({ f: f * 5.4, t: 1.8, g: g * 0.1, napad: 0.02, odmev: 0.6 });
    },
    // naboj pred Dorino eksplozijo: hiter dvig tona
    polni() {
      ton({ f: 220, doF: 1800, tip: 'sawtooth', t: 0.26, g: 0.07, filter: 2500 });
      ton({ f: 110, doF: 440, tip: 'square', t: 0.26, g: 0.04, filter: 900 });
    },
    // Dora: laserski »piu« + padajoč bas + iskre
    dora() {
      ton({ f: 2200, doF: 140, tip: 'sawtooth', t: 0.42, g: 0.13, filter: 3500 });
      ton({ f: 130, doF: 38, t: 0.55, g: 0.45, napad: 0.004 });
      sumi({ t: 0.5, g: 0.28, od: 7000, do: 300, q: 0.7 });
      const n = note(79);
      [0, 2, 4, 6].forEach((k, i) => zvoncek(mtof(n[k]), { t: 0.5, g: 0.05, cez: 0.18 + i * 0.05 }));
    },
    // Prožen laserski »piu« ob vsakem zadetku vrtinca.
    laserskiZadetek(i = 0) {
      const n = note(74), f = mtof(n[i % n.length]);
      ton({ f: f * 1.8, doF: f * 0.5, tip: 'triangle', t: 0.13, g: 0.09, napad: 0.003 });
      sumi({ t: 0.05, g: 0.04, od: 4200, do: 1100, q: 2 });
    },
    // nova Dora: čaroben arpeggio navzgor
    nastala() {
      const n = note(72);
      [0, 1, 2, 3, 4, 5].forEach((k, i) => zvoncek(mtof(n[k]), { t: 0.6, g: 0.06, cez: i * 0.045 }));
      sumi({ t: 0.5, g: 0.05, od: 8000, do: 12000, q: 0.8, cez: 0.1, tip: 'highpass' });
    },
    // zvezdica: zvonček in lesk; vsaka naslednja višje
    zvezda(i = 0) {
      const n = note(76);
      const m = n[Math.min(n.length - 1, 2 + i * 2)];
      zvoncek(mtof(m), { t: 1.1, g: 0.13 });
      zvoncek(mtof(m + 12), { t: 0.8, g: 0.05, cez: 0.05 });
      sumi({ t: 0.35, g: 0.05, od: 9000, do: 6000, q: 1, cez: 0.03, tip: 'highpass' });
    },
    // bonus potez: kovanček, ki leze po lestvici
    bonus(i = 0) {
      const n = note(72), m = n[i % n.length];
      ton({ f: mtof(m), tip: 'square', t: 0.06, g: 0.05, filter: 3000 });
      ton({ f: mtof(m + 7), tip: 'square', t: 0.09, g: 0.05, cez: 0.05, filter: 3000 });
    },
    // Lasten kratek kitarski motiv za Vladovo proslavo (brez posnetka ali citata pesmi).
    kitara() {
      if (typeof Glasba !== 'undefined') Glasba.utisaj(2.5);
      const n = note(55);
      [0, 2, 4, 6, 4, 2, 0].forEach((k, i) => {
        const f = mtof(n[k]), cez = i * 0.16;
        ton({ f, tip: 'triangle', t: 0.65, g: 0.14, cez, napad: 0.003, filter: 2600, odmev: 0.15 });
        ton({ f: f * 2, t: 0.22, g: 0.035, cez, napad: 0.002 });
        sumi({ t: 0.025, g: 0.025, od: 3600, do: 1100, cez, q: 1.2 });
      });
      [0, 2, 4].forEach((k, i) => ton({ f: mtof(n[k]), tip: 'triangle', t: 1.1, g: 0.1, cez: 1.35 + i * 0.04, napad: 0.003, odmev: 0.25 }));
    },
    // zmaga: funky fanfara pihal v tonaliteti glasbe
    zmaga() {
      if (typeof Glasba !== 'undefined') Glasba.utisaj(3.2);
      const k = note(60)[0];
      [[7, 0, 0.1], [7, 0.12, 0.1], [9, 0.24, 0.1], [12, 0.42, 0.55], [10, 0.98, 0.12], [12, 1.12, 0.12], [19, 1.28, 0.7]]
        .forEach(([i, c, t]) => trobila(k + i, { t, cez: c }));
      [0, 4, 7].forEach(i => trobila(k + i - 12, { t: 0.55, g: 0.05, cez: 0.42 }));
      sumi({ t: 1.4, g: 0.08, od: 6000, do: 4000, cez: 0.42, tip: 'highpass' });
    },
    // poraz: žalosten pozavn »va va va vaaa« (s humorjem)
    poraz() {
      if (typeof Glasba !== 'undefined') Glasba.utisaj(2.6);
      [[0, 0], [-1, 0.32], [-2, 0.64]].forEach(([p, c]) =>
        ton({ f: mtof(58 + p), doF: mtof(57.6 + p), tip: 'sawtooth', t: 0.3, g: 0.09, cez: c, filter: 1100, napad: 0.03 }));
      ton({ f: mtof(55), doF: mtof(54), tip: 'sawtooth', t: 1.1, g: 0.09, cez: 0.96, filter: 1000, napad: 0.03, vib: 0.03 });
    },
    // pljusk ob vstopu čolna: šum vode in nekaj mehurčkov
    pljusk() {
      sumi({ t: 0.7, g: 0.16, od: 1400, do: 200, q: 0.7, tip: 'lowpass' });
      for (let i = 0; i < 5; i++) {
        const f = nakl(500, 1100);
        ton({ f, doF: f * 1.8, t: 0.06, g: 0.05, cez: 0.1 + i * nakl(0.04, 0.09) });
      }
    },
    // odklenjena stopnja: vuš navzgor in zvončki
    odklep() {
      sumi({ t: 0.5, g: 0.08, od: 400, do: 5000, q: 1.5 });
      const n = note(72);
      [0, 2, 4, 5, 7].forEach((k, i) => zvoncek(mtof(n[k]), { t: 0.8, g: 0.07, cez: 0.2 + i * 0.07 }));
    },
    // Tupko: mijav (glas z dvema formantoma, ki se odpreta in zapreta)
    mjav() {
      if (!vklopljen || !zbudi()) return;
      const zac = ctx.currentTime, t = nakl(0.45, 0.7), f0 = nakl(520, 700);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * 0.8, zac);
      o.frequency.linearRampToValueAtTime(f0 * 1.15, zac + t * 0.35);
      o.frequency.linearRampToValueAtTime(f0 * 0.7, zac + t);
      const v = ctx.createGain();
      v.gain.setValueAtTime(0.0001, zac);
      v.gain.exponentialRampToValueAtTime(0.16, zac + 0.05);
      v.gain.setValueAtTime(0.16, zac + t * 0.6);
      v.gain.exponentialRampToValueAtTime(0.0001, zac + t);
      [[[700, 1600, 900], 6], [[1400, 2600, 1300], 8]].forEach(([[a, b, c], q]) => {
        const fl = ctx.createBiquadFilter();
        fl.type = 'bandpass';
        fl.Q.value = q;
        fl.frequency.setValueAtTime(a, zac);
        fl.frequency.linearRampToValueAtTime(b, zac + t * 0.35);
        fl.frequency.linearRampToValueAtTime(c, zac + t);
        o.connect(fl).connect(v);
      });
      v.connect(efekti);
      const s = ctx.createGain(); s.gain.value = 0.2; v.connect(s).connect(odmevE);
      o.start(zac); o.stop(zac + t + 0.05);
    },
  };
})();
