const test = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');

const { pickForScore } = require('../src/core/streamlined');

const card = (id, score, cost) => ({ id, score, cost });
const sum = (cards, field) => cards.reduce((n, c) => n + c[field], 0);

test('picks the cheapest cards that reach the points target', () => {
  const cards = [card(1, 6000, 9000), card(2, 2000, 400), card(3, 2000, 400), card(4, 2000, 450), card(5, 20, 150)];
  const res = pickForScore({ cards, need: 6000, limit: 30 });
  assert.equal(res.reached, true);
  assert.deepEqual(res.picks.map((c) => c.id).sort(), [2, 3, 4]);
  assert.equal(res.cost, 1250);
});

test('uses fewer, higher-scoring cards when the limit is tight', () => {
  const cheap = Array.from({ length: 40 }, (_, i) => card(i, 100, 10));
  const cards = cheap.concat([card(100, 3000, 5000), card(101, 3000, 5200)]);
  const res = pickForScore({ cards, need: 6000, limit: 3 });
  assert.equal(res.reached, true);
  assert.ok(res.picks.length <= 3);
  assert.ok(res.score >= 6000);
});

test('can prefer the fewest cards over the fewest coins', () => {
  const cards = [card(1, 3000, 5000), card(2, 3000, 5000), card(3, 1000, 100), card(4, 1000, 100), card(5, 1000, 100), card(6, 1000, 100), card(7, 1000, 100), card(8, 1000, 100)];
  assert.equal(pickForScore({ cards, need: 6000 }).picks.length, 6);
  const fewest = pickForScore({ cards, need: 6000, prefer: 'fewest' });
  assert.equal(fewest.picks.length, 2);
  assert.ok(fewest.score >= 6000);
});

test('drops cards the target does not need', () => {
  const cards = [card(1, 5000, 100), card(2, 5000, 100), card(3, 20, 1)];
  const res = pickForScore({ cards, need: 9000, limit: 30 });
  assert.deepEqual(res.picks.map((c) => c.id).sort(), [1, 2]);
});

test('says when the target is out of reach and offers the highest scores', () => {
  const cards = [card(1, 100, 10), card(2, 300, 10), card(3, 200, 10)];
  const res = pickForScore({ cards, need: 5000, limit: 2 });
  assert.equal(res.reached, false);
  assert.deepEqual(res.picks.map((c) => c.id), [2, 3]);
});

test('needs nothing once the target is met', () => {
  assert.deepEqual(pickForScore({ cards: [card(1, 10, 10)], need: 0 }).picks, []);
});

test('any reachable target is reached within the limit, with no card twice', () => {
  const arb = fc.record({
    cards: fc.array(fc.record({ score: fc.integer({ min: 0, max: 14000 }), cost: fc.integer({ min: 0, max: 30000 }) }), { maxLength: 60 }),
    need: fc.integer({ min: 1, max: 40000 }),
    limit: fc.integer({ min: 1, max: 30 }),
  });
  fc.assert(fc.property(arb, ({ cards, need, limit }) => {
    const all = cards.map((c, id) => ({ ...c, id }));
    const res = pickForScore({ cards: all, need, limit });
    assert.ok(res.picks.length <= limit);
    assert.equal(new Set(res.picks.map((c) => c.id)).size, res.picks.length);
    const best = all.map((c) => c.score).sort((a, b) => b - a).slice(0, limit).reduce((a, b) => a + b, 0);
    assert.equal(res.reached, best >= need);
    if (res.reached) assert.ok(sum(res.picks, 'score') >= need);
  }));
});
