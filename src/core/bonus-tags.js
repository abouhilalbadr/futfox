// Gallery bonus tags. Every set is graded against the same 21 tags; a tag is active when enough
// of the set's cards fit its rule. Each tag has up to three tiers (matching cards → percent), and
// its bonus is the reached tier's percent of the summed Item Scores of the matching cards:
//   set total = base score (every card's Item Score) + every active tag's bonus
// Cards: { id, playerId, score, nationId, clubId, leagueId, level ('bronze' | 'silver' | 'gold'),
// foil, icon, hero, totw, owners, weakFoot, skillMoves, positions: [EA position ids] }.
(function (root) {
  'use strict';

  // EA's position ids (the Web App's PlayerPosition).
  const GK = [0];
  const DEFENCE = [3, 4, 5, 6, 7]; // RB, RCB, CB, LCB, LB
  const MIDFIELD = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; // CDM, RM, CM, LM, CAM
  const ATTACK = [23, 24, 25, 26, 27]; // RW, ST, LW

  const canPlay = (ids) => (c) => (c.positions || []).some((p) => ids.includes(p));

  // The biggest group of cards sharing a value ("Same Nation"); ties go to the higher scores.
  function largestGroup(cards, key) {
    const groups = new Map();
    for (const c of cards) {
      const value = key(c);
      if (value == null) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(c);
    }
    let best = [];
    for (const group of groups.values()) {
      if (group.length > best.length || (group.length === best.length && sum(group) > sum(best))) best = group;
    }
    return best;
  }

  // One card per value ("Different Nation"): the highest-scoring card of each.
  function onePerValue(cards, key) {
    const best = new Map();
    for (const c of cards) {
      const value = key(c);
      if (value == null) continue;
      if (!best.has(value) || (c.score || 0) > (best.get(value).score || 0)) best.set(value, c);
    }
    return Array.from(best.values());
  }

  const sum = (cards) => cards.reduce((total, c) => total + (c.score || 0), 0);
  const where = (test) => (cards) => cards.filter(test);
  const tiers = (...pairs) => pairs.map(([count, percent]) => ({ count, percent }));

  const same = (key) => ({ group: key, pick: (cs) => largestGroup(cs, key) });
  const different = (key) => ({ pick: (cs) => onePerValue(cs, key) });
  const each = (test) => ({ test, pick: where(test) });

  // In the game's order. `test` (cards that fit) and `group` (the value they share) also tell the
  // set matcher which cards to try together.
  const TAGS = [
    { name: 'Same Nation', rule: 'Cards sharing the most common nation', ...same((c) => c.nationId), tiers: tiers([5, 1], [10, 2], [20, 4]) },
    { name: 'Different Nation', rule: 'Cards each from a different nation', ...different((c) => c.nationId), tiers: tiers([5, 1], [10, 2], [20, 4]) },
    { name: 'Same Club', rule: 'Cards sharing the most common club', ...same((c) => c.clubId), tiers: tiers([5, 1], [10, 2], [20, 4]) },
    { name: 'Different Club', rule: 'Cards each from a different club', ...different((c) => c.clubId), tiers: tiers([5, 1], [10, 2], [20, 4]) },
    { name: 'Same League', rule: 'Cards sharing the most common league', ...same((c) => c.leagueId), tiers: tiers([5, 1], [10, 2], [20, 8]) },
    { name: 'Different League', rule: 'Cards each from a different league', ...different((c) => c.leagueId), tiers: tiers([5, 1], [10, 2], [20, 4]) },
    { name: 'Bronze', rule: 'Bronze cards', ...each((c) => c.level === 'bronze'), tiers: tiers([5, 20], [10, 40], [20, 80]) },
    { name: 'Silver', rule: 'Silver cards', ...each((c) => c.level === 'silver'), tiers: tiers([5, 15], [10, 30], [20, 60]) },
    { name: 'Golden', rule: 'Gold cards', ...each((c) => c.level === 'gold'), tiers: tiers([5, 1], [10, 2], [20, 4]) },
    { name: 'Holographic', rule: 'Holographic cards', ...each((c) => Boolean(c.foil)), tiers: tiers([2, 8], [4, 12], [6, 20]) },
    { name: 'Iconic', rule: 'Icons', ...each((c) => Boolean(c.icon)), tiers: tiers([2, 10], [4, 15], [6, 25]) },
    { name: 'Heroic', rule: 'Heroes', ...each((c) => Boolean(c.hero)), tiers: tiers([2, 8], [4, 12], [6, 20]) },
    { name: 'TOTW', rule: 'Team of the Week cards', ...each((c) => Boolean(c.totw)), tiers: tiers([3, 4], [6, 8], [10, 15]) },
    { name: 'First Owner', rule: 'Cards nobody else has owned', ...each((c) => c.owners === 1), tiers: tiers([5, 150], [10, 300], [20, 500]) },
    { name: 'Hands Only', rule: 'Cards that can play GK', ...each(canPlay(GK)), tiers: tiers([3, 3], [6, 6], [10, 15]) },
    { name: 'Multiples!', rule: 'Copies of the same player', ...same((c) => c.playerId), tiers: tiers([2, 10], [3, 15], [4, 20]) },
    { name: 'Ambidextrous', rule: 'Cards with 5★ weak foot', ...each((c) => c.weakFoot === 5), tiers: tiers([3, 3], [5, 6], [10, 12]) },
    { name: 'Skilled', rule: 'Cards with 5★ skill moves', ...each((c) => c.skillMoves === 5), tiers: tiers([3, 3], [5, 6], [10, 12]) },
    { name: 'Defensive Wall', rule: 'Cards that can play CB, LB or RB', ...each(canPlay(DEFENCE)), tiers: tiers([5, 3], [10, 6], [15, 10]) },
    { name: 'Midfield Control', rule: 'Cards that can play CDM, CM, CAM, LM or RM', ...each(canPlay(MIDFIELD)), tiers: tiers([5, 3], [10, 6], [15, 10]) },
    { name: 'All out Attack', rule: 'Cards that can play ST, LW or RW', ...each(canPlay(ATTACK)), tiers: tiers([5, 3], [10, 6], [15, 10]) },
  ];

  // Every tag for these cards, in the game's order: how many match, the tier reached (null when
  // inactive), the next tier, and the bonus.
  function scoreTags(cards) {
    const list = TAGS.map((tag) => {
      const matching = tag.pick(cards);
      const count = matching.length;
      const tier = tag.tiers.filter((t) => count >= t.count).pop() || null;
      const next = tag.tiers.find((t) => count < t.count) || null;
      return { name: tag.name, rule: tag.rule, count, tier, next, bonus: tier ? Math.floor((tier.percent / 100) * sum(matching)) : 0 };
    });
    return { tags: list, active: list.filter((t) => t.tier), bonus: list.reduce((total, t) => total + t.bonus, 0) };
  }

  // Everything a tag can look at, except the player (Multiples!): two cards with the same key
  // change the tags in the same way, so only the best-scoring few of each are worth trying.
  const tagKey = (c) => [c.nationId, c.clubId, c.leagueId, c.level, Boolean(c.foil), Boolean(c.icon), Boolean(c.hero), Boolean(c.totw),
    c.owners === 1, c.weakFoot === 5, c.skillMoves === 5, canPlay(GK)(c), canPlay(DEFENCE)(c), canPlay(MIDFIELD)(c), canPlay(ATTACK)(c)].join('|');

  // Bronze below 65, silver 65 to 74, gold 75 and up: the game's card colours.
  const levelFor = (rating) => (rating == null ? null : rating >= 75 ? 'gold' : rating >= 65 ? 'silver' : 'bronze');

  const api = { TAGS, scoreTags, levelFor, tagKey };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).bonusTags = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
