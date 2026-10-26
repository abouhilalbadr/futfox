const test = require('node:test');
const assert = require('node:assert/strict');

const { readClubReply, galleryRows, filterRows, countByFilter, rememberCards, withRemembered, mergeMemory, mergeDone, mergePicked, exportData, readExport } = require('../src/core/gallery');

test('a club reply gives every card id and the ones EA marks as collected', () => {
  const reply = { itemData: [{ id: 1, isCollected: true }, { id: 2 }, { id: 3, isCollected: false }, { rating: 80 }] };
  assert.deepEqual(readClubReply(reply), { seen: [1, 2, 3], collected: [1] });
  assert.deepEqual(readClubReply(null), { seen: [], collected: [] });
  assert.deepEqual(readClubReply({ items: [] }), { seen: [], collected: [] });
});

const card = (id, over) => ({ id, rating: 80, score: 180, owners: 2, ...over });

test('rows mark collected, not marked and unseen cards, highest score first', () => {
  const rows = galleryRows([card(1), card(2, { score: 2100, rating: 85 }), card(3, { owners: 1 })], {
    seen: new Set([1, 2]),
    collected: new Set([2]),
  });
  assert.deepEqual(rows.map((r) => [r.id, r.collected, r.firstOwner]), [[2, true, false], [1, false, false], [3, null, true]]);
});

test('equal scores fall back to rating', () => {
  const rows = galleryRows([card(1, { rating: 70, score: 35 }), card(2, { rating: 74, score: 35 })], { seen: new Set(), collected: new Set() });
  assert.deepEqual(rows.map((r) => r.id), [2, 1]);
});

test('filter counts match the filtered lists', () => {
  const rows = galleryRows([card(1, { owners: 1 }), card(2), card(3, { owners: 1 }), card(4)], {
    seen: new Set([1, 2, 3]),
    collected: new Set([1]),
  });
  const counts = countByFilter(rows);
  assert.deepEqual(counts, { all: 4, collected: 1, unmarked: 2, firstOwner: 2 });
  for (const [name, n] of Object.entries(counts)) assert.equal(filterRows(rows, name).length, n);
  assert.equal(filterRows(rows, 'nonsense').length, 4);
});

test('cards FutFox has seen keep counting after they leave the club; loans are never kept', () => {
  const memory = rememberCards({ cards: {} }, [
    { id: 1, name: 'Corona', score: 900 },
    { id: 2, name: 'Loanee', score: 500, loan: true },
    { id: 3, name: 'Saka', score: 2100, collected: true, firstOwner: true },
  ], 100);
  assert.deepEqual(Object.keys(memory.cards), ['1', '3']);
  assert.equal('collected' in memory.cards[3], false, 'display fields are not stored');
  // Later the club only holds Saka: Corona comes back from memory, marked remembered.
  const cards = withRemembered([{ id: 3, name: 'Saka', score: 2100 }], memory);
  assert.deepEqual(cards.map((c) => [c.id, Boolean(c.remembered)]), [[3, false], [1, true]]);
  assert.equal('seenAt' in cards[1], false);
});

test('a card remembered before FutFox knew it was a loan is forgotten once it is seen as one', () => {
  let memory = rememberCards({ cards: {} }, [{ id: 7, name: 'Lukeba', score: 4000 }], 1);
  memory = rememberCards(memory, [{ id: 7, name: 'Lukeba', score: 4000, loan: true }], 2);
  assert.deepEqual(memory.cards, {});
  assert.deepEqual(withRemembered([], memory), []);
});

test('the memory keeps the most recently seen cards', () => {
  const many = Array.from({ length: 5002 }, (_, i) => ({ id: i, score: 1 }));
  let memory = rememberCards({ cards: {} }, many.slice(0, 2), 1);
  memory = rememberCards(memory, many.slice(2), 2);
  assert.equal(Object.keys(memory.cards).length, 5000);
  assert.equal(memory.cards[0], undefined, 'the oldest go first');
});

test('an export file brings the remembered cards, ticked slots and picked cards back', () => {
  const memory = { cards: { 1: { id: 1, name: 'Corona', score: 300, seenAt: 5 } } };
  const picked = { set1: { 1: { id: 50547923, name: 'Mwene', score: 338 } } };
  const file = JSON.parse(JSON.stringify(exportData({ memory, done: { set1: [0, 3] }, picked, persona: 1005603132559, now: 9 })));
  assert.equal(file.persona, '1005603132559');
  const read = readExport(file);
  assert.deepEqual(read.memory, memory);
  assert.deepEqual(read.done, { set1: [0, 3] });
  assert.deepEqual(read.picked, picked);
  assert.deepEqual(readExport({ ...file, picked: { set1: { x: { id: 1 }, 2: null } } }).picked, {}, 'odd slots are dropped');
  assert.match(readExport({ sets: [] }).error, /isn't a FutFox Gallery data file/);
  assert.match(readExport({ ...file, version: 2 }).error, /newer FutFox/);
});

test('importing adds to what is saved; the latest sighting of a card wins', () => {
  const here = { cards: { 1: { id: 1, score: 100, seenAt: 10 }, 2: { id: 2, score: 200, seenAt: 10 } } };
  const file = { cards: { 2: { id: 2, score: 250, seenAt: 20 }, 3: { id: 3, score: 300, seenAt: 5 } } };
  const merged = mergeMemory(here, file);
  assert.deepEqual(Object.keys(merged.cards), ['1', '2', '3']);
  assert.equal(merged.cards[2].score, 250);
  assert.equal(mergeMemory(file, here).cards[2].score, 250, 'the older sighting never wins');
  assert.deepEqual(mergeDone({ a: [2, 0] }, { a: [0, 5], b: [1] }), { a: [0, 2, 5], b: [1] });
  assert.deepEqual(mergePicked({ a: { 0: { id: 1 } } }, { a: { 0: { id: 2 }, 1: { id: 3 } }, b: { 2: { id: 4 } } }),
    { a: { 0: { id: 1 }, 1: { id: 3 } }, b: { 2: { id: 4 } } }, 'a pick already here is kept');
});
