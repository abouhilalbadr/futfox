// Picks the cheapest 11 that meet an SBC's rules, using simulated annealing over slot
// assignments. Club cards are preferred through their cost; market cards are generic
// "buy a player like this" templates the user searches for themselves.
(function (root) {
  'use strict';

  const isNode = typeof module === 'object' && module.exports;
  const NS = isNode ? null : root.FutFox;
  const requirements = isNode ? require('./requirements') : NS.requirements;
  const rating = isNode ? require('./rating') : NS.rating;
  const chemistry = isNode ? require('./chemistry') : NS.chemistry;

  // Rough coin estimates by rating for cards the user does not own. They are only a
  // tie-breaker between options; the panel lets the user replace them with real prices.
  const DEFAULT_PRICES = {
    bronze: 200, silver: 300,
    75: 350, 76: 350, 77: 400, 78: 450, 79: 500, 80: 650, 81: 750, 82: 1000,
    83: 1400, 84: 2200, 85: 3800, 86: 6500, 87: 9500, 88: 14000, 89: 19000, 90: 26000,
  };

  function estimatePrice(r, prices = DEFAULT_PRICES) {
    if (r < 65) return prices.bronze;
    if (r < 75) return prices.silver;
    if (prices[r] != null) return prices[r];
    return r > 90 ? prices[90] * Math.pow(1.4, r - 90) : prices[75];
  }

  // Small seeded PRNG so results are repeatable in tests.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list, rand) {
    return list[Math.floor(rand() * list.length)];
  }

  // Ratings worth suggesting from the market: bronze or silver SBCs need those cards,
  // and a high squad rating target needs higher-rated ones.
  function marketRatingRange(rules, market) {
    if (market.minRating && market.maxRating) return [market.minRating, market.maxRating];
    const quality = rules.find((r) => r.key === requirements.KEY.PLAYER_QUALITY && r.count < 0 && r.scope !== 'min');
    if (quality && quality.value === requirements.QUALITY.bronze) return [50, 64];
    if (quality && quality.value === requirements.QUALITY.silver) return [65, 74];
    const target = rules.find((r) => r.key === requirements.KEY.TEAM_RATING && r.scope !== 'max');
    return [75, Math.min(95, Math.max(86, target ? target.value + 3 : 0))];
  }

  function solve(input) {
    const {
      slots,
      rules,
      pool,
      market = { enabled: false },
      ratingFloat = true,
      thresholds = chemistry.DEFAULT_THRESHOLDS,
      iterations = 25000,
      restarts = 4,
      seed = 1,
    } = input;
    const required = input.requiredSlots || slots.map((_, i) => i);
    const rand = mulberry32(seed);
    const activeRules = rules.filter((r) => r.supported);
    const prices = market.prices || DEFAULT_PRICES;

    const byPosition = new Map();
    for (const s of slots) {
      if (!byPosition.has(s.typeId)) byPosition.set(s.typeId, pool.filter((p) => p.positions.includes(s.typeId)));
    }

    // Market templates: a rating, a league and (optionally) a nation for one position.
    let fresh = 0;
    const marketLeagues = market.leagues || [...new Set(pool.map((p) => p.leagueId))];
    const marketNations = market.nations || [...new Set(pool.map((p) => p.nationId))];
    const [minR, maxR] = marketRatingRange(activeRules, market);
    function marketPlayer(typeId, r, leagueId, nationId) {
      fresh += 1;
      const anyNation = nationId == null;
      return {
        key: `market:${fresh}`,
        defId: null,
        name: 'Buy',
        rating: r,
        quality: requirements.qualityOf(r),
        nationId: anyNation ? -fresh : nationId,
        leagueId,
        clubId: -fresh,
        rarity: 0,
        isIcon: false,
        positions: [typeId],
        profile: chemistry.DEFAULT_PROFILES.base,
        cost: estimatePrice(r, prices),
        source: 'market',
        search: { rating: r, leagueId, nationId: anyNation ? null : nationId, typeId },
      };
    }
    // A card to buy is always bought for the slot it ends up in.
    function retarget(p, typeId) {
      if (!p || p.source !== 'market' || p.positions[0] === typeId) return p;
      return { ...p, positions: [typeId], search: { ...p.search, typeId } };
    }
    function randomMarketPlayer(typeId) {
      const r = minR + Math.floor(Math.pow(rand(), 1.6) * (maxR - minR + 1));
      const nation = rand() < 0.5 ? null : pick(marketNations, rand);
      return marketPlayer(typeId, r, pick(marketLeagues, rand), nation);
    }

    const maxCost = Math.max(1000, ...pool.map((p) => p.cost), market.enabled ? estimatePrice(maxR, prices) : 0);
    const W = Math.min(2 * maxCost, 60000);

    function evaluate(assign) {
      const filled = required.map((i) => assign[i]).filter(Boolean);
      const chem = chemistry.computeChemistry(slots, assign, thresholds);
      const squadRating = rating.squadRating(assign.map((p) => (p ? p.rating : 0)), ratingFloat);
      const ctx = { players: filled, rating: squadRating, chem: { total: chem.total, perPlayer: required.map((i) => chem.perPlayer[i]) } };
      let violation = (required.length - filled.length) * 10;
      const ruleResults = activeRules.map((rule) => {
        const s = requirements.shortfall(rule, ctx);
        violation += rule.key === requirements.KEY.TEAM_RATING ? s * 3 : s;
        return { rule, shortfall: s };
      });
      const cost = filled.reduce((sum, p) => sum + p.cost, 0);
      return { violation, cost, energy: violation * W + cost, rating: squadRating, chem, ruleResults };
    }

    function usedKeys(assign) {
      const set = new Set();
      for (const p of assign) if (p && p.defId != null) set.add(p.defId);
      return set;
    }

    function greedy() {
      const assign = slots.map(() => null);
      const used = new Set();
      for (const i of required) {
        const options = (byPosition.get(slots[i].typeId) || []).filter((p) => !used.has(p.defId));
        const fallback = options.length ? options : pool.filter((p) => !used.has(p.defId));
        let best = null;
        for (const p of fallback) if (!best || p.cost < best.cost) best = p;
        if (best) { assign[i] = best; used.add(best.defId); }
        else if (market.enabled) assign[i] = marketPlayer(slots[i].typeId, minR, pick(marketLeagues, rand), null);
      }
      return assign;
    }

    function neighbour(assign) {
      const next = assign.slice();
      const i = pick(required, rand);
      const roll = rand();
      if (roll < 0.15 && required.length > 1) {
        const j = pick(required, rand);
        [next[i], next[j]] = [retarget(next[j], slots[i].typeId), retarget(next[i], slots[j].typeId)];
        return next;
      }
      if (market.enabled && (roll > 0.85 || pool.length === 0)) {
        next[i] = randomMarketPlayer(slots[i].typeId);
        return next;
      }
      const used = usedKeys(next);
      if (next[i] && next[i].defId != null) used.delete(next[i].defId);
      const inPos = byPosition.get(slots[i].typeId) || [];
      const source = roll < 0.7 && inPos.length ? inPos : pool;
      for (let tries = 0; tries < 8 && source.length; tries++) {
        const p = pick(source, rand);
        if (!used.has(p.defId)) { next[i] = p; return next; }
      }
      return next;
    }

    let bestFeasible = null;
    let bestAny = null;
    const better = (a, b) => !b || a.violation < b.violation || (a.violation === b.violation && a.cost < b.cost);

    for (let r = 0; r < restarts; r++) {
      // Later restarts start from a shaken-up greedy squad to explore elsewhere.
      let current = greedy();
      if (r > 0) for (let k = 0; k < 20; k++) current = neighbour(current);
      let score = evaluate(current);
      const t0 = W;
      const t1 = 1;
      for (let k = 0; k < iterations; k++) {
        const temp = t0 * Math.pow(t1 / t0, k / iterations);
        const cand = neighbour(current);
        const s = evaluate(cand);
        if (s.energy <= score.energy || rand() < Math.exp((score.energy - s.energy) / temp)) {
          current = cand;
          score = s;
          if (s.violation === 0 && better(s, bestFeasible)) bestFeasible = { ...s, assign: cand };
          if (better(s, bestAny)) bestAny = { ...s, assign: cand };
        }
      }
      if (score.violation === 0 && better(score, bestFeasible)) bestFeasible = { ...score, assign: current };
      if (better(score, bestAny)) bestAny = { ...score, assign: current };
    }

    const best = bestFeasible || bestAny;
    return {
      feasible: !!bestFeasible,
      violation: best.violation,
      cost: best.cost,
      rating: best.rating,
      chemistry: best.chem.total,
      ruleResults: best.ruleResults,
      unsupported: rules.filter((r) => !r.supported),
      squad: slots.map((slot, i) => ({
        slotIndex: i,
        typeId: slot.typeId,
        player: best.assign[i],
        chemistry: best.chem.perPlayer[i],
        inPosition: best.chem.inPosition[i],
      })),
    };
  }

  const api = { solve, estimatePrice, DEFAULT_PRICES };
  if (isNode) module.exports = api;
  else NS.solver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
