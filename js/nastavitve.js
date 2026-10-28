// Nastavitve igre: elementi, liki, stopnje, življenja.
// To datoteko lahko spreminjaš brez poznavanja ostale kode.
//
// Slike: ko pride prava slika, jo daj v mapo slike/ (male črke, brez šumnikov)
// in v polje "slika" vpiši pot, npr. slika: 'slike/burek.png'.
// Dokler je slika null, se pokaže emoji (začasno).

const ELEMENTI = [
  { id: 'burek',    ime: 'Burek',    emoji: '🥧', barva: '#f6bd60', slika: null },
  { id: 'rakija',   ime: 'Rakija',   emoji: '🍶', barva: '#4cc9f0', slika: null },
  { id: 'per',      ime: 'Per',      emoji: null, barva: '#b388ff', slika: null }, // emoji ni, zato se izpiše ime
  { id: 'aperol',   ime: 'Aperol',   emoji: '🍹', barva: '#ff6b35', slika: null },
  { id: 'utezi',    ime: 'Uteži',    emoji: '🏋️', barva: '#57cc99', slika: null },
  { id: 'domacica', ime: 'Domačica', emoji: '🍪', barva: '#b5835a', slika: null },
];

// Posebna bomba: nastane, ko poravnaš 4 ali več enakih (v vrsto ali v obliki L/T).
// Ko jo premakneš, Dora s strelami iz oči razbije svojo vrsto in vse okoli sebe.
const DORA = { ime: 'Dora', emoji: '👧', barva: '#ff8fab', slika: null };

// Proslave ob zmagi stopnje (izmenično).
const PROSLAVE = [
  { besedilo: 'Mičko dela stojo!', emoji: '🧍', animacija: 'stoja', slika: null },
  { besedilo: 'Urbi bog!',         emoji: '😇', animacija: 'sij',   slika: null },
];

// Zemljevid: Mirt pri domu na začetku, Tupko v različnih pozah pri hišicah.
const MIRT = { ime: 'Mirt', emoji: '🧑', slika: null };
const TUPKO_POZE = [
  { emoji: '🐈', slika: null },
  { emoji: '😺', slika: null },
  { emoji: '😸', slika: null },
  { emoji: '😼', slika: null },
  { emoji: '😻', slika: null },
  { emoji: '🙀', slika: null },
];

// Stopnje: poteze = število potez, cilj = točke za 1 zvezdico,
// elementi = koliko različnih elementov je na plošči (manj = lažje).
// Cilji so nastavljeni s simulacijo naključnih potez (300 iger na stopnjo):
// prve stopnje reši ~90 % iger, zadnja ~30 %. Na pravih igralcih še ni preizkušeno.
const STOPNJE = [
  { poteze: 20, cilj: 3000, elementi: 5 },
  { poteze: 20, cilj: 3800, elementi: 5 },
  { poteze: 18, cilj: 4000, elementi: 5 },
  { poteze: 22, cilj: 2800, elementi: 6 },
  { poteze: 20, cilj: 2600, elementi: 6 },
  { poteze: 20, cilj: 2900, elementi: 6 },
  { poteze: 18, cilj: 2700, elementi: 6 },
  { poteze: 20, cilj: 3100, elementi: 6 },
  { poteze: 18, cilj: 2900, elementi: 6 },
  { poteze: 20, cilj: 3300, elementi: 6 },
  { poteze: 18, cilj: 3100, elementi: 6 },
  { poteze: 20, cilj: 3600, elementi: 6 },
];

// Zvezdice: 1 ob cilju, 2 in 3 ob večkratniku cilja.
const ZVEZDICE = [1, 1.2, 1.5];

// Točke za vsako neporabljeno potezo ob zmagi.
const BONUS_ZA_POTEZO = 100;

const ZIVLJENJA = { najvec: 5, obnovaMinut: 20 };
