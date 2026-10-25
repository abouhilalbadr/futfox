const test = require('node:test');
const assert = require('node:assert/strict');

const { squadRating } = require('../src/core/rating');
const { computeChemistry, DEFAULT_PROFILES } = require('../src/core/chemistry');
const { parseRequirement, shortfall, KEY } = require('../src/core/requirements');

test('squad rating follows the float formula', () => {
  const ratings = [83, 85, 85, 83, 83, 86, 87, 90, 85, 85, 88];
  assert.equal(squadRating(ratings, true), 86);
  assert.equal(squadRating(Array(11).fill(83), true), 83);
});

test('squad rating follows the integer formula', () => {
  const ratings = [83, 85, 85, 83, 83, 86, 87, 90, 85, 85, 88];
  assert.equal(squadRating(ratings, false), 86);
  // floor(900 / 11) = 81, five 90s add 9 each: 945 / 11 = 85.9.
  assert.equal(squadRating([90, 90, 90, 90, 90, 75, 75, 75, 75, 75, 75], false), 85);
});

test('an incomplete squad still divides by 11', () => {
  const ratings = Array(10).fill(84).concat([0]);
  assert.equal(squadRating(ratings, true), 83);
});

const slot = (typeId) => ({ typeId });
const player = (over) => ({
  rating: 80, nationId: 1, leagueId: 1, clubId: 1, positions: [5], profile: DEFAULT_PROFILES.base, ...over,
});

test('a full squad from one club, league and nation has 33 chemistry', () => {
  const slots = Array(11).fill(slot(5));
  const players = slots.map(() => player());
  assert.equal(computeChemistry(slots, players).total, 33);
});

test('players out of position get no chemistry and do not count for others', () => {
  const slots = [slot(5), slot(5), slot(25)];
  const players = [player(), player(), player({ positions: [5] })];
  const chem = computeChemistry(slots, players);
  assert.equal(chem.perPlayer[2], 0);
  // Two club mates (club 1 point), two from the nation (1 point), league below 3 (0 points).
  assert.deepEqual(chem.perPlayer.slice(0, 2), [2, 2]);
});

test('heroes and icons always have full chemistry in position', () => {
  const slots = [slot(5), slot(25)];
  const players = [player({ profile: DEFAULT_PROFILES.hero }), player({ profile: DEFAULT_PROFILES.icon, positions: [25], nationId: 9 })];
  assert.deepEqual(computeChemistry(slots, players).perPlayer, [3, 3]);
});

test('requirements parse the Web App shape', () => {
  const rule = parseRequirement({ kvPairs: { _collection: { 8: [3] } }, count: -1, scope: 2 });
  assert.equal(rule.key, KEY.LEAGUE_COUNT);
  assert.equal(rule.scope, 'exact');
  assert.equal(rule.value, 3);
  assert.equal(rule.supported, true);
});

test('unknown requirement keys are flagged, not guessed', () => {
  const rule = parseRequirement({ kvPairs: { _collection: { 25: [4] } }, count: 1, scope: 0 });
  assert.equal(rule.supported, false);
});

test('shortfall measures distance from each rule', () => {
  const players = [
    { leagueId: 1, nationId: 1, clubId: 1, quality: 3, rating: 80, rarity: 0 },
    { leagueId: 2, nationId: 1, clubId: 2, quality: 3, rating: 82, rarity: 1 },
    { leagueId: 2, nationId: 2, clubId: 2, quality: 2, rating: 70, rarity: 3 },
  ];
  const ctx = { players, rating: 78, chem: { total: 20, perPlayer: [3, 1, 0] } };
  const rule = (key, scope, values, count = -1) => parseRequirement({ kvPairs: { _collection: { [key]: values } }, count, scope });
  assert.equal(shortfall(rule(KEY.LEAGUE_COUNT, 2, [3]), ctx), 1);
  assert.equal(shortfall(rule(KEY.SAME_CLUB_COUNT, 1, [1]), ctx), 1);
  assert.equal(shortfall(rule(KEY.PLAYER_QUALITY, 2, [3]), ctx), 1);
  assert.equal(shortfall(rule(KEY.PLAYER_QUALITY, 0, [3], 2), ctx), 0);
  assert.equal(shortfall(rule(KEY.TEAM_RATING, 0, [80]), ctx), 2);
  assert.equal(shortfall(rule(KEY.CHEMISTRY_POINTS, 0, [25]), ctx), 5);
  assert.equal(shortfall(rule(KEY.ALL_PLAYERS_CHEMISTRY_POINTS, 0, [1]), ctx), 1);
  assert.equal(shortfall(rule(KEY.LEAGUE_ID, 0, [2], 2), ctx), 0);
  assert.equal(shortfall(rule(KEY.PLAYER_RARITY, 0, [1], 2), ctx), 0);
  assert.equal(shortfall(rule(KEY.PLAYER_MIN_OVR, 0, [80]), ctx), 1);
});
