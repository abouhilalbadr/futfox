// Fast chemistry estimate used while searching. It follows the FC 27 rules the Web App
// exposes (thresholds per nation/league/club, chemistry profiles for base, hero and icon
// cards). The final squad is re-checked with EA's own calculator when every card is
// a real club item, so small gaps here only cost search quality, not correctness.
(function (root) {
  'use strict';

  const PARAM = { NATION: 1, LEAGUE: 2, CLUB: 3 };
  const MAX_SLOT_CHEM = 3;

  // Values read from repositories.Chemistry on the FC 27 Web App (October 2026).
  const DEFAULT_THRESHOLDS = {
    [PARAM.NATION]: [2, 5, 8],
    [PARAM.LEAGUE]: [3, 5, 8],
    [PARAM.CLUB]: [2, 4, 7],
  };

  const DEFAULT_PROFILES = {
    base: { maxChem: false, contrib: { nation: 1, league: 1, club: 1 }, universalLeague: false },
    hero: { maxChem: true, contrib: { nation: 1, league: 1, club: 0 }, universalLeague: false },
    icon: { maxChem: true, contrib: { nation: 1, league: 1, club: 0 }, universalLeague: true },
  };

  function addTo(map, id, amount) {
    if (id == null || id <= 0 || !amount) return;
    map.set(id, (map.get(id) || 0) + amount);
  }

  function pointsFor(count, thresholds) {
    let points = 0;
    for (const t of thresholds) if (count >= t) points += 1;
    return points;
  }

  // slots: [{ typeId }], players: same length, a player or null per slot.
  function computeChemistry(slots, players, thresholds = DEFAULT_THRESHOLDS) {
    const nations = new Map();
    const leagues = new Map();
    const clubs = new Map();
    const inPosition = players.map((p, i) => !!p && p.positions.includes(slots[i].typeId));
    const universal = [];

    players.forEach((p, i) => {
      if (!inPosition[i]) return;
      const c = p.profile.contrib;
      addTo(nations, p.nationId, c.nation);
      addTo(clubs, p.clubId, c.club);
      if (p.profile.universalLeague) universal.push(c.league);
      else addTo(leagues, p.leagueId, c.league);
    });
    // Icons count towards every league already in the squad.
    for (const amount of universal) for (const id of leagues.keys()) addTo(leagues, id, amount);

    const perPlayer = players.map((p, i) => {
      if (!inPosition[i]) return 0;
      if (p.profile.maxChem) return MAX_SLOT_CHEM;
      const c = p.profile.contrib;
      let points = 0;
      if (c.nation) points += pointsFor(nations.get(p.nationId) || 0, thresholds[PARAM.NATION]);
      if (c.league) points += pointsFor(leagues.get(p.leagueId) || 0, thresholds[PARAM.LEAGUE]);
      if (c.club) points += pointsFor(clubs.get(p.clubId) || 0, thresholds[PARAM.CLUB]);
      return Math.min(points, MAX_SLOT_CHEM);
    });

    return { total: perPlayer.reduce((a, b) => a + b, 0), perPlayer, inPosition };
  }

  const api = { PARAM, DEFAULT_THRESHOLDS, DEFAULT_PROFILES, computeChemistry };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).chemistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
