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
