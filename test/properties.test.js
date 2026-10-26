// Property-based (fuzz) tests: fast-check generates thousands of random squads and
// checks rules that must hold for every one, not just the hand-picked cases.
const test = require('node:test');
const fc = require('fast-check');

const { squadRating } = require('../src/core/rating');
const { computeChemistry, DEFAULT_PROFILES } = require('../src/core/chemistry');
const { solve } = require('../src/core/solver');

const RATINGS = fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 0, maxLength: 11 });
const TYPE_IDS = [0, 3, 5, 7, 10, 12, 14, 16, 18, 23, 25, 27];
const typeId = fc.constantFrom(...TYPE_IDS);
const profile = fc.constantFrom(DEFAULT_PROFILES.base, DEFAULT_PROFILES.hero, DEFAULT_PROFILES.icon);
const player = fc.record({
  rating: fc.integer({ min: 45, max: 99 }),
  nationId: fc.integer({ min: 1, max: 6 }),
  leagueId: fc.integer({ min: 1, max: 5 }),
  clubId: fc.integer({ min: 1, max: 12 }),
  positions: fc.uniqueArray(typeId, { minLength: 1, maxLength: 3 }),
  profile,
});
// Up to 11 slots, each holding a player or nothing.
const lineup = fc.array(fc.tuple(typeId, fc.option(player, { nil: null })), { minLength: 1, maxLength: 11 });
const split = (pairs) => ({ slots: pairs.map(([t]) => ({ typeId: t })), players: pairs.map(([, p]) => p) });

test('squad rating is a whole number from 0 to 99', () => {
  fc.assert(fc.property(RATINGS, fc.boolean(), (ratings, useFloat) => {
    const r = squadRating(ratings, useFloat);
    return Number.isInteger(r) && r >= 0 && r <= 99;
  }));
});

test('squad rating does not depend on the order of the players', () => {
  fc.assert(fc.property(RATINGS, fc.boolean(), fc.integer(), (ratings, useFloat, seed) => {
    const shuffled = ratings.slice().sort((a, b) => ((a * 31 + seed) % 7) - ((b * 31 + seed) % 7));
    return squadRating(shuffled, useFloat) === squadRating(ratings, useFloat);
  }));
});

test('eleven players of the same rating rate exactly that', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 99 }), fc.boolean(), (r, useFloat) =>
    squadRating(Array(11).fill(r), useFloat) === r));
});

test('with the float formula, raising one player never lowers the squad rating', () => {
  fc.assert(fc.property(
    fc.array(fc.integer({ min: 1, max: 98 }), { minLength: 1, maxLength: 11 }),
    fc.nat(), fc.integer({ min: 1, max: 20 }),
    (ratings, at, plus) => {
      const i = at % ratings.length;
      const raised = ratings.slice();
      raised[i] = Math.min(99, raised[i] + plus);
      return squadRating(raised, true) >= squadRating(ratings, true);
    }));
});

test('chemistry stays within 0 to 3 per player and the total adds up', () => {
  fc.assert(fc.property(lineup, (pairs) => {
    const { slots, players } = split(pairs);
    const chem = computeChemistry(slots, players);
    const sum = chem.perPlayer.reduce((a, b) => a + b, 0);
    return chem.total === sum && chem.perPlayer.every((c) => c >= 0 && c <= 3) && chem.total <= 33;
  }));
});

test('empty slots and players out of position get no chemistry', () => {
  fc.assert(fc.property(lineup, (pairs) => {
    const { slots, players } = split(pairs);
    const chem = computeChemistry(slots, players);
    return players.every((p, i) => chem.inPosition[i] || chem.perPlayer[i] === 0);
  }));
});

test('heroes and icons in position always have full chemistry', () => {
  fc.assert(fc.property(lineup, (pairs) => {
    const { slots, players } = split(pairs);
    const chem = computeChemistry(slots, players);
    return players.every((p, i) => !p || !chem.inPosition[i] || !p.profile.maxChem || chem.perPlayer[i] === 3);
  }));
});

test('chemistry does not depend on the order of the slots', () => {
  fc.assert(fc.property(lineup, (pairs) => {
    const a = split(pairs);
    const b = split(pairs.slice().reverse());
    return computeChemistry(a.slots, a.players).total === computeChemistry(b.slots, b.players).total;
  }));
});

// The solver is slow, so it gets fewer, shorter runs.
const F343 = [0, 5, 5, 5, 12, 14, 14, 16, 23, 25, 27].map((t) => ({ typeId: t }));
const pool = fc.array(player, { minLength: 0, maxLength: 30 }).map((list) => list.map((p, i) => ({
  ...p, key: `p${i}`, defId: 1000 + i, name: `Player ${i}`, cost: p.rating * 10, source: 'club',
})));

test('the solver never uses a club card twice and its totals match its squad', () => {
  fc.assert(fc.property(pool, fc.boolean(), fc.integer({ min: 1, max: 1000 }), (cards, market, seed) => {
    const result = solve({ slots: F343, rules: [], pool: cards, market: { enabled: market }, iterations: 300, restarts: 1, seed });
    const players = result.squad.map((s) => s.player);
    const club = players.filter((p) => p && p.defId != null).map((p) => p.defId);
    const cost = players.filter(Boolean).reduce((sum, p) => sum + p.cost, 0);
    const rating = squadRating(players.map((p) => (p ? p.rating : 0)), true);
    const chem = computeChemistry(F343, players).total;
    return result.squad.length === F343.length && new Set(club).size === club.length
      && result.cost === cost && result.rating === rating && result.chemistry === chem;
  }), { numRuns: 40 });
});

test('the solver gives the same answer for the same seed', () => {
  fc.assert(fc.property(pool, fc.integer({ min: 1, max: 1000 }), (cards, seed) => {
    const run = () => solve({ slots: F343, rules: [], pool: cards, market: { enabled: true }, iterations: 200, restarts: 1, seed });
    const a = run();
    const b = run();
    return a.cost === b.cost && a.squad.every((s, i) => (s.player && s.player.key) === (b.squad[i].player && b.squad[i].player.key));
  }), { numRuns: 20 });
});
