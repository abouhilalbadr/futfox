// Squad rating, matching UTSquadEntity._calculateRating in the FC 27 Web App for SBC squads
// (field players only). EA switches between two formulas with the server setting
// SQUAD_RATING_FLOAT_CALCULATION_ENABLED; both are implemented here.
(function (root) {
  'use strict';

  function squadRating(ratings, useFloat) {
    // EA always divides by the 11 field slots, so an incomplete squad rates lower.
    const slots = 11;
    const valid = ratings.filter((r) => typeof r === 'number' && r > 0);
    if (valid.length === 0) return 0;
    let total = valid.reduce((sum, r) => sum + r, 0);

    if (useFloat) {
      const avg = Math.min(total / slots, 99);
      let adjusted = total;
      for (const r of valid) if (r > avg) adjusted += r - avg;
      total = Math.round(adjusted);
    } else {
      const avg = Math.min(Math.floor(total / slots), 99);
      for (const r of valid) if (r > avg) total += r - avg;
    }
    return Math.min(Math.max(Math.floor(total / slots), 0), 99);
  }

  const api = { squadRating };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).rating = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
