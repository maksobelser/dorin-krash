# Navodila za AI agente (Claude, Codex, Cursor …)

Projekt: **Dorin Kraš**, Dorin Candy Crush. Načrt je v `NACRT.md`, pravila sodelovanja v `README.md`.

## Tehnično

- Navaden HTML, CSS in JavaScript. Brez gradnje (build), brez npm paketov, brez ogrodij (framework).
- Stran se objavi na Vercelu kot statična stran. `index.html` mora ostati v korenu repoja.
- Imena datotek z malimi črkami, brez presledkov in šumnikov (`kanu.png`, ne `Kanu.PNG`). Vercel razlikuje velike in male črke.
- Poti do slik in skript relativne (`slike/burek.png`, ne `/slike/burek.png`).
- Slike v mapi `slike/`, zvoki v `zvoki/`. Slike naj bodo majhne (PNG ali WebP, do ~200 KB).

## Igra

- Najprej mora delovati na telefonu (dotik, potegi s prstom), šele nato na računalniku.
- Vsa besedila v igri so v slovenščini.
- Mehanika je kot pri Candy Crushu (menjava, trije v vrsto, padanje, stopnje na zemljevidu, življenja). Elementi, posebni elementi, videz in stopnje so naši (glej `NACRT.md`). Ne uporabljamo slik, logotipa ali grafike iz Candy Crusha.
- Ne dodajaj avtorsko zaščitene glasbe ali slik, za katere nimamo dovoljenja.

## Delo z gitom

- `main` gre takoj v živo. Večje spremembe na svojo vejo, majhni popravki lahko na `main`.
- Pred pushem preveri, da se `index.html` odpre v brskalniku brez napak v konzoli.
- Brez gesel, ključev in osebnih podatkov v repoju.
