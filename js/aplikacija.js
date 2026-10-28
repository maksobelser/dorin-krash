// Zasloni, zemljevid ob Grosupeljščici, življenja, shranjevanje, proslave, odštevalnik.

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');

// ---------- Shranjevanje (samo v tem brskalniku) ----------

const KLJUC = 'dorin-kras';
let napredek = { odklenjeno: 1, zvezdice: {}, zivljenja: ZIVLJENJA.najvec, obnova: Date.now() };
try {
  const shranjeno = JSON.parse(localStorage.getItem(KLJUC));
  if (shranjeno) napredek = { ...napredek, ...shranjeno };
} catch (_) {}

function shrani() {
  try { localStorage.setItem(KLJUC, JSON.stringify(napredek)); } catch (_) {}
}

// ---------- Življenja ----------

const OBNOVA_MS = ZIVLJENJA.obnovaMinut * 60 * 1000;

function obnoviZivljenja() {
  const zdaj = Date.now();
  if (napredek.zivljenja >= ZIVLJENJA.najvec) {
    napredek.obnova = zdaj;
    return;
  }
  while (napredek.zivljenja < ZIVLJENJA.najvec && zdaj - napredek.obnova >= OBNOVA_MS) {
    napredek.zivljenja++;
    napredek.obnova += OBNOVA_MS;
  }
  if (napredek.zivljenja >= ZIVLJENJA.najvec) napredek.obnova = zdaj;
  shrani();
}

function doNaslednjega() {
  const ms = Math.max(0, OBNOVA_MS - (Date.now() - napredek.obnova));
  const s = Math.ceil(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function izgubiZivljenje() {
  obnoviZivljenja();
  if (napredek.zivljenja >= ZIVLJENJA.najvec) napredek.obnova = Date.now();
  napredek.zivljenja = Math.max(0, napredek.zivljenja - 1);
  shrani();
}

function osveziZivljenja() {
  obnoviZivljenja();
  $('zivljenja-st').textContent = napredek.zivljenja;
  $('zivljenja-ura').textContent = napredek.zivljenja >= ZIVLJENJA.najvec ? 'polno' : '+1 čez ' + doNaslednjega();
}
setInterval(osveziZivljenja, 1000);

// ---------- Zasloni ----------

function pokazi(ime) {
  document.querySelectorAll('.zaslon').forEach(z => z.classList.toggle('aktiven', z.id === 'zaslon-' + ime));
  document.body.dataset.zaslon = ime;
}

function vsebina(e) {
  if (e.slika) return `<img src="${e.slika}" alt="${e.ime || ''}" draggable="false">`;
  return e.emoji || e.ime;
}

// ---------- Okno (sporočila) ----------

function okno({ naslov, besedilo = '', zvezdice = null, gumbi }) {
  $('okno-naslov').textContent = naslov;
  $('okno-besedilo').innerHTML = besedilo;
  $('okno-zvezdice').innerHTML = zvezdice === null ? '' :
    [0, 1, 2].map(i => `<span class="${i < zvezdice ? 'polna' : ''}">★</span>`).join('');
  const g = $('okno-gumbi');
  g.innerHTML = '';
  gumbi.forEach(({ tekst, akcija, drugotni }) => {
    const b = document.createElement('button');
    b.textContent = tekst;
    if (drugotni) b.className = 'drugotni';
    b.addEventListener('click', () => { zapriOkno(); akcija && akcija(); });
    g.appendChild(b);
  });
  $('okno').classList.add('odprto');
}

function zapriOkno() { $('okno').classList.remove('odprto'); }

// ---------- Proslava ----------

let stProslave = 0;
function proslava() {
  const p = PROSLAVE[stProslave++ % PROSLAVE.length];
  const el = $('proslava');
  el.innerHTML = `<div class="proslava-lik ${p.animacija}">${vsebina(p)}</div><div class="proslava-napis">${p.besedilo}</div>`;
  el.classList.add('odprto');
  return new Promise(resolve => {
    const konec = () => { el.classList.remove('odprto'); el.onclick = null; clearTimeout(t); resolve(); };
    const t = setTimeout(konec, 2600);
    el.onclick = konec;
  });
}

// ---------- Zemljevid ----------

const KORAK = 120, SPODAJ = 170, ZGORAJ = 70;
let prejsnjiKanu = null;

function tockaZemljevida(i, visina) {
  return { x: 50 + 28 * Math.sin(i * 1.1), y: visina - SPODAJ - i * KORAK };
}

function narisiZemljevid() {
  const n = STOPNJE.length;
  const visina = SPODAJ + n * KORAK + ZGORAJ;
  const z = $('zemljevid');
  z.style.height = visina + 'px';

  // Točke: -1 = dom, 0..n-1 = stopnje, n = zastavica
  const tocke = [];
  for (let i = -1; i <= n; i++) tocke.push(tockaZemljevida(i, visina));
  let d = `M ${tocke[0].x} ${visina} L ${tocke[0].x} ${tocke[0].y}`;
  for (let i = 1; i < tocke.length; i++) {
    const a = tocke[i - 1], b = tocke[i], sy = (a.y + b.y) / 2;
    d += ` C ${a.x} ${sy}, ${b.x} ${sy}, ${b.x} ${b.y}`;
  }
  let html = `<svg class="reka" viewBox="0 0 100 ${visina}" preserveAspectRatio="none">
    <path d="${d}" class="reka-breg"/><path d="${d}" class="reka-voda"/><path d="${d}" class="reka-tok"/></svg>`;

  const dom = tocke[0];
  html += `<div class="dom" style="left:${dom.x}%;top:${dom.y}px"><span class="hisa">🏡</span>
    <span class="lik">${vsebina(MIRT)}<small>${MIRT.ime}</small></span></div>`;
  html += `<div class="napis-reka" style="top:${dom.y + 45}px">Grosupeljščica</div>`;

  STOPNJE.forEach((_, i) => {
    const t = tocke[i + 1], st = i + 1;
    const odklenjena = st <= napredek.odklenjeno;
    const zv = napredek.zvezdice[st] || 0;
    const stran = t.x < 50 ? 1 : -1;
    html += `<button class="hisica ${odklenjena ? '' : 'zaklenjena'} ${st === napredek.odklenjeno ? 'trenutna' : ''}"
      data-st="${st}" style="left:${t.x}%;top:${t.y}px">
      <span class="hisa">🏠</span><span class="st">${odklenjena ? st : '🔒'}</span>
      <span class="zv">${[0, 1, 2].map(k => (k < zv ? '★' : '☆')).join('')}</span></button>`;
    const poza = TUPKO_POZE[i % TUPKO_POZE.length];
    html += `<div class="tupko" style="left:${t.x + stran * 22}%;top:${t.y}px">${vsebina(poza)}</div>`;
  });

  const cilj = tocke[tocke.length - 1];
  html += `<div class="zastavica" style="left:${cilj.x}%;top:${cilj.y}px">🚩</div>`;
  html += `<div class="kanu" id="kanu"><span class="dora-kanu">${vsebina(DORA)}</span>🛶</div>`;
  z.innerHTML = html;

  z.querySelectorAll('.hisica').forEach(b => b.addEventListener('click', () => {
    const st = +b.dataset.st;
    if (st <= napredek.odklenjeno) zacniStopnjo(st);
  }));

  // Kanu pri trenutni stopnji; po zmagi odpluje od prejšnje
  const kanu = $('kanu');
  const tr = Math.min(napredek.odklenjeno, n);
  const postaviKanu = st => {
    const t = tocke[st];
    kanu.style.left = t.x + '%';
    kanu.style.top = (t.y + 64) + 'px';
  };
  if (prejsnjiKanu && prejsnjiKanu !== tr) {
    kanu.style.transition = 'none';
    postaviKanu(prejsnjiKanu);
    void kanu.offsetWidth;
    kanu.style.transition = '';
    setTimeout(() => postaviKanu(tr), 400);
  } else {
    postaviKanu(tr);
  }
  prejsnjiKanu = tr;

  const ovoj = $('zemljevid-ovoj');
  requestAnimationFrame(() => {
    ovoj.scrollTop = tocke[tr].y - ovoj.clientHeight / 2;
  });
}

function odpriZemljevid() {
  pokazi('zemljevid');
  osveziZivljenja();
  narisiZemljevid();
}

// ---------- Stopnja ----------

let trenutna = null;

function zacniStopnjo(st) {
  osveziZivljenja();
  if (napredek.zivljenja <= 0) {
    okno({
      naslov: 'Ni več življenj 💔',
      besedilo: `Naslednje življenje dobiš čez <b>${doNaslednjega()}</b>.<br>Lahko pa prosiš prijatelje.`,
      gumbi: [
        { tekst: 'Prosi prijatelje', akcija: prosiPrijatelje },
        { tekst: 'Zapri', drugotni: true },
      ],
    });
    return;
  }
  trenutna = st;
  const s = STOPNJE[st - 1];
  $('hud-stopnja').textContent = st;
  $('hud-cilj').textContent = s.cilj;
  pokazi('igra');
  Plosca.zacni(s, {
    tocke: n => {
      $('hud-tocke').textContent = n;
      $('napredek-polnilo').style.width = Math.min(100, n / (s.cilj * ZVEZDICE[2]) * 100) + '%';
    },
    poteze: n => { $('hud-poteze').textContent = n; },
    konec: zmaga => (zmaga ? zmagal(st) : izgubil(st)),
  });
  document.querySelectorAll('.napredek-zvezda').forEach((z, i) => {
    z.style.left = (ZVEZDICE[i] / ZVEZDICE[2] * 100) + '%';
  });
}

async function zmagal(st) {
  const s = STOPNJE[st - 1];
  const stanje = Plosca.stanje();
  const bonus = stanje.poteze * BONUS_ZA_POTEZO;
  const tocke = stanje.tocke + bonus;
  $('hud-tocke').textContent = tocke;
  const zv = ZVEZDICE.filter(m => tocke >= s.cilj * m).length;
  napredek.zvezdice[st] = Math.max(napredek.zvezdice[st] || 0, zv);
  if (st >= napredek.odklenjeno && st < STOPNJE.length) napredek.odklenjeno = st + 1;
  shrani();
  await sleep(500);
  await proslava();
  const zadnja = st === STOPNJE.length;
  okno({
    naslov: zadnja ? 'Dora je priveslala do konca! 🚩' : `Stopnja ${st} opravljena!`,
    besedilo: `${tocke} točk` + (bonus ? ` (bonus za poteze: ${bonus})` : ''),
    zvezdice: zv,
    gumbi: [
      { tekst: zadnja ? 'Na zemljevid' : 'Naprej', akcija: odpriZemljevid },
      { tekst: 'Ponovi', drugotni: true, akcija: () => zacniStopnjo(st) },
    ],
  });
}

function izgubil(st) {
  const s = STOPNJE[st - 1];
  izgubiZivljenje();
  const manjka = s.cilj - Plosca.stanje().tocke;
  okno({
    naslov: 'Zmanjkalo je potez',
    besedilo: `Manjkalo je še ${manjka} točk.<br>Življenja: ${napredek.zivljenja} ❤️`,
    gumbi: [
      { tekst: 'Poskusi znova', akcija: () => zacniStopnjo(st) },
      { tekst: 'Zemljevid', drugotni: true, akcija: odpriZemljevid },
    ],
  });
}

function zapustiStopnjo() {
  const stanje = Plosca.stanje();
  const s = STOPNJE[trenutna - 1];
  if (!stanje || stanje.konec || stanje.poteze === s.poteze) {
    Plosca.ustavi();
    odpriZemljevid();
    return;
  }
  okno({
    naslov: 'Zapustiš stopnjo?',
    besedilo: 'Izgubiš eno življenje.',
    gumbi: [
      { tekst: 'Igraj naprej' },
      { tekst: 'Zapusti', drugotni: true, akcija: () => { Plosca.ustavi(); izgubiZivljenje(); odpriZemljevid(); } },
    ],
  });
}

async function prosiPrijatelje() {
  const podatki = { title: 'Dorin Kraš', text: 'Pošlji mi življenje v Dorinem Krašu! ❤️', url: location.href };
  try {
    if (navigator.share) await navigator.share(podatki);
    else await navigator.clipboard.writeText(`${podatki.text} ${podatki.url}`);
  } catch (_) {}
}

// ---------- Odštevalnik na vstopnem zaslonu ----------

// Sobota, 31. oktober 2026, ob 18:00 (lokalni čas)
const BIRTHDAY = new Date(2026, 9, 31, 18, 0, 0);
// Začetek odštevanja: torek, 27. oktober 2026, ob 20:49
const START = new Date(2026, 9, 27, 20, 49, 0);

function tick() {
  const left = BIRTHDAY - Date.now();
  if (left <= 0) {
    document.body.classList.add('done');
    return;
  }
  const sec = Math.floor(left / 1000);
  $('d').textContent = Math.floor(sec / 86400);
  $('h').textContent = pad(Math.floor(sec / 3600) % 24);
  $('m').textContent = pad(Math.floor(sec / 60) % 60);
  $('s').textContent = pad(sec % 60);
  const done = Math.min(1, Math.max(0, (Date.now() - START) / (BIRTHDAY - START)));
  $('bar').style.width = (done * 100).toFixed(2) + '%';
  setTimeout(tick, 1000 - (Date.now() % 1000));
}

// ---------- Zagon ----------

tick();

const sky = $('sky');
for (let i = 0; i < 18; i++) {
  const d = document.createElement('div');
  d.className = 'drop';
  d.style.left = Math.random() * 100 + 'vw';
  d.style.setProperty('--s', 18 + Math.random() * 22 + 'px');
  d.style.setProperty('--d', 6 + Math.random() * 8 + 's');
  d.style.setProperty('--delay', -Math.random() * 14 + 's');
  d.innerHTML = '<div class="candy c' + (i % 6) + '"></div>';
  sky.appendChild(d);
}

Plosca.init($('plosca'), $('plosca-ovoj'));
$('play').addEventListener('click', odpriZemljevid);
$('nazaj-vstop').addEventListener('click', () => pokazi('vstop'));
$('nazaj-zemljevid').addEventListener('click', zapustiStopnjo);
osveziZivljenja();
