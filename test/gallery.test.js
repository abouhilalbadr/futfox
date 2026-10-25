const test = require('node:test');
const assert = require('node:assert/strict');

const { readClubReply, galleryRows, filterRows, countByFilter } = require('../src/core/gallery');

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
