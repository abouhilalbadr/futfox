// Streamlined SBCs (EA's "one-click" challenges) have no formation: any cards the challenge
// accepts, up to a limit per submission, whose Item Scores add up to a points target. This picks
// the cheapest such set of cards.
(function (root) {
  'use strict';

  const total = (cards, field) => cards.reduce((sum, c) => sum + c[field], 0);

  // Cards in order of coins per point, with `toll` added to each card's cost: a higher toll
  // favours fewer, higher-scoring cards, which matters when the limit is tight.
  function fill(cards, need, limit, toll) {
    const order = cards.slice().sort((a, b) => (a.cost + toll) / a.score - (b.cost + toll) / b.score || b.score - a.score);
    const picks = [];
    let score = 0;
    for (const card of order) {
      if (score >= need || picks.length >= limit) break;
      picks.push(card);
      score += card.score;
    }
    return picks;
  }

  // Drops cards the target no longer needs, then swaps each picked card for the cheapest unpicked
  // one that still reaches the target.
  function tidy(picks, cards, need) {
    let set = picks.slice().sort((a, b) => b.cost - a.cost);
    let score = total(set, 'score');
    set = set.filter((card) => {
      if (score - card.score < need) return true;
      score -= card.score;
      return false;
    });
    const spare = cards.filter((c) => !set.includes(c)).sort((a, b) => a.cost - b.cost);
    for (let i = 0; i < set.length; i++) {
      const out = set[i];
      const swap = spare.find((c) => c.cost < out.cost && score - out.score + c.score >= need);
      if (!swap) continue;
      spare.splice(spare.indexOf(swap), 1, out);
      spare.sort((a, b) => a.cost - b.cost);
      score += swap.score - out.score;
      set[i] = swap;
    }
    return set;
  }

  // cards: [{ score, cost, ... }]. Resolves to { picks, score, cost, reached }; when the target
  // can't be reached within the limit, picks are the highest-scoring cards that fit. prefer:
  // 'cheapest' (the fewest coins) or 'fewest' (the fewest cards, then the fewest coins).
  function pickForScore({ cards, need, limit = 30, prefer = 'cheapest' }) {
    const usable = cards.filter((c) => c.score > 0);
    if (need <= 0) return { picks: [], score: 0, cost: 0, reached: true };
    // At least 1, so the tolls still favour fewer cards when every card is free.
    const typical = Math.max(1, usable.length ? total(usable, 'cost') / usable.length : 0);
    let best = null;
    const fewest = prefer === 'fewest';
    const better = (set, cost) => !best || (fewest
      ? set.length < best.picks.length || (set.length === best.picks.length && cost < best.cost)
      : cost < best.cost || (cost === best.cost && set.length < best.picks.length));
    for (const toll of [0, 0.25, 1, 4, 16, 64, 1e6].map((k) => k * typical)) {
      const picks = fill(usable, need, limit, toll);
      if (total(picks, 'score') < need) continue;
      const set = tidy(picks, usable, need);
      const cost = total(set, 'cost');
      if (better(set, cost)) best = { picks: set, cost };
    }
    if (!best) {
      const picks = usable.slice().sort((a, b) => b.score - a.score || a.cost - b.cost).slice(0, limit);
      return { picks, score: total(picks, 'score'), cost: total(picks, 'cost'), reached: false };
    }
    const picks = best.picks.sort((a, b) => b.score - a.score || a.cost - b.cost);
    return { picks, score: total(picks, 'score'), cost: best.cost, reached: true };
  }

  const api = { pickForScore };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).streamlined = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
