// Gallery sets from the FutFox admin, matched against the club.
// The published document (public/gallery in Firestore) holds every live set. A slot is one exact
// card ({ kind: 'card', playerId, rating, rarityId, ... }, playerId being EA's player id, the
// card's databaseId) or a rule ({ kind: 'rule', leagueId, nationId, minRating, rarityId, ... }).
// rarityId is EA's version number (the card's rareflag); null means any version. A rule with
// foil: true only takes Holographic cards (a foil finish on top of any version).
(function (root) {
  'use strict';

  const SCHEMA = 1;
  const GRADES = ['D', 'C', 'B', 'A', 'S'];
  const B = typeof module === 'object' && module.exports ? require('./bonus-tags') : root.FutFox.bonusTags;

  // Firestore's REST format ({ stringValue: 'x' }, { mapValue: { fields } } ...) as plain values.
  function fromValue(v) {
    if (!v || typeof v !== 'object') return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('mapValue' in v) return fromFields(v.mapValue.fields);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
    return null;
  }

  function fromFields(fields) {
    const out = {};
    for (const [key, value] of Object.entries(fields || {})) out[key] = fromValue(value);
    return out;
  }

  // The published document, or null when it isn't one FutFox understands.
  function readGallery(doc) {
    const data = doc && doc.fields ? fromFields(doc.fields) : null;
    if (!data || data.schema !== SCHEMA || !Array.isArray(data.sets)) return null;
    const sets = data.sets.filter((s) => s && s.name && Array.isArray(s.slots));
    return { publishedAt: data.publishedAt || 0, sets };
  }

  const fitsVersion = (slot, card) => (slot.rarityIds && slot.rarityIds.length ? slot.rarityIds.includes(card.rarityId) : slot.rarityId == null || card.rarityId === slot.rarityId);
  const knowsVersion = (slot) => slot.rarityId != null || Boolean(slot.rarityIds && slot.rarityIds.length);

  const inList = (list, value) => !list || !list.length || list.includes(value);

  function fitsRule(slot, card) {
    if (!fitsVersion(slot, card)) return false;
    if (slot.foil && !card.foil) return false;
    if (!inList(slot.clubIds, card.clubId) || !inList(slot.leagueIds, card.leagueId)) return false;
    if (slot.leagueId != null && card.leagueId !== slot.leagueId) return false;
    if (slot.nationId != null && card.nationId !== slot.nationId) return false;
    if (slot.minRating != null && card.rating < slot.minRating) return false;
    return true;
  }

  // Whether a card can go in a slot: the slot's exact card, or one its rule takes.
  const fitsSlot = (slot, card) => (slot.kind === 'card'
    ? card.playerId === slot.playerId && (slot.rating == null || card.rating === slot.rating) && fitsVersion(slot, card)
    : fitsRule(slot, card));

  const byScore = (a, b) => (b.score || 0) - (a.score || 0) || b.rating - a.rating;

  const totalOf = (cards) => cards.reduce((sum, c) => sum + (c.score || 0), 0) + B.scoreTags(cards).bonus;

  // Highest score first is not always the best pick: five First Owner cards (+150%) can beat five
  // higher-scored ones, and swapping one card at a time never gets there (one First Owner card
  // earns nothing). So the set is also filled leaning on each tag in turn (its cards first, or for
  // "Same" tags the most common values), the best of those starts is kept, and then a slot's card
  // is swapped for an unused one that fits whenever that raises the total, until no swap helps.
  // Cards that look the same to every tag are tried only for their best ones, and swaps are capped,
  // so a big club stays quick; the result is a good pick, not a proven best one.
  const MAX_TRIES = 3000;
  const GROUP_VALUES = 3;

  // Fills every entry from its shortlist: cards that `prefer` first, then by score.
  function fill(order, shortlist, prefer) {
    const taken = new Set();
    const picks = new Map();
    for (const entry of order) {
      const free = shortlist.get(entry).filter((c) => !taken.has(c.id));
      const card = free.find(prefer) || free[0] || null;
      if (card) taken.add(card.id);
      picks.set(entry, card);
    }
    return picks;
  }

  function seeds(cards) {
    const out = [() => false];
    for (const tag of B.TAGS) {
      if (tag.test) out.push(tag.test);
      if (!tag.group) continue;
      const counts = new Map();
      for (const c of cards) { const v = tag.group(c); if (v != null) counts.set(v, (counts.get(v) || 0) + 1); }
      Array.from(counts).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, GROUP_VALUES)
        .forEach(([value]) => out.push((c) => tag.group(c) === value));
    }
    return out;
  }

  // fixed: cards already in the set that FutFox doesn't choose (picked ones); they count toward the tags.
  function bestCards(entries, fits, used, fixed) {
    const shortlist = new Map();
    for (const entry of entries) {
      const perKey = new Map();
      const list = [];
      for (const c of fits.get(entry).slice().sort(byScore)) {
        const key = B.tagKey(c);
        const n = perKey.get(key) || 0;
        if (n >= entries.length) continue; // more than the set's slots can never all be used
        perKey.set(key, n + 1);
        list.push(c);
      }
      shortlist.set(entry, list);
    }
    const placed = () => entries.filter((e) => e.card).map((e) => e.card);
    // Exact-card slots first, then the slots with the fewest cards that fit.
    const order = entries.slice().sort((a, b) => (a.slot.kind === 'card' ? 0 : 1) - (b.slot.kind === 'card' ? 0 : 1) || shortlist.get(a).length - shortlist.get(b).length);
    const pool = Array.from(new Map(entries.flatMap((e) => shortlist.get(e)).map((c) => [c.id, c])).values());
    const totalWith = (cards) => totalOf(fixed.concat(cards));
    let current = totalWith(placed());
    for (const prefer of seeds(pool)) {
      const picks = fill(order, shortlist, prefer);
      const cards = Array.from(picks.values()).filter(Boolean);
      const total = totalWith(cards);
      // A start must fill as many slots as the current pick: an empty slot is never worth a bonus.
      if (cards.length >= placed().length && total > current) {
        for (const e of entries) { if (e.card) used.delete(e.card.id); }
        for (const [e, c] of picks) { e.card = c; if (c) used.add(c.id); }
        current = total;
      }
    }
    let tries = 0;
    let improved = true;
    while (improved && tries < MAX_TRIES) {
      improved = false;
      for (const entry of entries) {
        if (!entry.card) continue;
        for (const c of shortlist.get(entry)) {
          if (used.has(c.id)) continue;
          if (++tries > MAX_TRIES) break;
          const was = entry.card;
          entry.card = c;
          const total = totalWith(placed());
          if (total > current) {
            used.delete(was.id);
            used.add(c.id);
            current = total;
            improved = true;
            break;
          }
          entry.card = was;
        }
      }
    }
  }

  function gradeFor(score, grades) {
    let best = null;
    for (const g of GRADES) {
      const min = grades && grades[g];
      if (min != null && score >= min) best = g;
    }
    return best;
  }

  // Which slots the club covers. Each club card fills one slot at most: exact cards first, then
  // rules, each taking the highest-scoring card left; then cards are swapped in while that raises
  // the total with bonus tags (see bestCards). A slot that names a version without its
  // number (saved before the admin had EA's version list) can't be checked, so it is "unsure".
  // done: indexes of slots the player ticked as filled in the game (with a card FutFox can't see,
  // like one used in an SBC before FutFox remembered it). They count as filled and take no card.
  // picked: { [slot index]: card } the player picked for slots filled in the game with a card FutFox
  // never saw; each fills its slot with its own Item Score and bonus tags, and takes no club card.
  function matchSet(set, cards, done, picked) {
    const used = new Set();
    const ticked = new Set(done || []);
    const chosen = picked || {};
    const slots = set.slots.map((slot, i) => {
      const card = slot && chosen[i] ? chosen[i] : null;
      return { slot, card, unsure: false, picked: Boolean(card), done: Boolean(slot) && !card && ticked.has(i) };
    });
    const take = (entry, candidates) => {
      const card = candidates.filter((c) => !used.has(c.id)).sort(byScore)[0];
      if (!card) return;
      used.add(card.id);
      entry.card = card;
    };
    for (const entry of slots) {
      const s = entry.slot;
      if (s && s.kind === 'card' && !entry.done && !entry.picked) take(entry, cards.filter((c) => fitsSlot(s, c)));
    }
    const fits = new Map();
    for (const entry of slots) {
      const s = entry.slot;
      if (!s || entry.done || entry.picked) continue;
      const candidates = cards.filter((c) => fitsSlot(s, c));
      fits.set(entry, candidates);
      if (s.kind === 'rule') take(entry, candidates);
    }
    bestCards(slots.filter((e) => fits.has(e)), fits, used, slots.filter((e) => e.picked).map((e) => e.card));
    for (const entry of slots) entry.unsure = Boolean(entry.card && !entry.picked && entry.slot.version && !knowsVersion(entry.slot));
    const open = slots.filter((e) => e.slot);
    const have = open.filter((e) => e.card || e.done).length;
    const baseScore = open.reduce((sum, e) => sum + (e.card ? e.card.score || 0 : 0), 0);
    // Bonus tags count the cards that would go in the set, so the grade includes their bonus.
    const tags = B.scoreTags(open.filter((e) => e.card).map((e) => e.card));
    const score = baseScore + tags.bonus;
    return {
      id: set.id,
      name: set.name,
      group: set.group || '',
      tokens: set.tokens || 0,
      slots,
      have,
      total: open.length,
      missing: open.filter((e) => !e.card && !e.done).map((e) => e.slot),
      unsure: open.filter((e) => e.unsure).length,
      baseScore,
      bonus: tags.bonus,
      tags: tags.tags,
      score,
      grade: gradeFor(score, set.grades),
      grades: set.grades || {},
      rewards: set.rewards || {},
    };
  }

  // The cards for every empty slot, since a set is only complete with all its slots filled, chosen
  // so it reaches `grade`. options: { [slot index]: cards that fit that slot }, each card with source
  // 'club' (in the club, not in this set) or 'search' (the squad builder list). Each slot first gets
  // its best club card, else the lowest-scoring card from the list; slots with fewer cards to offer
  // choose first. While the score is short of the grade, cards are swapped for higher ones from the
  // list (list cards before club cards): the lowest swap that reaches the grade, else the one that
  // raises the score most (bonus tags included). A card goes in a set once, so a card already in the
  // set or the plan is not offered again; other versions of the same player are. Slots with no card
  // to offer stay empty (unfilled).
  // The same card: EA's card id (defId) where both have one, else the same player, version and
  // rating. A holographic card counts apart from the same card without the foil.
  const sameCard = (a, b) => Boolean(a.foil) === Boolean(b.foil)
    && (a.defId && b.defId ? a.defId === b.defId : a.playerId === b.playerId && a.rarityId === b.rarityId && a.rating === b.rating);
  function planGrade(res, grade, options) {
    const goal = res.grades && res.grades[grade];
    if (goal == null) return null;
    const scoreOf = (cards) => cards.reduce((sum, c) => sum + (c.score || 0), 0) + B.scoreTags(cards).bonus;
    const fixed = res.slots.filter((e) => e.card).map((e) => e.card);
    const taken = fixed.slice();
    const isTaken = (c) => taken.some((t) => sameCard(t, c));
    const open = res.slots.map((e, i) => i).filter((i) => res.slots[i].slot && !res.slots[i].card && !res.slots[i].done);
    const free = (i) => (options[i] || []).filter((c) => !isTaken(c));
    const picks = new Map();
    for (const i of open.slice().sort((a, b) => free(a).length - free(b).length || a - b)) {
      const cards = free(i);
      const card = cards.filter((c) => c.source === 'club').sort(byScore)[0]
        || cards.filter((c) => c.source === 'search').sort((a, b) => (a.score || 0) - (b.score || 0))[0];
      if (!card) continue;
      picks.set(i, card);
      taken.push(card);
    }
    const all = () => fixed.concat([...picks.values()]);
    let score = scoreOf(all());
    for (const swappable of ['search', 'club']) {
      while (score < goal) {
        let best = null;
        let finish = null;
        for (const [index, now] of picks) {
          if (now.source !== swappable) continue;
          const others = all().filter((c) => c !== now);
          for (const card of options[index]) {
            if (card.source !== 'search' || isTaken(card)) continue;
            const after = scoreOf(others.concat(card));
            if (after <= score) continue;
            if (!best || after > best.after) best = { index, card, after };
            if (after >= goal && (!finish || after < finish.after)) finish = { index, card, after };
          }
        }
        const step = finish || best;
        if (!step) break;
        taken.splice(taken.indexOf(picks.get(step.index)), 1, step.card);
        picks.set(step.index, step.card);
        score = step.after;
      }
    }
    const cards = all();
    const adds = [...picks].sort((a, b) => a[0] - b[0]).map(([index, card]) => ({ index, card, gain: score - scoreOf(cards.filter((c) => c !== card)) }));
    const unfilled = open.length - picks.size;
    return { grade, goal, from: res.score, score, bonus: B.scoreTags(cards).bonus, reached: score >= goal, adds, unfilled, complete: unfilled === 0 };
  }

  // What picture stands for a set, or a whole category given all its sets' slots: the club when every
  // slot is for the same club, else its league logos when its slots name at most two leagues (men's
  // and women's, most used first), else the card of the first version when every slot names versions
  // (TOTW, Heroes), else null (Holographics, mixed-league categories).
  function picture(slots) {
    const open = slots.filter(Boolean);
    if (!open.length) return null;
    const firstClub = (s) => (s.clubIds && s.clubIds.length ? s.clubIds[0] : null);
    const club = firstClub(open[0]);
    if (club != null && open.every((s) => firstClub(s) === club)) return { club };
    const firstVersion = (s) => (s.rarityIds && s.rarityIds.length ? s.rarityIds[0] : s.rarityId != null ? s.rarityId : null);
    if (open.every((s) => firstVersion(s) != null && !(s.leagueIds && s.leagueIds.length) && s.leagueId == null)) return { rarity: firstVersion(open[0]) };
    const counts = new Map();
    for (const s of open) {
      const ids = s.leagueIds && s.leagueIds.length ? s.leagueIds : s.leagueId != null ? [s.leagueId] : [];
      if (!ids.length) return null;
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
    }
    if (counts.size > 2) return null;
    return { leagues: Array.from(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id) };
  }

  // Every set, closest to complete first.
  // doneBySet: { [setId]: [slot indexes] } ticked as done in the game; pickedBySet: { [setId]:
  // { [slot index]: card } } picked for slots filled in the game.
  function matchAll(sets, cards, doneBySet, pickedBySet) {
    return sets
      .map((s) => matchSet(s, cards, doneBySet && doneBySet[s.id], pickedBySet && pickedBySet[s.id]))
      .sort((a, b) => b.have / (b.total || 1) - a.have / (a.total || 1) || a.name.localeCompare(b.name));
  }

  const api = { SCHEMA, GRADES, fromValue, readGallery, fitsSlot, matchSet, matchAll, gradeFor, planGrade, picture };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).setMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
