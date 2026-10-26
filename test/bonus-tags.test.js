const test = require('node:test');
const assert = require('node:assert/strict');

const B = require('../src/core/bonus-tags');
const M = require('../src/core/set-match');

let nextId = 1;
const card = (extra) => ({ id: nextId++, playerId: nextId, score: 1000, nationId: 1, clubId: 1, leagueId: 1, level: 'gold', foil: false, icon: false, hero: false, totw: false, owners: 3, weakFoot: 3, skillMoves: 3, positions: [14], ...extra });
const tag = (result, name) => result.tags.find((t) => t.name === name);

test('there are 21 tags, in the game order', () => {
  assert.equal(B.TAGS.length, 21);
  assert.equal(B.TAGS[0].name, 'Same Nation');
  assert.equal(B.TAGS[20].name, 'All out Attack');
});

test('a tag is inactive below its first tier and says what the next tier needs', () => {
  const r = B.scoreTags([card({ foil: true })]);
  const holo = tag(r, 'Holographic');
  assert.equal(holo.count, 1);
  assert.equal(holo.tier, null);
  assert.deepEqual(holo.next, { count: 2, percent: 8 });
  assert.equal(holo.bonus, 0);
});

test('the bonus is the tier percent of the matching cards only', () => {
  const cards = [card({ foil: true, score: 2000 }), card({ foil: true, score: 3000 }), card({ score: 9000 })];
  const holo = tag(B.scoreTags(cards), 'Holographic');
  assert.deepEqual(holo.tier, { count: 2, percent: 8 });
  assert.equal(holo.bonus, 400, '8% of 5000, the third card is not holographic');
});

test('"same" tags count the biggest group, "different" tags one card per value', () => {
  const cards = [
    ...[1, 2, 3, 4, 5, 6].map(() => card({ nationId: 14 })),
    card({ nationId: 18, score: 500 }),
    card({ nationId: 27, score: 500 }),
    card({ nationId: 34, score: 500 }),
    card({ nationId: 52, score: 500 }),
  ];
  const r = B.scoreTags(cards);
  assert.equal(tag(r, 'Same Nation').count, 6);
  assert.equal(tag(r, 'Same Nation').bonus, 60, '1% of the six cards from nation 14');
  assert.equal(tag(r, 'Different Nation').count, 5, 'nation 14 counts once');
  assert.equal(tag(r, 'Different Nation').bonus, 30, '1% of one nation-14 card and the four others');
});

test('higher tiers replace lower ones', () => {
  const cards = Array.from({ length: 10 }, () => card({ owners: 1 }));
  const first = tag(B.scoreTags(cards), 'First Owner');
  assert.deepEqual(first.tier, { count: 10, percent: 300 });
  assert.equal(first.bonus, 30000);
  assert.deepEqual(first.next, { count: 20, percent: 500 });
});

test('copies, positions, stars and card colours', () => {
  const r = B.scoreTags([
    card({ playerId: 7 }), card({ playerId: 7 }), card({ playerId: 7 }),
    card({ positions: [0] }), card({ positions: [0] }), card({ positions: [0] }),
    card({ weakFoot: 5 }), card({ skillMoves: 5 }),
  ]);
  assert.deepEqual(tag(r, 'Multiples!').tier, { count: 3, percent: 15 });
  assert.deepEqual(tag(r, 'Hands Only').tier, { count: 3, percent: 3 });
  assert.equal(tag(r, 'Ambidextrous').count, 1);
  assert.equal(tag(r, 'Skilled').count, 1);
  assert.deepEqual([64, 65, 74, 75].map(B.levelFor), ['bronze', 'silver', 'silver', 'gold']);
});

test("a set's score and grade include its bonus tags", () => {
  const rule = { kind: 'rule', label: 'Any card' };
  const cards = [card({ foil: true, score: 5000 }), card({ foil: true, score: 5000 })];
  const res = M.matchSet({ id: 'h', name: 'Holographics', slots: [rule, rule], grades: { D: 10, C: 10500 } }, cards);
  assert.equal(res.baseScore, 10000);
  assert.equal(res.bonus, 800);
  assert.equal(res.score, 10800);
  assert.equal(res.grade, 'C', 'reached only with the Holographic bonus');
});

test('cards are picked for the highest total with bonus tags, not the highest scores', () => {
  const rule = { kind: 'rule', label: 'Any Gold card' };
  const plain = [1, 2, 3, 4, 5].map((i) => card({ id: 100 + i, nationId: i, clubId: i, leagueId: i, score: 1000, owners: 3 }));
  const firstOwner = [1, 2, 3, 4, 5].map((i) => card({ id: 200 + i, nationId: i, clubId: i, leagueId: i, score: 800, owners: 1 }));
  const res = M.matchSet({ id: 'g', name: 'Gold', slots: [rule, rule, rule, rule, rule], grades: { D: 10, A: 9000 } }, [...plain, ...firstOwner]);
  assert.deepEqual(res.slots.map((e) => e.card.id).sort(), [201, 202, 203, 204, 205]);
  assert.equal(res.baseScore, 4000);
  assert.ok(res.score >= 10000, `4,000 + 150% First Owner, plus the Different tags: got ${res.score}`);
  assert.equal(res.grade, 'A');
});

test('without a bonus to gain, the highest scores stay', () => {
  const rule = { kind: 'rule', label: 'Any card' };
  const cards = [card({ id: 301, score: 900 }), card({ id: 302, score: 500 }), card({ id: 303, score: 700 })];
  const res = M.matchSet({ id: 'p', name: 'Plain', slots: [rule, rule] }, cards);
  assert.deepEqual(res.slots.map((e) => e.card.id), [301, 303]);
});
