// Lestvica: Vercel funkcija, ki shranjuje rezultate v Upstash Redis (prek REST, brez npm paketov).
// Naslov in žeton baze pridejo iz okolja (Vercel → Storage → Upstash Redis → poveži s projektom).
// Brez njiju funkcija vrne 503 in igra pokaže samo rezultate s tega telefona.
//
// GET  /api/lestvica          → { igralci: [{ id, ime, zvezdice, tocke, stopnja }] } (najboljših 50)
// POST /api/lestvica  { id, ime, zvezdice, tocke, stopnja } → shrani in vrne { igralci, jaz }
//
// Eno ime = en igralec: »Nino«, »nino « in »Ninó« so isti vpis. Kdor se vpiše z imenom, ki že
// obstaja, piše v obstoječi vpis (ostane boljši rezultat), strežnik pa mu vrne njegov id (jaz).

const URL_BAZE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const ZETON = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const RANG = 'dorin-kras:lestvica';    // urejena množica: razvrščeno po točkah
const PODATKI = 'dorin-kras:igralci';  // zgoščena tabela: id → JSON
const IMENA = 'dorin-kras:imena';      // zgoščena tabela: poenoteno ime → id
const NAJVEC = 50;

async function redis(ukazi) {
  const odgovor = await fetch(`${URL_BAZE}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ZETON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(ukazi),
  });
  if (!odgovor.ok) throw new Error(`Redis ${odgovor.status}`);
  return (await odgovor.json()).map(r => r.result);
}

// Velike/male črke, presledki in strešice ne štejejo: Žan = zan.
const kljucImena = ime => ime.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const razberi = v => { try { return JSON.parse(v); } catch (_) { return null; } };

async function preberi() {
  const [idji] = await redis([['ZREVRANGE', RANG, '0', String(NAJVEC * 2 - 1)]]);
  if (!idji || !idji.length) return [];
  const [vrstice] = await redis([['HMGET', PODATKI, ...idji]]);
  // Stari dvojniki (pred združevanjem po imenu) ostanejo v bazi, pokaže se samo boljši.
  const videno = new Set();
  return vrstice.map((v, i) => ({ id: idji[i], ...razberi(v) }))
    .filter(p => p.ime && !videno.has(kljucImena(p.ime)) && videno.add(kljucImena(p.ime)))
    .slice(0, NAJVEC);
}

// Kateri id pripada imenu: iz tabele imen, sicer najboljši star vpis s tem imenom, sicer nov.
async function idZaIme(kljuc, predlagan) {
  const [znan] = await redis([['HGET', IMENA, kljuc]]);
  if (znan) return znan;
  const [vse] = await redis([['HGETALL', PODATKI]]);
  let najboljsi = null, tocke = -1, predlaganZaseden = false;
  for (let i = 0; i < (vse || []).length; i += 2) {
    const p = razberi(vse[i + 1]);
    if (!p || !p.ime) continue;
    if (kljucImena(p.ime) === kljuc) {
      if ((p.tocke || 0) > tocke) { najboljsi = vse[i]; tocke = p.tocke || 0; }
    } else if (vse[i] === predlagan) predlaganZaseden = true;
  }
  // Telefon, ki je prej igral pod drugim imenom, za novo ime dobi nov id (starega vpisa ne povozi).
  const id = najboljsi || (predlaganZaseden ? novId() : predlagan);
  await redis([['HSETNX', IMENA, kljuc, id]]);
  const [zmagal] = await redis([['HGET', IMENA, kljuc]]);
  return zmagal || id;
}

const novId = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');

const celo = (v, max) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_BAZE || !ZETON) return res.status(503).json({ napaka: 'lestvica-ni-povezana' });

  try {
    if (req.method === 'POST') {
      let b = req.body || {};
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
      const id = String(b.id || '');
      const ime = String(b.ime || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
      if (!/^[a-z0-9]{8,32}$/.test(id) || !ime) return res.status(400).json({ napaka: 'napacni-podatki' });
      const jaz = await idZaIme(kljucImena(ime), id);
      const [prej] = await redis([['HGET', PODATKI, jaz]]);
      const star = razberi(prej);
      const nov = {
        ime: star && star.ime ? star.ime : ime,
        zvezdice: celo(b.zvezdice, 3 * 60),
        tocke: celo(b.tocke, 60 * 50000),
        stopnja: celo(b.stopnja, 60),
      };
      // Isto ime z drugega telefona: ostane boljši rezultat.
      const igralec = star && (star.tocke || 0) > nov.tocke ? { ...star, ime: nov.ime } : nov;
      await redis([
        ['HSET', PODATKI, jaz, JSON.stringify(igralec)],
        ['ZADD', RANG, String(igralec.tocke), jaz],
      ]);
      return res.status(200).json({ igralci: await preberi(), jaz });
    } else if (req.method !== 'GET') {
      return res.status(405).json({ napaka: 'samo-get-ali-post' });
    }
    return res.status(200).json({ igralci: await preberi() });
  } catch (e) {
    return res.status(502).json({ napaka: 'baza-ne-odgovarja' });
  }
};
