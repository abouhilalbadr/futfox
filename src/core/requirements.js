// SBC requirements: turns the Web App's UTSBCEligibilityDTO data into rules and scores a
// squad against them. Key and scope numbers come from the SBCEligibilityKey and
// SBCEligibilityScope enums of the FC 27 Web App.
(function (root) {
  'use strict';

  const KEY = {
    TEAM_STAR_RATING: 0,
    PLAYER_COUNT: 2,
    PLAYER_QUALITY: 3,
    SAME_NATION_COUNT: 4,
    SAME_LEAGUE_COUNT: 5,
    SAME_CLUB_COUNT: 6,
    NATION_COUNT: 7,
    LEAGUE_COUNT: 8,
    CLUB_COUNT: 9,
    NATION_ID: 10,
    LEAGUE_ID: 11,
    CLUB_ID: 12,
    LEGEND_COUNT: 15,
    PLAYER_RARITY: 18,
    TEAM_RATING: 19,
    PLAYER_RARITY_GROUP: 25,
    PLAYER_MIN_OVR: 26,
    PLAYER_EXACT_OVR: 27,
    PLAYER_MAX_OVR: 28,
    FIRST_OWNER_PLAYERS_COUNT: 30,
    PLAYER_TRADABILITY: 33,
    CHEMISTRY_POINTS: 35,
    ALL_PLAYERS_CHEMISTRY_POINTS: 36,
  };

  const SCOPE_NAMES = { 0: 'min', 1: 'max', 2: 'exact' };
  const QUALITY = { bronze: 1, silver: 2, gold: 3 };
  const RARE = 1;

  const SUPPORTED = new Set([
    KEY.PLAYER_COUNT, KEY.PLAYER_QUALITY,
    KEY.SAME_NATION_COUNT, KEY.SAME_LEAGUE_COUNT, KEY.SAME_CLUB_COUNT,
    KEY.NATION_COUNT, KEY.LEAGUE_COUNT, KEY.CLUB_COUNT,
    KEY.NATION_ID, KEY.LEAGUE_ID, KEY.CLUB_ID,
    KEY.LEGEND_COUNT, KEY.PLAYER_RARITY, KEY.TEAM_RATING,
    KEY.PLAYER_MIN_OVR, KEY.PLAYER_EXACT_OVR, KEY.PLAYER_MAX_OVR,
    KEY.CHEMISTRY_POINTS, KEY.ALL_PLAYERS_CHEMISTRY_POINTS,
  ]);

  function qualityOf(rating) {
    if (rating >= 75) return QUALITY.gold;
    if (rating >= 65) return QUALITY.silver;
    return QUALITY.bronze;
  }

  // Accepts a UTSBCEligibilityDTO (or its JSON shape) and returns one rule.
  function parseRequirement(dto, label) {
    const pairs = (dto.kvPairs && (dto.kvPairs._collection || dto.kvPairs)) || {};
    const keys = Object.keys(pairs);
    const key = Number(keys[0]);
    const values = (pairs[keys[0]] || []).map(Number);
    return {
      key,
      scope: SCOPE_NAMES[dto.scope] || 'min',
      value: values[0],
      ids: values,
      count: typeof dto.count === 'number' ? dto.count : -1,
      label: label || describe(key, dto.scope, values, dto.count),
      supported: SUPPORTED.has(key) && keys.length === 1,
    };
  }

  function describe(key, scope, values, count) {
    const name = Object.keys(KEY).find((k) => KEY[k] === key) || `RULE_${key}`;
    const parts = [name.toLowerCase().replace(/_/g, ' '), SCOPE_NAMES[scope] || '', values.join('/')];
    if (count > 0) parts.push(`x${count}`);
    return parts.filter(Boolean).join(' ');
  }

  function miss(actual, scope, target) {
    if (scope === 'max') return Math.max(0, actual - target);
    if (scope === 'exact') return Math.abs(actual - target);
    return Math.max(0, target - actual);
  }

  function largestGroup(players, field) {
    const counts = new Map();
    let best = 0;
    for (const p of players) {
      const n = (counts.get(p[field]) || 0) + 1;
      counts.set(p[field], n);
      if (n > best) best = n;
    }
    return best;
  }

  function distinct(players, field) {
    return new Set(players.map((p) => p[field])).size;
  }

  function matchesRarity(player, ids) {
    return ids.some((id) => (id === RARE ? player.rarity >= RARE : player.rarity === id));
  }

  // How far a rule is from being met (0 = met). ctx: { players (filled slots only),
  // rating, chem: { total, perPlayer } }. Unsupported rules return 0 and are shown
  // to the user as "check yourself".
  function shortfall(rule, ctx) {
    const { players } = ctx;
    const target = rule.count > 0 ? rule.count : 1;
    switch (rule.key) {
      case KEY.PLAYER_COUNT:
        return miss(players.length, rule.scope, rule.value);
      case KEY.PLAYER_QUALITY: {
        const q = rule.value;
        if (rule.count > 0) return miss(players.filter((p) => p.quality === q).length, rule.scope, rule.count);
        return players.filter((p) => miss(p.quality, rule.scope, q) > 0).length;
      }
      case KEY.SAME_NATION_COUNT:
        return miss(largestGroup(players, 'nationId'), rule.scope, rule.value);
      case KEY.SAME_LEAGUE_COUNT:
        return miss(largestGroup(players, 'leagueId'), rule.scope, rule.value);
      case KEY.SAME_CLUB_COUNT:
        return miss(largestGroup(players, 'clubId'), rule.scope, rule.value);
      case KEY.NATION_COUNT:
        return miss(distinct(players, 'nationId'), rule.scope, rule.value);
      case KEY.LEAGUE_COUNT:
        return miss(distinct(players, 'leagueId'), rule.scope, rule.value);
      case KEY.CLUB_COUNT:
        return miss(distinct(players, 'clubId'), rule.scope, rule.value);
      case KEY.NATION_ID:
        return miss(players.filter((p) => rule.ids.includes(p.nationId)).length, rule.scope, target);
      case KEY.LEAGUE_ID:
        return miss(players.filter((p) => rule.ids.includes(p.leagueId)).length, rule.scope, target);
      case KEY.CLUB_ID:
        return miss(players.filter((p) => rule.ids.includes(p.clubId)).length, rule.scope, target);
      case KEY.LEGEND_COUNT:
        return miss(players.filter((p) => p.isIcon).length, rule.scope, rule.value);
      case KEY.PLAYER_RARITY: {
        const n = players.filter((p) => matchesRarity(p, rule.ids)).length;
        return miss(n, rule.scope, rule.count > 0 ? rule.count : players.length);
      }
      case KEY.TEAM_RATING:
        return miss(ctx.rating, rule.scope, rule.value);
      case KEY.PLAYER_MIN_OVR:
      case KEY.PLAYER_EXACT_OVR:
      case KEY.PLAYER_MAX_OVR: {
        const scope = rule.key === KEY.PLAYER_MIN_OVR ? 'min' : rule.key === KEY.PLAYER_MAX_OVR ? 'max' : 'exact';
        const fits = (p) => miss(p.rating, scope, rule.value) === 0;
        if (rule.count > 0) return miss(players.filter(fits).length, 'min', rule.count);
        return players.filter((p) => !fits(p)).length;
      }
      case KEY.CHEMISTRY_POINTS:
        return miss(ctx.chem.total, rule.scope, rule.value);
      case KEY.ALL_PLAYERS_CHEMISTRY_POINTS:
        return ctx.chem.perPlayer.reduce((sum, c) => sum + Math.max(0, rule.value - c), 0);
      default:
        return 0;
    }
  }

  const api = { KEY, QUALITY, SUPPORTED, qualityOf, parseRequirement, shortfall };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).requirements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
