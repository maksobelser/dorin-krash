// Brez paketov: prava logika plošče, majhen DOM in nadzorovana ura.
// Zaženi: node --test tests/plosca.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.className = ''; this.clientWidth = 400;
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.classList = {
      contains: c => this.className.split(' ').includes(c),
      add: (...cs) => { this.className = [...new Set([...this.className.split(' '), ...cs])].join(' '); },
      remove: (...cs) => { this.className = this.className.split(' ').filter(c => !cs.includes(c)).join(' '); },
    };
  }
  set innerHTML(html) {
    this.children = [];
    if (html.includes('class="element')) {
      const child = this.appendChild(new Element());
      child.className = html.match(/class="([^"]+)"/)[1];
      if (html.includes('<img')) child.appendChild(new Element('img'));
    }
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  setAttribute(k, v) { if (k === 'class') this.className = v; else this[k] = v; }
  querySelectorAll(selector) {
    const matches = el => selector.split(',').some(s => s.trim().startsWith('.')
      ? el.classList.contains(s.trim().slice(1)) : el.tag === s.trim());
    return this.children.flatMap(c => [...(matches(c) ? [c] : []), ...c.querySelectorAll(selector)]);
  }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  addEventListener() {}
}

function game() {
  let now = 0, next = 0, seed = 12345;
  const timers = new Map(), sounds = [], scores = [];
  const math = Object.create(Math);
  math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const schedule = (f, delay) => { timers.set(++next, { f, time: now + delay }); return next; };
  const board = new Element(), wrapper = new Element(); wrapper.appendChild(board);
  const context = vm.createContext({
    Math: math, console,
    document: { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), body: new Element() },
    setTimeout: schedule, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: f => schedule(() => f(now), 16), cancelAnimationFrame: id => timers.delete(id),
    Zvok: new Proxy({}, { get: (_, name) => (...args) => sounds.push({ name, args }) }),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/nastavitve.js'), 'utf8'), context);
  // Dostop do zasebne plošče samo v tej VM; produkcijska koda nima testnih stikal.
  const source = fs.readFileSync(path.join(root, 'js/plosca.js'), 'utf8').replace(
    'return { init, zacni, ustavi, finale, napis: obvestilo, stanje: () => stanje };',
    `return { init, zacni, ustavi, stanje: () => stanje,
      test: { resolve: () => razresi([], [], igraId), swap: zamenjaj, types: tipi,
        hint: () => najdiPotezo(tipi()), cooldown: () => laserPremor,
        setup: (g, cooldown = 0) => {
          el.querySelectorAll('.ploscica').forEach(t => t.remove());
          grid = g.map((row, r) => row.map((tip, c) => ustvari(tip, r, c)));
          stEl = 6; laserPremor = cooldown; zaseden = false;
          stanje = { poteze: 25, cilj: 1000000, tocke: 0, konec: false };
          povratni = { tocke: n => recordScore(n), poteze: () => {}, konec: () => {} };
        }
      } };`);
  context.recordScore = n => scores.push(n);
  vm.runInContext(source + '\nglobalThis.game = Plosca;', context);
  const api = context.game; api.init(board, wrapper);
  const step = async () => {
    await Promise.resolve();
    const [id, task] = [...timers].sort((a, b) => a[1].time - b[1].time)[0] || [];
    assert.ok(task, 'pričakovan naslednji korak');
    timers.delete(id); now = task.time; task.f();
    await Promise.resolve(); await Promise.resolve();
  };
  const until = async predicate => {
    for (let i = 0; i < 3000 && !predicate(); i++) await step();
    assert.ok(predicate(), 'pogoj dosežen brez neskončne animacije');
  };
  return { api, board, wrapper, scores, sounds, math, step, until,
    config: vm.runInContext('DORA_LASER', context) };
}

const fixture = () => Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r * 2 + c) % 6));
const countLaser = g => g.api.test.types().flat().filter(t => t === 'dora-laser').length;

test('5+ ustvari lasersko Doro; 4 ustvari navadno bombo', () => {
  for (const size of [4, 5]) {
    const g = game(), tiles = fixture();
    tiles[7] = [0, 0, 0, 0, 1, 2, 3, 4]; tiles[7].fill(0, 0, size);
    g.api.test.setup(tiles); g.api.test.resolve();
    assert.equal(countLaser(g), size === 5 ? 1 : 0);
    assert.equal(g.api.test.cooldown(), size === 5 ? 6 : 0);
    assert.equal(g.api.test.types().flat().filter(t => t === 'dora').length, size === 4 ? 1 : 0);
  }
});

test('premor in obstoječi laserski žeton preprečita nov laserski žeton', () => {
  for (const existing of [false, true]) {
    const g = game(), tiles = fixture(); tiles[7].fill(0, 0, 5);
    if (existing) tiles[3][3] = 'dora-laser';
    g.api.test.setup(tiles, existing ? 0 : 3); g.api.test.resolve();
    assert.equal(countLaser(g), existing ? 1 : 0);
    assert.equal(g.api.test.cooldown(), existing ? 0 : 3);
  }
});

test('četrti val verige podari laser tudi brez ujemanja petih', async () => {
  const g = game(), tiles = fixture(); tiles[0] = [0, 0, 0, 3, 4, 1, 1, 1];
  g.math.random = () => 0;
  g.api.test.setup(tiles); g.api.test.resolve();
  await g.until(() => g.scores.length === 4);
  assert.equal(countLaser(g), 1);
  assert.equal(g.api.test.cooldown(), 6);
});

test('neveljavna poteza ne zniža premora, veljavna ga zniža za eno', async () => {
  const g = game(), tiles = fixture(); tiles[5][5] = 'dora';
  g.api.test.setup(tiles, 3);
  let done = false;
  g.api.test.swap({ r: 0, c: 0 }, { r: 0, c: 1 }).then(() => { done = true; });
  await g.until(() => done);
  assert.equal(g.api.test.cooldown(), 3);
  assert.equal(g.api.stanje().poteze, 25);
  g.api.test.swap({ r: 5, c: 5 }, { r: 5, c: 6 });
  await g.until(() => g.api.stanje().poteze === 24);
  assert.equal(g.api.test.cooldown(), 2);
});

test('nov laser je dovoljen natanko na šesti veljavni potezi po prejšnjem', async () => {
  for (const cooldown of [2, 1]) {
    const g = game(), tiles = fixture();
    tiles[7] = [0, 0, 1, 0, 0, 2, 3, 4]; tiles[6][2] = 0;
    g.api.test.setup(tiles, cooldown);
    g.api.test.swap({ r: 6, c: 2 }, { r: 7, c: 2 });
    await g.until(() => g.scores.length > 0);
    assert.equal(countLaser(g), cooldown === 1 ? 1 : 0);
  }
});

test('laser se aktivira s preprosto menjavo in zadene 24 različnih polj', async () => {
  const g = game(), tiles = fixture(); tiles[4][4] = 'dora-laser';
  g.api.test.setup(tiles);
  assert.ok(g.api.test.hint(), 'laserski žeton šteje kot možna poteza');
  let done = false;
  g.api.test.swap({ r: 4, c: 4 }, { r: 4, c: 5 }).then(() => { done = true; });
  await g.until(() => g.scores.length > 0);
  assert.equal(g.scores[0], 25 * 20, '24 tarč + laserska Dora, vsaka samo enkrat');
  assert.equal(g.board.querySelectorAll('.laser-zadeta').length, 24);
  assert.equal(g.sounds.filter(s => s.name === 'laserskiZadetek').length, 24);
  assert.equal(g.board.querySelectorAll('.laser-vrtinec').length, 0);
  await g.until(() => done);
  assert.equal(g.api.test.types().flat().length, 64);
  assert.ok(g.api.test.types().flat().every(t => t !== null), 'plošča je po padanju polna');
});

test('laser sproži zadete bombe in veriga točkuje vsako polje samo enkrat', async () => {
  const g = game(), tiles = fixture();
  tiles[4][4] = 'dora-laser'; tiles[1][1] = 'dora'; tiles[6][6] = 'dora';
  g.config.zadetki = 63;
  g.api.test.setup(tiles);
  g.api.test.swap({ r: 4, c: 4 }, { r: 4, c: 5 });
  await g.until(() => g.scores.length > 0);
  assert.equal(g.scores[0], 64 * 20);
  assert.equal(g.board.querySelectorAll('.laser').length, 4, 'dve bombi: dva križa');
});

test('odhod med vrtincem ustavi animacijo in ne doda točk', async () => {
  const g = game(), tiles = fixture(); tiles[4][4] = 'dora-laser';
  g.api.test.setup(tiles);
  let done = false;
  g.api.test.swap({ r: 4, c: 4 }, { r: 4, c: 5 }).then(() => { done = true; });
  await g.until(() => g.board.querySelectorAll('.laser-vrtinec').length === 1);
  await g.step();
  g.api.ustavi();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(g.board.querySelectorAll('.laser-vrtinec').length, 0);
  assert.equal(g.board.querySelectorAll('.vrti').length, 0);
  assert.equal(g.scores.length, 0);
  assert.equal(done, true);
});
