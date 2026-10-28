// Lestvica: Vercel funkcija, ki shranjuje rezultate v Upstash Redis (prek REST, brez npm paketov).
// Naslov in žeton baze pridejo iz okolja (Vercel → Storage → Upstash Redis → poveži s projektom).
// Brez njiju funkcija vrne 503 in igra pokaže samo rezultate s tega telefona.
//
// GET  /api/lestvica          → { igralci: [{ id, ime, zvezdice, tocke, stopnja }] } (najboljših 50)
// POST /api/lestvica  { id, ime, zvezdice, tocke, stopnja } → shrani in vrne lestvico

const URL_BAZE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const ZETON = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const RANG = 'dorin-kras:lestvica';    // urejena množica: točkovanje = zvezdice * 1e7 + točke
const PODATKI = 'dorin-kras:igralci';  // zgoščena tabela: id → JSON
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

async function preberi() {
  const [idji] = await redis([['ZREVRANGE', RANG, '0', String(NAJVEC - 1)]]);
  if (!idji || !idji.length) return [];
  const [vrstice] = await redis([['HMGET', PODATKI, ...idji]]);
  return vrstice.map((v, i) => {
    try { return { id: idji[i], ...JSON.parse(v) }; } catch (_) { return null; }
  }).filter(Boolean);
}

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
      const igralec = {
        ime,
        zvezdice: celo(b.zvezdice, 3 * 60),
        tocke: celo(b.tocke, 60 * 50000),
        stopnja: celo(b.stopnja, 60),
      };
      await redis([
        ['HSET', PODATKI, id, JSON.stringify(igralec)],
        ['ZADD', RANG, String(igralec.zvezdice * 1e7 + igralec.tocke), id],
      ]);
    } else if (req.method !== 'GET') {
      return res.status(405).json({ napaka: 'samo-get-ali-post' });
    }
    return res.status(200).json({ igralci: await preberi() });
  } catch (e) {
    return res.status(502).json({ napaka: 'baza-ne-odgovarja' });
  }
};
