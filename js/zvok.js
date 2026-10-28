// Zvočni učinki, sintetizirani z Web Audio (brez zvočnih datotek).
// Zvok se vklopi ob prvem dotiku (zahteva brskalnikov); gumb 🔊/🔇 ga utiša.

const Zvok = (() => {
  const KLJUC = 'dorin-kras-zvok';
  let ctx = null, glavni = null;
  let vklopljen = true;
  try { vklopljen = localStorage.getItem(KLJUC) !== '0'; } catch (_) {}

  function zbudi() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      glavni = ctx.createGain();
      glavni.gain.value = 0.5;
      glavni.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  window.addEventListener('pointerdown', zbudi, { passive: true });

  // En ton: frekvenca (lahko drsi do 'do'), oblika, trajanje, glasnost, zamik
  function ton({ f, doF = f, tip = 'sine', t = 0.15, g = 0.3, cez = 0 }) {
    if (!vklopljen || !zbudi()) return;
    const zac = ctx.currentTime + cez;
    const o = ctx.createOscillator();
    const v = ctx.createGain();
    o.type = tip;
    o.frequency.setValueAtTime(f, zac);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, doF), zac + t);
    v.gain.setValueAtTime(0.0001, zac);
    v.gain.exponentialRampToValueAtTime(g, zac + 0.012);
    v.gain.exponentialRampToValueAtTime(0.0001, zac + t);
    o.connect(v).connect(glavni);
    o.start(zac);
    o.stop(zac + t + 0.02);
  }

  function sum({ t = 0.3, g = 0.2, od = 2000, do: doF = 300, cez = 0 }) {
    if (!vklopljen || !zbudi()) return;
    const zac = ctx.currentTime + cez;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * t), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(od, zac);
    filter.frequency.exponentialRampToValueAtTime(doF, zac + t);
    const v = ctx.createGain();
    v.gain.setValueAtTime(g, zac);
    v.gain.exponentialRampToValueAtTime(0.0001, zac + t);
    src.connect(filter).connect(v).connect(glavni);
    src.start(zac);
  }

  const LESTVICA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];

  return {
    get vklopljen() { return vklopljen; },
    preklopi() {
      vklopljen = !vklopljen;
      try { localStorage.setItem(KLJUC, vklopljen ? '1' : '0'); } catch (_) {}
      if (vklopljen) this.klik();
      return vklopljen;
    },
    klik() { ton({ f: 900, doF: 1300, tip: 'triangle', t: 0.07, g: 0.2 }); },
    menjava() { sum({ t: 0.12, g: 0.12, od: 800, do: 2400 }); },
    ne() { ton({ f: 220, doF: 160, tip: 'square', t: 0.12, g: 0.08 }); ton({ f: 200, doF: 140, tip: 'square', t: 0.12, g: 0.08, cez: 0.13 }); },
    // pok: višji ton z vsakim kombom
    pok(kombo = 1) {
      const f = LESTVICA[Math.min(kombo - 1, LESTVICA.length - 1)];
      ton({ f, doF: f * 1.5, tip: 'triangle', t: 0.16, g: 0.28 });
      ton({ f: f * 2, doF: f * 2.5, tip: 'sine', t: 0.1, g: 0.12, cez: 0.03 });
    },
    dora() {
      sum({ t: 0.5, g: 0.35, od: 6000, do: 200 });
      ton({ f: 1600, doF: 90, tip: 'sawtooth', t: 0.45, g: 0.15 });
    },
    nastala() { [880, 1175, 1568].forEach((f, i) => ton({ f, tip: 'triangle', t: 0.18, g: 0.2, cez: i * 0.07 })); },
    zvezda(i = 0) {
      const f = [784, 988, 1319][i] || 1319;
      ton({ f, doF: f * 1.02, tip: 'triangle', t: 0.35, g: 0.3 });
      ton({ f: f * 1.5, tip: 'sine', t: 0.3, g: 0.12, cez: 0.05 });
    },
    bonus(i = 0) { const f = 600 + i * 70; ton({ f, doF: f * 1.6, tip: 'square', t: 0.09, g: 0.07 }); },
    zmaga() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
        ton({ f, tip: 'triangle', t: i === 6 ? 0.6 : 0.16, g: 0.25, cez: i * 0.11 }));
    },
    poraz() { [392, 349, 311, 262].forEach((f, i) => ton({ f, tip: 'triangle', t: 0.3, g: 0.2, cez: i * 0.2 })); },
    pljusk() { sum({ t: 0.6, g: 0.18, od: 1200, do: 250 }); },
    odklep() {
      [659, 880, 1109, 1319].forEach((f, i) => ton({ f, tip: 'triangle', t: 0.25, g: 0.22, cez: i * 0.08 }));
      sum({ t: 0.4, g: 0.1, od: 5000, do: 3000, cez: 0.25 });
    },
  };
})();
