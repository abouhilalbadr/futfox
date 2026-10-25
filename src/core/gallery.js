// FUT Gallery details for club cards. EA sends three of them in club list replies:
// gradingScore (the Gallery Item Score, kept by the Web App as item.sbsScore), owners
// (1 means nobody else has owned the card, so it is likely First Owner) and isCollected,
// which the Web App drops and which EA only includes when it is true.
(function (root) {
  'use strict';

  // Card ids in a club list reply ({ itemData: [...] }), and the ones EA marks as collected.
  function readClubReply(reply) {
    const items = reply && Array.isArray(reply.itemData) ? reply.itemData : [];
    const seen = [];
    const collected = [];
    for (const item of items) {
      if (!item || item.id == null) continue;
      seen.push(item.id);
      if (item.isCollected === true) collected.push(item.id);
    }
    return { seen, collected };
  }

  // cards: [{ id, rating, score, owners, ... }]. `collected` is true when EA marked the card,
  // false when FutFox read the card's reply and found no mark, and null when it never saw one.
  function galleryRows(cards, { seen, collected }) {
    return cards
      .map((card) => ({
        ...card,
        collected: collected.has(card.id) ? true : seen.has(card.id) ? false : null,
        firstOwner: card.owners === 1,
      }))
      .sort((a, b) => b.score - a.score || b.rating - a.rating);
  }

  const FILTERS = {
    all: () => true,
    collected: (row) => row.collected === true,
    unmarked: (row) => row.collected === false,
    firstOwner: (row) => row.firstOwner,
  };

  function filterRows(rows, filter) {
    return rows.filter(FILTERS[filter] || FILTERS.all);
  }

  // How many rows each filter shows, so the counts always match the list.
  function countByFilter(rows) {
    const out = {};
    for (const name of Object.keys(FILTERS)) out[name] = filterRows(rows, name).length;
    return out;
  }

  const api = { readClubReply, galleryRows, filterRows, countByFilter, FILTERS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).gallery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
