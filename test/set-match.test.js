const test = require('node:test');
const assert = require('node:assert/strict');

const M = require('../src/core/set-match');

const str = (s) => ({ stringValue: s });
const int = (n) => ({ integerValue: String(n) });
const nul = { nullValue: null };
const map = (fields) => ({ mapValue: { fields } });

test("Firestore's published document becomes plain sets", () => {
  const doc = {
    fields: {
      schema: int(1),
      publishedAt: int(1761426000000),
      sets: { arrayValue: { values: [map({
        id: str('a1'), name: str('TOTW 6'), group: str(''), tokens: int(3),
        grades: map({ D: int(10), C: int(125000), B: nul }),
        slots: { arrayValue: { values: [map({ kind: str('card'), playerId: int(246669), name: str('Bukayo Saka'), rating: int(89), version: str('TOTW') }), nul] } },
        bonusTags: { arrayValue: {} },
      })] } },
    },
  };
  const gallery = M.readGallery(doc);
  assert.equal(gallery.publishedAt, 1761426000000);
  assert.deepEqual(gallery.sets[0].slots, [{ kind: 'card', playerId: 246669, name: 'Bukayo Saka', rating: 89, version: 'TOTW' }, null]);
  assert.deepEqual(gallery.sets[0].grades, { D: 10, C: 125000, B: null });
  assert.deepEqual(gallery.sets[0].bonusTags, []);
});

test('documents in another format are ignored', () => {
  assert.equal(M.readGallery({ fields: { schema: int(2), sets: { arrayValue: {} } } }), null);
  assert.equal(M.readGallery(null), null);
  assert.equal(M.readGallery({ error: { code: 404 } }), null);
});

const card = (id, playerId, rating, over) => ({ id, playerId, rating, score: rating * 1000, leagueId: 13, nationId: 14, ...over });

test('exact-card slots need the same player and rating; each card fills one slot', () => {
  const set = {
    id: 's', name: 'TOTW 6', grades: { D: 10, C: 100000 },
    slots: [
      { kind: 'card', playerId: 246669, rating: 89 },
      { kind: 'card', playerId: 246669, rating: 89 },
      { kind: 'card', playerId: 1, rating: null },
      null,
    ],
  };
  const res = M.matchSet(set, [card(10, 246669, 89), card(11, 246669, 87), card(12, 1, 70)]);
  assert.deepEqual(res.slots.map((e) => e.card && e.card.id), [10, null, 12, null]);
  assert.equal(res.have, 2);
  assert.equal(res.total, 3);
  assert.deepEqual(res.missing, [{ kind: 'card', playerId: 246669, rating: 89 }]);
  assert.equal(res.score, 159000);
  assert.equal(res.grade, 'C');
});

test('rule slots take the best card left that fits; a version makes them unsure', () => {
  const set = {
    id: 'r', name: 'LALIGA',
    slots: [
      { kind: 'card', playerId: 5, rating: 84 },
      { kind: 'rule', label: 'Any LALIGA 80+', leagueId: 53, minRating: 80 },
      { kind: 'rule', label: 'Any TOTW from LALIGA', leagueId: 53, version: 'TOTW' },
      { kind: 'rule', label: 'Any Spanish', nationId: 45 },
    ],
  };
  const res = M.matchSet(set, [card(1, 5, 84, { leagueId: 53 }), card(2, 6, 82, { leagueId: 53 }), card(3, 7, 75, { leagueId: 53 })]);
  assert.deepEqual(res.slots.map((e) => e.card && e.card.id), [1, 2, 3, null]);
  assert.deepEqual(res.slots.map((e) => e.unsure), [false, false, true, false]);
  assert.equal(res.unsure, 1);
  assert.equal(res.grade, null);
});

test('a version number must match the card version, for exact cards and rules', () => {
  const set = {
    id: 'v', name: 'TOTW',
    slots: [
      { kind: 'card', playerId: 5, rating: 89, rarityId: 3, version: 'Team of the Week' },
      { kind: 'rule', label: 'Any TOTW from LALIGA', leagueId: 53, rarityId: 3, version: 'Team of the Week' },
      { kind: 'rule', label: 'Any common', rarityId: 0, version: 'Common' },
    ],
  };
  const res = M.matchSet(set, [
    card(1, 5, 89, { rarityId: 12 }),
    card(2, 6, 85, { leagueId: 53, rarityId: 1 }),
    card(3, 7, 84, { leagueId: 53, rarityId: 3 }),
    card(4, 8, 70, { rarityId: 0 }),
  ]);
  assert.deepEqual(res.slots.map((e) => e.card && e.card.id), [null, 3, 4]);
  assert.equal(res.unsure, 0);
});

test('a rule with several versions takes a card of any of them', () => {
  const potm = { kind: 'rule', label: 'Any POTM card', rarityIds: [42, 43], version: 'POTM' };
  const res = M.matchSet({ id: 'p', name: 'POTM', slots: [potm, potm, potm] }, [
    card(1, 5, 84, { rarityId: 43 }),
    card(2, 6, 85, { rarityId: 3 }),
    card(3, 7, 86, { rarityId: 42 }),
  ]);
  assert.deepEqual(res.slots.map((e) => e.card && e.card.id), [3, 1, null]);
  assert.equal(res.unsure, 0);
});

test('a Holographic rule takes foil cards of any version', () => {
  const holo = { kind: 'rule', label: 'Any Holographic card', foil: true };
  const res = M.matchSet({ id: 'h', name: 'Holographics', slots: [holo, holo, holo] }, [
    card(1, 5, 87, { rarityId: 72, foil: true }),
    card(2, 6, 90, { rarityId: 72 }),
    card(3, 7, 83, { rarityId: 19, foil: true }),
  ]);
  assert.deepEqual(res.slots.map((e) => e.card && e.card.id), [1, 3, null]);
  assert.equal(res.unsure, 0);
});

test('slots ticked as done in the game count as filled and take no card', () => {
  const rule = { kind: 'rule', label: 'Any card' };
  const res = M.matchSet({ id: 'd', name: 'Done', slots: [rule, rule, null] }, [card(1, 5, 84)], [0, 2]);
  assert.equal(res.slots[0].done, true);
  assert.equal(res.slots[0].card, null);
  assert.equal(res.slots[1].card.id, 1, 'the club card goes to the next slot');
  assert.equal(res.slots[2].done, false, 'an empty slot cannot be ticked');
  assert.equal(res.have, 2);
  assert.equal(res.missing.length, 0);
});

test('a picked card fills its slot with its own score and tags, and takes no club card', () => {
  const rule = { kind: 'rule', label: 'Any card' };
  const picked = card(50547923, 300, 80, { score: 338, totw: true });
  const res = M.matchSet({ id: 'p', name: 'Picked', slots: [rule, rule] }, [card(1, 5, 84)], [0], { 0: picked });
  assert.equal(res.slots[0].picked, true);
  assert.equal(res.slots[0].done, false, 'a pick replaces the done tick');
  assert.equal(res.slots[0].card, picked);
  assert.equal(res.slots[1].card.id, 1, 'the club card goes to the next slot');
  assert.equal(res.baseScore, 338 + 84000);
  assert.equal(res.have, 2);
});

const any = { kind: 'rule', label: 'Any card' };
const offer = (source, ...cards) => cards.map((c) => ({ ...c, source }));

test('a grade plan fills every empty slot, then swaps in the lowest card that reaches the grade', () => {
  const res = M.matchSet({ id: 'g', name: 'Plan', grades: { D: 10, C: 40000 }, slots: [any, any, any] }, []);
  const plan = M.planGrade(res, 'C', {
    0: offer('search', card(1, 1, 30), card(5, 5, 9), card(2, 2, 5)),
    1: offer('search', card(3, 3, 20)),
    2: offer('search', card(4, 4, 12)),
  });
  assert.deepEqual(plan.adds.map((a) => [a.index, a.card.id]), [[0, 5], [1, 3], [2, 4]], '5,000 swapped for 9,000 rather than 30,000');
  assert.equal(plan.score, 41000);
  assert.equal(plan.reached, true);
  assert.equal(plan.complete, true);
});

test('a grade plan uses club cards before squad builder cards', () => {
  const res = M.matchSet({ id: 'g', name: 'Plan', grades: { C: 9000 }, slots: [any, any] }, []);
  const plan = M.planGrade(res, 'C', {
    0: offer('search', card(1, 1, 90)),
    1: offer('club', card(2, 2, 6), card(3, 3, 4)).concat(offer('search', card(6, 6, 50))),
  });
  assert.deepEqual(plan.adds.map((a) => [a.card.id, a.card.source]), [[1, 'search'], [2, 'club']]);
  assert.equal(plan.reached, true);
});

test('a grade plan skips cards already in the set and says when a grade is out of reach', () => {
  const res = M.matchSet({ id: 'g', name: 'Plan', grades: { S: 500000 }, slots: [any, any] }, [card(1, 7, 80)]);
  const plan = M.planGrade(res, 'S', { 1: offer('search', card(50, 7, 80), card(51, 8, 70)) });
  assert.deepEqual(plan.adds.map((a) => a.card.id), [51], 'the same card as the one in the set is left out');
  assert.equal(plan.reached, false);
  assert.equal(plan.score, 150000);
  assert.equal(M.planGrade(res, 'A', {}), null, 'a grade the set does not list');
});

test('a grade plan uses a card once but takes other versions of the same player', () => {
  const neto = (id, defId, rarityId, over) => card(id, 9, 83, { defId, rarityId, ...over });
  const res = M.matchSet({ id: 'g', name: 'Plan', grades: { D: 10 }, slots: [any, any, any, any] }, [neto(1, 900, 1)]);
  const plan = M.planGrade(res, 'D', {
    1: offer('search', neto(900, 900, 1), neto(901, 901, 3)),
    2: offer('search', neto(901, 901, 3), neto(902, 902, 3)),
    3: offer('search', neto(900, 900, 1, { foil: true })),
  });
  assert.deepEqual(plan.adds.map((a) => [a.index, a.card.defId, Boolean(a.card.foil)]), [[1, 901, false], [2, 902, false], [3, 900, true]],
    'the gold card in the set is not offered again; two versions with the same rating and the holographic gold are');
  assert.equal(plan.complete, true);
});

test('a grade plan says which slots it cannot fill', () => {
  const res = M.matchSet({ id: 'g', name: 'Plan', grades: { D: 10 }, slots: [any, any, any] }, []);
  const plan = M.planGrade(res, 'D', { 0: offer('search', card(1, 1, 80)), 2: [] });
  assert.deepEqual(plan.adds.map((a) => a.index), [0]);
  assert.equal(plan.reached, true);
  assert.equal(plan.unfilled, 2);
  assert.equal(plan.complete, false);
});

test('a grade plan counts the bonus tags its cards complete', () => {
  const res = M.matchSet({ id: 'g', name: 'Plan', grades: { C: 21000 }, slots: [any, any] }, [card(1, 1, 10, { foil: true })]);
  const plan = M.planGrade(res, 'C', { 1: offer('search', card(3, 3, 10), card(2, 2, 10, { foil: true })) });
  assert.equal(plan.adds[0].card.id, 2, 'the second Holographic card wins the +8%');
  assert.equal(plan.score, 21600);
  assert.equal(plan.bonus, 1600);
});

test('a club rule takes cards from its clubs in its leagues only', () => {
  const arsenal = { kind: 'rule', label: 'Any Arsenal player (men or women)', clubIds: [1, 116009], leagueIds: [13, 2216] };
  const res = M.matchSet({ id: 'a', name: 'Arsenal', slots: [arsenal, arsenal, arsenal] }, [
    card(1, 5, 84, { clubId: 1, leagueId: 13 }),
    card(2, 6, 85, { clubId: 116009, leagueId: 2216 }),
    card(3, 7, 86, { clubId: 1, leagueId: 2012 }),
    card(4, 8, 87, { clubId: 10, leagueId: 13 }),
  ]);
  assert.deepEqual(res.slots.map((e) => e.card && e.card.id), [2, 1, null]);
});

test('sets closest to complete come first', () => {
  const sets = [
    { id: 'a', name: 'Alpha', slots: [{ kind: 'card', playerId: 1 }, { kind: 'card', playerId: 2 }] },
    { id: 'b', name: 'Beta', slots: [{ kind: 'card', playerId: 1 }] },
  ];
  assert.deepEqual(M.matchAll(sets, [card(1, 1, 80)]).map((r) => [r.id, r.have, r.total]), [['b', 1, 1], ['a', 1, 2]]);
});

test('a set is pictured by its club, else by its one or two leagues, else by its version', () => {
  const arsenal = { kind: 'rule', clubIds: [1, 110394], leagueIds: [13, 2216] };
  const arsenalWomen = { kind: 'rule', clubIds: [1, 110394], leagueIds: [2216] };
  const spurs = { kind: 'rule', clubIds: [18], leagueIds: [13] };
  assert.deepEqual(M.picture([arsenal, arsenalWomen, null]), { club: 1 });
  assert.deepEqual(M.picture([arsenal, arsenalWomen, spurs]), { leagues: [13, 2216] }, 'a category of Premier League clubs');
  assert.deepEqual(M.picture([{ kind: 'rule', leagueId: 31 }]), { leagues: [31] });
  assert.equal(M.picture([{ kind: 'rule', leagueIds: [13] }, { kind: 'rule', leagueIds: [16] }, { kind: 'rule', leagueIds: [19] }]), null, 'mixed leagues');
  assert.deepEqual(M.picture([{ kind: 'rule', rarityIds: [6, 72] }, { kind: 'rule', rarityIds: [72] }]), { rarity: 6 }, 'a version set such as Heroes');
  assert.equal(M.picture([{ kind: 'rule', label: 'Any Holographic card', foil: true }]), null);
  assert.equal(M.picture([null]), null);
});
