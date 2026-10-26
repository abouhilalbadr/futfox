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

  // Cards keep counting toward Gallery sets after they leave the club (sold, used in an SBC); only
  // loans don't. The Web App can't show them then, so FutFox keeps every card it has seen:
  // memory is { cards: { [id]: card } }, newest MEMORY_LIMIT kept.
  const MEMORY_LIMIT = 5000;

  function rememberCards(memory, cards, now) {
    const kept = { ...((memory && memory.cards) || {}) };
    for (const card of cards) {
      // A loan never counts; one remembered before FutFox could tell it was a loan is dropped.
      if (card.loan) { delete kept[card.id]; continue; }
      const { collected, firstOwner, remembered, ...row } = card;
      kept[card.id] = { ...row, seenAt: now };
    }
    const ids = Object.keys(kept);
    if (ids.length > MEMORY_LIMIT) {
      ids.sort((a, b) => kept[b].seenAt - kept[a].seenAt).slice(MEMORY_LIMIT).forEach((id) => delete kept[id]);
    }
    return { cards: kept };
  }

  // The club's cards plus remembered ones the Web App doesn't hold now, marked remembered.
  function withRemembered(cards, memory) {
    const live = new Set(cards.map((c) => String(c.id)));
    const gone = Object.values((memory && memory.cards) || {})
      .filter((c) => !live.has(String(c.id)))
      .map(({ seenAt, ...c }) => ({ ...c, remembered: true }));
    return cards.concat(gone);
  }

  // Both memories together; for a card in both, the most recent sighting wins.
  function mergeMemory(a, b) {
    const cards = { ...((a && a.cards) || {}) };
    for (const card of Object.values((b && b.cards) || {})) {
      if (!cards[card.id] || (card.seenAt || 0) > (cards[card.id].seenAt || 0)) cards[card.id] = card;
    }
    const ids = Object.keys(cards);
    if (ids.length > MEMORY_LIMIT) ids.sort((x, y) => cards[y].seenAt - cards[x].seenAt).slice(MEMORY_LIMIT).forEach((id) => delete cards[id]);
    return { cards };
  }

  // Slots ticked "done in game" in either list ({ [setId]: [slot indexes] }).
  function mergeDone(a, b) {
    const out = {};
    for (const list of [a || {}, b || {}]) {
      for (const [setId, slots] of Object.entries(list)) {
        out[setId] = Array.from(new Set([...(out[setId] || []), ...slots.filter(Number.isInteger)])).sort((x, y) => x - y);
      }
    }
    return out;
  }

  // Cards picked for slots in either list ({ [setId]: { [slot index]: card } }); a slot picked in
  // both keeps the first list's card, so importing never replaces a pick.
  function mergePicked(a, b) {
    const out = {};
    for (const list of [b || {}, a || {}]) {
      for (const [setId, slots] of Object.entries(list)) out[setId] = { ...(out[setId] || {}), ...slots };
    }
    return out;
  }

  // The file FutFox exports: what this browser keeps for the Gallery, to move it to another
  // browser or keep a copy.
  const EXPORT_KIND = 'futfox-gallery-data';

  function exportData({ memory, done, picked, persona, now }) {
    return { kind: EXPORT_KIND, version: 1, exportedAt: now, persona: persona == null ? null : String(persona), cards: Object.values((memory && memory.cards) || {}), done: done || {}, picked: picked || {} };
  }

  // The memory, ticks and picks in an exported file, or an error that says why it can't be used.
  function readExport(json) {
    if (!json || json.kind !== EXPORT_KIND) return { error: "This isn't a FutFox Gallery data file." };
    if (json.version !== 1) return { error: 'This file comes from a newer FutFox. Update FutFox, then import it again.' };
    const cards = {};
    for (const card of Array.isArray(json.cards) ? json.cards : []) {
      if (card && card.id != null && !card.loan) cards[card.id] = card;
    }
    const done = {};
    for (const [setId, slots] of Object.entries(json.done && typeof json.done === 'object' ? json.done : {})) {
      if (Array.isArray(slots)) done[setId] = slots.filter(Number.isInteger);
    }
    const picked = {};
    for (const [setId, slots] of Object.entries(json.picked && typeof json.picked === 'object' ? json.picked : {})) {
      for (const [index, card] of Object.entries(slots && typeof slots === 'object' ? slots : {})) {
        if (/^\d+$/.test(index) && card && card.id != null) (picked[setId] = picked[setId] || {})[index] = card;
      }
    }
    return { memory: { cards }, done, picked, persona: json.persona || null };
  }

  const api = { readClubReply, galleryRows, filterRows, countByFilter, FILTERS, rememberCards, withRemembered, MEMORY_LIMIT, mergeMemory, mergeDone, mergePicked, exportData, readExport };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).gallery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
