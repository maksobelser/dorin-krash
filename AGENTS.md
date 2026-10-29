# Navodila za AI agente (Claude, Codex, Cursor …)

Projekt: **Dorin Kraš**, Dorin Candy Crush. Načrt je v `NACRT.md`, pravila sodelovanja v `README.md`.

## Tehnično

- Navaden HTML, CSS in JavaScript. Brez gradnje (build), brez npm paketov, brez ogrodij (framework).
- Izjema: three.js r128 s CDN (cdnjs) za 3D zemljevid in pisavi Lilita One ter Nunito z Google Fonts. Če WebGL ne dela, se pokaže 2D zemljevid.
- Stran se objavi na Vercelu kot statična stran. `index.html` mora ostati v korenu repoja.
- Izjema za strežnik: `api/lestvica.js` je Vercel funkcija za skupno lestvico (Upstash Redis prek REST, brez npm paketov). Naslov in žeton baze sta samo v okolju Vercela (`KV_REST_API_URL`, `KV_REST_API_TOKEN`), nikoli v repoju. Brez njiju igra pokaže samo rezultat tega telefona.
- Imena datotek z malimi črkami, brez presledkov in šumnikov (`kanu.png`, ne `Kanu.PNG`). Vercel razlikuje velike in male črke.
- Poti do slik in skript relativne (`slike/burek.png`, ne `/slike/burek.png`).
- Slike v mapi `slike/`, zvoki v `zvoki/`. Slike naj bodo majhne (PNG ali WebP, do ~200 KB).

## Igra

- Datoteke: `index.html` (zasloni), `css/stil.css`, `js/nastavitve.js` (elementi, liki, stopnje, življenja), `js/zvok.js` (zvočni učinki, sintetizirani z Web Audio, brez datotek, uglašeni na glasbo), `js/glasba.js` (generativna vesela glasba v duru: vsaka pesem ima svojo tonaliteto, tempo, akorde in vzorce), `js/plosca.js` (mehanika in učinki na plošči), `js/svet3d.js` (3D zemljevid: vrteči se svet, potok, čoln, most, podnevi piknik in gora z jeklenico, po kateri hodijo Dora, Mirt in prijatelja s čeladami in samovarovalnim kompletom, ponoči rave, kolegi s pivom ob ognju in osvetljen joga studio z gongom, na cilju balonski lok z navijači (ponoči lučke, reflektorja, ognjemet), ponoči Mirt spi, gleda film ali je na telefonu; statični predmeti se zlepijo v nekaj mrež zaradi hitrosti na telefonu), `js/aplikacija.js` (zasloni, vpis z imenom, lestvica (samo točke, eno ime = en vpis), 2D zemljevid kot rezerva, življenja, shranjevanje, zaslon zmage).
- Slike in stopnje se menjajo samo v `js/nastavitve.js`.
- Brez ES modulov (`type="module"`), ker se ne naložijo, ko `index.html` odpreš z dvoklikom.

- Najprej mora delovati na telefonu (dotik, potegi s prstom), šele nato na računalniku.
- Vsa besedila v igri so v slovenščini.
- Mehanika je kot pri Candy Crushu (menjava, trije v vrsto, padanje, stopnje na zemljevidu, življenja). Elementi, posebni elementi, videz in stopnje so naši (glej `NACRT.md`). Ne uporabljamo slik, logotipa ali grafike iz Candy Crusha.
- Ne dodajaj avtorsko zaščitene glasbe ali slik, za katere nimamo dovoljenja.

## Trenutno stanje

Kaj je narejeno, kaj ni preverjeno in kaj je odprto: `README.md`, razdelek »Trenutno stanje«. Ko končaš večji kos, ga posodobi.

## Delo z gitom

- `main` gre takoj v živo (https://dorin-krash.vercel.app). Pushaj samo na `main`, veje `igra` ne uporabljaj (zastarela).
- Vercel brezplačno dovoli 100 objav na dan: popravke združi v en commit in pushaj redko, ne po vsaki malenkosti.
- Ob spremembi JS ali CSS povečaj `?v=N` v `index.html` (vseh 7 pojavitev).
- Pred pushem preveri, da se `index.html` odpre v brskalniku brez napak v konzoli.
- Brez gesel, ključev in osebnih podatkov v repoju. Mapa `Fotke/` (prave fotografije) ne sme v repo.
- Ključev v Redisu (`dorin-kras:lestvica`, `dorin-kras:igralci`, `dorin-kras:imena`) ne preimenuj in ne briši: v njih so pravi rezultati.
