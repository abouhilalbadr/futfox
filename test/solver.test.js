const test = require('node:test');
const assert = require('node:assert/strict');

const { solve } = require('../src/core/solver');
const { parseRequirement, shortfall, qualityOf, KEY } = require('../src/core/requirements');
const { DEFAULT_PROFILES } = require('../src/core/chemistry');

// 3-4-3 as the Web App describes it (slot type ids).
const F343 = [0, 5, 5, 5, 12, 14, 14, 16, 23, 25, 27].map((typeId) => ({ typeId }));

function makePool(seed) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const positions = [[0], [5], [5, 10], [3, 7], [12, 16], [14, 10], [14, 18], [16, 12], [23, 27], [25], [27, 23]];
  const pool = [];
  for (let i = 0; i < 80; i++) {
    const rating = 72 + Math.floor(rand() * 16);
    const leagueId = [13, 16, 19, 31, 53][Math.floor(rand() * 5)];
    pool.push({
      key: `p${i}`,
      defId: 1000 + i,
      name: `Player ${i}`,
      rating,
      quality: qualityOf(rating),
      nationId: [14, 18, 21, 27, 45, 52][Math.floor(rand() * 6)],
      leagueId,
      clubId: leagueId * 100 + Math.floor(rand() * 4),
      rarity: rand() < 0.3 ? 1 : 0,
      isIcon: false,
      positions: positions[i % positions.length],
      profile: DEFAULT_PROFILES.base,
      cost: rating * 10,
      source: 'club',
    });
  }
  return pool;
}

const rule = (key, scope, values, count = -1) => parseRequirement({ kvPairs: { _collection: { [key]: values } }, count, scope });

test('solves a league and nation puzzle from the club', () => {
  const rules = [
    rule(KEY.LEAGUE_COUNT, 2, [3]),
    rule(KEY.NATION_COUNT, 0, [3]),
    rule(KEY.SAME_LEAGUE_COUNT, 1, [6]),
    rule(KEY.TEAM_RATING, 0, [78]),
  ];
  const result = solve({ slots: F343, rules, pool: makePool(7), seed: 3 });
  assert.equal(result.feasible, true);
  const players = result.squad.map((s) => s.player);
  assert.equal(players.filter(Boolean).length, 11);
  assert.equal(new Set(players.map((p) => p.defId)).size, 11, 'no card used twice');
  for (const r of rules) {
    assert.equal(shortfall(r, { players, rating: result.rating, chem: { total: result.chemistry, perPlayer: [] } }), 0, r.label);
  }
});

test('prefers cheaper cards when both meet the rules', () => {
  const pool = makePool(11);
  const rules = [rule(KEY.TEAM_RATING, 0, [75])];
  const result = solve({ slots: F343, rules, pool, seed: 5 });
  const cheapest11 = pool.map((p) => p.cost).sort((a, b) => a - b).slice(0, 11).reduce((a, b) => a + b, 0);
  assert.equal(result.feasible, true);
  assert.ok(result.cost <= cheapest11 * 1.15, `cost ${result.cost} should be near ${cheapest11}`);
});

test('meets a chemistry target', () => {
  const rules = [rule(KEY.CHEMISTRY_POINTS, 0, [20])];
  const result = solve({ slots: F343, rules, pool: makePool(21), seed: 9 });
  assert.equal(result.feasible, true);
  assert.ok(result.chemistry >= 20);
});

test('suggests market cards only when the club cannot cover the squad', () => {
  const pool = makePool(5).slice(0, 6);
  const result = solve({ slots: F343, rules: [rule(KEY.TEAM_RATING, 0, [70])], pool, market: { enabled: true, leagues: [13], nations: [14] }, seed: 2 });
  const bought = result.squad.filter((s) => s.player && s.player.source === 'market');
  assert.equal(result.feasible, true);
  assert.ok(bought.length >= 5, 'fills the gaps with cards to buy');
  for (const s of bought) assert.deepEqual(s.player.positions, [s.typeId]);
});

test('suggests silver cards to buy for a silver SBC', () => {
  const rules = [rule(KEY.PLAYER_QUALITY, 2, [2])];
  const result = solve({ slots: F343, rules, pool: [], market: { enabled: true, leagues: [13], nations: [14] }, seed: 4, iterations: 4000, restarts: 1 });
  assert.equal(result.feasible, true);
  for (const s of result.squad) assert.ok(s.player.rating >= 65 && s.player.rating <= 74, `rating ${s.player.rating}`);
});

test('reports an impossible squad instead of pretending', () => {
  const result = solve({ slots: F343, rules: [rule(KEY.TEAM_RATING, 0, [95])], pool: makePool(3), seed: 1, iterations: 3000, restarts: 1 });
  assert.equal(result.feasible, false);
  assert.ok(result.violation > 0);
});
