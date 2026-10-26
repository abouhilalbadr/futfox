// Gallery set rules shared by the admin page, the scripts and the tests.
// A set has a fixed number of slots. Each slot is empty (null), one exact card
// ({ kind: 'card', playerId, name, rating, rarityId, version }) or a rule that any matching card
// fills ({ kind: 'rule', label, rarityId, rarityIds, version, leagueId, nationId, minRating }).
// rarityId is EA's version number (a card's rareflag, 3 = Team of the Week); version is its
// name, kept for display. A null rarityId means any version. A rule can instead accept several
// versions (rarityIds), as the game's sets do: "POTM" takes every league's POTM version. Club and
// league sets use clubIds and leagueIds the same way: a card fits when its club and its league are
// in the lists (an empty list means any).
(function (root) {
  'use strict';

  const GRADES = ['D', 'C', 'B', 'A', 'S'];
  // EA's files the admin copies. The content folder id in the player list address can change when
  // EA updates the Web App; the current one shows in the Web App's network requests.
  const EA_CONTENT_ID = '27A3C9F1-6B2E-4D7A-8C1F-2E9B5A4D6C7E';
  const EA_PLAYERS_URL = `https://www.ea.com/ea-sports-fc/ultimate-team/web-app/content/${EA_CONTENT_ID}/2027/fut/items/web/players.json`;
  const EA_VERSIONS_URL = 'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/loc/en-US.json';
  // Every FC 27 club and the league it plays in. EA's text file also names clubs from older games
  // (an old "Madrid", "FC United"), which no FC 27 card belongs to.
  const EA_TEAMS_URL = `https://www.ea.com/ea-sports-fc/ultimate-team/web-app/content/${EA_CONTENT_ID}/2027/fut/config/companion/teamconfig.json`;
  const PLAYER_CHUNK = 5000;
  const MAX_SLOTS = 40;
  const MAX_TAGS = 60;
  const SCHEMA = 1;

  const text = (value, max) => String(value == null ? '' : value).trim().slice(0, max);

  function whole(value, min, max) {
    const n = Number(value);
    if (value === '' || value == null || !Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function emptySet(name) {
    const grades = {};
    const rewards = {};
    for (const g of GRADES) { grades[g] = null; rewards[g] = ''; }
    return { name: name || 'New set', group: '', slotCount: 20, tokens: 0, status: 'draft', slots: new Array(20).fill(null), grades, rewards, bonusTags: [], updatedAt: 0 };
  }

  function idList(list, min, max) {
    const ids = Array.isArray(list) ? list.map((n) => whole(n, min, max)).filter((n) => n != null) : [];
    return Array.from(new Set(ids)).sort((a, b) => a - b).slice(0, 60);
  }

  function cleanSlot(slot) {
    if (!slot || typeof slot !== 'object') return null;
    if (slot.kind === 'card') {
      const playerId = whole(slot.playerId, 1, Number.MAX_SAFE_INTEGER);
      if (playerId == null) return null;
      return { kind: 'card', playerId, name: text(slot.name, 60), rating: whole(slot.rating, 1, 99), rarityId: whole(slot.rarityId, 0, 1e6), version: text(slot.version, 60) };
    }
    if (slot.kind === 'rule') {
      const label = text(slot.label, 60);
      if (!label) return null;
      const rarityIds = idList(slot.rarityIds, 0, 1e6);
      return {
        kind: 'rule', label, rarityId: rarityIds.length ? null : whole(slot.rarityId, 0, 1e6), rarityIds, version: text(slot.version, 60),
        clubIds: idList(slot.clubIds, 1, 1e9), leagueIds: idList(slot.leagueIds, 1, 1e9),
        leagueId: whole(slot.leagueId, 1, 1e9), nationId: whole(slot.nationId, 1, 1e9), minRating: whole(slot.minRating, 1, 99),
        // Holographic is a foil finish EA can put on any version, not a version of its own.
        ...(slot.foil === true ? { foil: true } : {}),
      };
    }
    return null;
  }

  // Tidies what the admin form sends and lists anything that blocks saving.
  function normalizeSet(raw) {
    const errors = [];
    const src = raw || {};
    const slotCount = whole(src.slotCount, 1, MAX_SLOTS) || 1;
    const slots = Array.from({ length: slotCount }, (_, i) => cleanSlot((src.slots || [])[i]));
    const grades = {};
    const rewards = {};
    for (const g of GRADES) {
      grades[g] = whole(src.grades && src.grades[g], 0, 1e9);
      rewards[g] = text(src.rewards && src.rewards[g], 80);
    }
    const bonusTags = (Array.isArray(src.bonusTags) ? src.bonusTags : [])
      .map((t) => ({ name: text(t && t.name, 60), condition: text(t && t.condition, 160), reward: text(t && t.reward, 60) }))
      .filter((t) => t.name || t.condition)
      .slice(0, MAX_TAGS);
    const set = {
      name: text(src.name, 80),
      group: text(src.group, 80),
      slotCount,
      tokens: whole(src.tokens, 0, 1e6) || 0,
      status: src.status === 'live' ? 'live' : 'draft',
      slots,
      grades,
      rewards,
      bonusTags,
      updatedAt: whole(src.updatedAt, 0, Number.MAX_SAFE_INTEGER) || 0,
    };

    if (!set.name) errors.push('Give the set a name.');
    let last = -1;
    for (const g of GRADES) {
      const min = grades[g];
      if (min == null) continue;
      if (min <= last) errors.push(`Grade ${g} needs a higher score than the grade before it.`);
      last = min;
    }
    if (set.status === 'live' && slots.every((s) => s === null)) errors.push('A live set needs at least one slot.');
    return { set, errors };
  }

  function filledCount(set) {
    return (set.slots || []).filter(Boolean).length;
  }

  // The document FutFox downloads: every live set, without editing details.
  const publicSet = (s) => ({ id: s.id, name: s.name, group: s.group, tokens: s.tokens, grades: s.grades, rewards: s.rewards || {}, slots: s.slots, bonusTags: s.bonusTags });

  function publicBundle(sets, now) {
    const live = sets
      .filter((s) => s.status === 'live')
      .map(publicSet)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { schema: SCHEMA, publishedAt: now, sets: live };
  }

  // JSON with object keys sorted, so the same set reads the same whatever order Firestore keeps its fields in.
  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
    return JSON.stringify(value === undefined ? null : value);
  }

  // What publishing would change for FutFox users: Live sets that are new or edited, and published sets
  // that were set back to Draft or deleted. Drafts never reach FutFox, so editing one changes nothing here.
  function publishChanges(sets, published) {
    const before = new Map((published || []).map((p) => [p.id, stableJson(p)]));
    const live = sets.filter((s) => s.status === 'live');
    const liveIds = new Set(live.map((s) => s.id));
    const name = (s) => (s.group ? `${s.name} (${s.group})` : s.name);
    return {
      added: live.filter((s) => !before.has(s.id)).map(name),
      changed: live.filter((s) => before.has(s.id) && before.get(s.id) !== stableJson(publicSet(s))).map(name),
      removed: (published || []).filter((p) => !liveIds.has(p.id)).map(name),
    };
  }


  // EA's players.json ({ Players: [...], LegendsPlayers: [...] }) as [id, name, rating] rows.
  function parseEaPlayers(json) {
    const rows = [];
    const seen = new Set();
    for (const list of [json && json.Players, json && json.LegendsPlayers]) {
      for (const p of Array.isArray(list) ? list : []) {
        if (!p || !Number.isInteger(p.id) || seen.has(p.id)) continue;
        const name = p.c || [p.f, p.l].filter(Boolean).join(' ');
        if (!name) continue;
        seen.add(p.id);
        rows.push([p.id, name, Number.isInteger(p.r) ? p.r : 0]);
      }
    }
    return rows.sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]));
  }

  // EA's version names from the Web App's text file (loc/en-US.json) as [number, name] rows.
  // The same number can appear under several keys; the earlier key wins.
  const VERSION_KEYS = [/^item\.raretype(\d+)$/, /^Player_Rarity_(\d+)$/, /^FUT_POA_PLAYER_RARITY_(\d+)$/];
  function parseEaVersions(loc) {
    const names = new Map();
    for (const pattern of VERSION_KEYS) {
      for (const [key, value] of Object.entries(loc || {})) {
        const m = pattern.exec(key);
        const name = typeof value === 'string' ? value.trim() : '';
        if (m && name && !names.has(Number(m[1]))) names.set(Number(m[1]), name);
      }
    }
    return Array.from(names).sort((a, b) => a[0] - b[0]);
  }

  // EA's club and league names from the same text file, as [id, name] rows. Clubs only have short
  // names there ("Spurs", "Man Utd", "M'gladbach"); retro teams and alternate kits are left out.
  const SPECIAL_TEAM = /retro|\b4th\b|\d\d\/\d\d|['’]\d\d/i;
  function parseEaNames(loc, pattern, skip) {
    const seen = new Set();
    const rows = [];
    for (const [key, value] of Object.entries(loc || {})) {
      const m = pattern.exec(key);
      const name = typeof value === 'string' ? value.trim() : '';
      if (!m || !name || (skip && skip.test(name)) || seen.has(`${m[1]}|${name}`)) continue;
      seen.add(`${m[1]}|${name}`);
      rows.push([Number(m[1]), name]);
    }
    return rows.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  }
  const parseEaClubs = (loc) => parseEaNames(loc, /^global\.teamabbr(?:15|10)\.\d+\.team(\d+)$/, SPECIAL_TEAM);
  const parseEaLeagues = (loc) => parseEaNames(loc, /^global\.league(?:Full|abbr15)\.\d+\.league(\d+)$/);

  // EA's team list (teamconfig.json) as [club id, league id] rows: FC 27's clubs, national teams and
  // legends teams.
  function parseEaTeams(json) {
    const year = json && Array.isArray(json.Years) ? json.Years[json.Years.length - 1] : null;
    if (!year) return [];
    const rows = ['Teams', 'ClubItemTeams', 'InternationalTeams', 'LegendsTeams']
      .flatMap((k) => (Array.isArray(year[k]) ? year[k] : []))
      .filter((t) => Number.isInteger(t.TeamId) && Number.isInteger(t.LeagueId))
      .map((t) => [t.TeamId, t.LeagueId]);
    return Array.from(new Map(rows)).sort((a, b) => a[0] - b[0]);
  }

  // Tells EA's files apart once parsed: the player list, the team list or the text file with version names.
  function eaFileKind(json) {
    if (json && (Array.isArray(json.Players) || Array.isArray(json.LegendsPlayers))) return 'players';
    if (parseEaTeams(json).length) return 'teams';
    if (json && typeof json === 'object' && parseEaVersions(json).length) return 'versions';
    return null;
  }

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  // Lower case without accents, so "ibanez" finds "Ibáñez".
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Players whose name has a word starting with each typed word, or whose id is the typed number.
  function searchPlayers(rows, query, limit) {
    const words = fold(query).split(/[\s.]+/).filter(Boolean);
    if (!words.length) return [];
    const max = limit || 8;
    if (words.length === 1 && /^\d+$/.test(words[0])) {
      const id = Number(words[0]);
      return rows.filter((r) => r[0] === id).slice(0, max);
    }
    const hits = [];
    for (const row of rows) {
      const nameWords = fold(row[1]).split(/[\s.'-]+/);
      if (words.every((w) => nameWords.some((n) => n.startsWith(w)))) {
        hits.push(row);
        if (hits.length >= max) break;
      }
    }
    return hits;
  }

  // ---- Import ----
  // An import file lists sets the way they read in the game, by player name:
  // { sets: [{ name, category, tokens, grades: { D, C, ... }, rewards: { D, C, ... },
  //   slots: [{ name, rating, version } | { rule, version, minRating, leagueId, nationId } | null] }] }
  // A set where every slot takes the same card type (most game sets) gives slotCount and cardType
  // (the type named in "Requires ... players to complete", or null when the screen doesn't say)
  // instead of slots.
  // Names are matched to EA's player list; anything uncertain comes back as a problem to check.

  function findVersion(name, versions) {
    if (!name) return null;
    return versions.find(([, n]) => fold(n) === fold(name)) || null;
  }

  // Every version a set's card type covers: the exact name, or else every version with those
  // words in its name ("POTM" → POTM Bundesliga, POTM Premier League...; "Heroes" → Base Hero...).
  function findVersions(type, versions) {
    const exact = findVersion(type, versions);
    if (exact) return [exact];
    const words = fold(type).split(/\s+/).filter(Boolean).map((w) => (w.length > 4 && w.endsWith('es') && !w.endsWith('ies') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
    return versions.filter(([, n]) => {
      const name = fold(n).split(/[^a-z0-9]+/);
      return words.every((w) => name.some((part) => part === w || part.startsWith(w)));
    });
  }

  // ---- Club and league names ----
  // EA only has short club names, so a set's full name ("Tottenham Hotspur") is matched word by
  // word: each word of a short name must be a word of the full name, its start ("Man" →
  // Manchester), its letters in order ("Utd" → United), its end ("Spurs" → Hotspur) or the
  // initials of a run of words ("PSG" → Paris Saint-Germain). Words like FC or Club don't count.
  const FILLER = new Set(['fc', 'afc', 'cf', 'sc', 'ac', 'cd', 'ud', 'sd', 'rc', 'ss', 'as', 'sv', 'vfl', 'vfb', 'tsg', 'club', 'de', 'del', 'la', 'le', 'calcio', 'men', 'mens', 'women', 'womens', 'w']);
  const nameWords = (s) => fold(s).replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
  const inOrder = (short, long) => { let i = 0; for (const c of long) if (c === short[i]) i += 1; return i === short.length; };
  function initialsFit(w, words) {
    if (w.length < 2 || w.length > 4) return false;
    for (let i = 0; i + w.length <= words.length; i += 1) if (words.slice(i, i + w.length).map((x) => x[0]).join('') === w) return true;
    return false;
  }
  // loose = false: whole words and initials only; loose = true: also starts, letters in order, ends,
  // and a single letter for a word starting with it ("D. Alavés").
  function wordFits(w, words, loose) {
    if (words.includes(w) || initialsFit(w, words)) return true;
    return loose && words.some((s) => (w.length === 1 && s[0] === w)
      || (w.length >= 3 && s.startsWith(w))
      || (w.length >= 4 && s.endsWith(w.replace(/s$/, '')))
      || (w.length >= 3 && w[0] === s[0] && inOrder(w, s)));
  }
  function namesFit(short, full, loose) {
    const words = nameWords(short);
    const target = nameWords(full);
    return words.length > 0 && words.every((w) => wordFits(w, target, loose));
  }
  // Every id whose name fits, best fit first: the exact name, else whole words, else loose words.
  // Clubs fit either way round (EA's short name inside the set's name or the other way);
  // leagues only one way ("Frauen-Bundesliga" inside "Google Pixel Frauen-Bundesliga").
  function findNamed(name, rows, oneWay) {
    const ids = (keep) => Array.from(new Set(rows.filter(([, n]) => keep(n)).map((r) => r[0])));
    const fits = (loose) => (n) => namesFit(name, n, loose) || (!oneWay && namesFit(n, name, loose));
    for (const keep of [(n) => fold(n) === fold(name), fits(false), fits(true)]) {
      const found = ids(keep);
      if (found.length) return found;
    }
    return [];
  }

  // Club ids whose EA name fits a set's club name, each with how many words of that name it covers
  // (Infinity for the exact name): "Man Utd" covers both words of "Manchester United", "FC United"
  // only one. EA gives a club's men's and women's teams separate ids, often with the same name.
  // When EA has the exact name, only whole-word fits join it ("Arsenal W.", not "AREA 21").
  function clubCandidates(name, clubs) {
    const target = nameWords(name);
    const found = new Map();
    const strict = new Set();
    for (const [id, short] of clubs) {
      let cover = Infinity;
      const words = nameWords(short);
      if (fold(short) === fold(name) || (words.length && words.every((w) => wordFits(w, target, false)))) strict.add(id);
      if (fold(short) !== fold(name)) {
        if (!words.length || !words.every((w) => wordFits(w, target, true))) continue;
        const covered = new Set();
        for (const w of words) {
          target.forEach((t, i) => { if (wordFits(w, [t], true)) covered.add(i); });
          for (let i = 0; i + w.length <= target.length; i += 1) {
            if (w.length >= 2 && target.slice(i, i + w.length).map((x) => x[0]).join('') === w) for (let j = i; j < i + w.length; j += 1) covered.add(j);
          }
        }
        cover = covered.size;
      }
      found.set(id, Math.max(found.get(id) || 0, cover));
    }
    if (Array.from(found.values()).includes(Infinity)) for (const id of Array.from(found.keys())) if (!strict.has(id)) found.delete(id);
    return found;
  }

  // "30 Premier League", "20 Arsenal Mens or Womens", "15 Granada CF Women's": a count, a club or
  // league, and for clubs whether the men's team, the women's team or both count.
  function readRequirement(cardType) {
    const m = /^(\d+)\s+(.+)$/.exec(String(cardType).trim());
    if (!m) return null;
    const who = /\s+(mens or womens|men'?s or women'?s|men'?s|men|women'?s|women)$/i.exec(m[2]);
    const team = who ? (/or/i.test(who[1]) ? 'both' : /^w/i.test(who[1]) ? 'women' : 'men') : null;
    return { count: Number(m[1]), name: who ? m[2].slice(0, who.index).trim() : m[2].trim(), team };
  }

  // A category such as "Premier League / Barclays WSL" names the men's league, then the women's.
  function categoryLeagues(category, places) {
    const parts = String(category || '').split(/\s+\/\s+/).filter(Boolean);
    return parts.map((part) => findNamed(part, places.leagues, true));
  }

  // A game set where every slot takes the same kind of card: { slotCount, cardType }.
  const HOLOGRAPHIC = /^holo(graphic)?s?$/i;

  function typeSlots(raw, versions, places, clubs) {
    const count = whole(raw.slotCount, 1, MAX_SLOTS) || 1;
    const empty = (problem) => ({ slots: new Array(count).fill(null), problems: [problem] });
    if (!raw.cardType) return empty('No card type: add the requirement by hand.');
    const fill = (slot, problems) => ({ slots: new Array(count).fill(cleanSlot(slot)), problems });

    const req = readRequirement(raw.cardType);
    if (req) {
      const leagueIds = findNamed(req.name, places.leagues, true);
      if (leagueIds.length && !req.team) {
        return fill({ kind: 'rule', label: `Any ${req.name} player`, leagueIds }, []);
      }
      const [men = [], women = []] = categoryLeagues(raw.category || raw.group, places);
      const leagues = req.team === 'women' ? (women.length ? women : men) : req.team === 'both' ? men.concat(women) : men;
      const named = Array.from((clubs || clubCandidates(req.name, places.clubs)).keys());
      // With EA's team list, only FC 27 clubs that play in the set's leagues: "Atlético de Madrid"
      // also reads as Atlético Mineiro and an old "Madrid", which never fit.
      const clubIds = places.clubLeagues.size ? named.filter((id) => leagues.includes(places.clubLeagues.get(id))) : named;
      const label = `Any ${req.name} player${req.team === 'both' ? ' (men or women)' : req.team === 'women' ? ' (women)' : ''}`;
      if (!named.length) return empty(`No club called "${req.name}" in EA's list: add these slots by hand.`);
      if (!leagues.length) return empty(`The category "${raw.category || raw.group}" doesn't name a league EA knows: add these slots by hand.`);
      if (!clubIds.length) return empty(`No FC 27 club called "${req.name}" plays in ${raw.category || raw.group}: add these slots by hand.`);
      // Name the best fits; looser ones from other leagues never count, so they aren't listed.
      const best = clubs ? Math.max(...clubIds.map((id) => clubs.get(id))) : 0;
      const top = clubs ? clubIds.filter((id) => clubs.get(id) === best) : clubIds;
      const names = Array.from(new Set(places.clubs.filter(([id]) => top.includes(id)).map((r) => r[1])));
      const loose = !names.some((n) => fold(n) === fold(req.name));
      const shown = names.slice(0, 4).join(' / ') + (names.length > 4 ? ` and ${names.length - 4} more` : '');
      return fill({ kind: 'rule', label, clubIds, leagueIds: leagues }, loose ? [`"${req.name}" read as EA's ${shown}.`] : []);
    }

    // A card type: "Team of the Week", or several: "Ones to Watch, Destined for Glory or Future Stars".
    const types = String(raw.cardType).split(/\s*,\s*|\s+or\s+/).filter(Boolean);
    if (types.every((t) => HOLOGRAPHIC.test(t))) return fill({ kind: 'rule', label: `Any ${raw.cardType} card`, foil: true }, []);
    const found = [];
    const unknown = [];
    for (const type of types) {
      if (HOLOGRAPHIC.test(type)) { unknown.push(type); continue; } // only on its own: "Heroes or Holographic" can't be one rule
      const hits = /^(bronze|silver|gold)$/i.test(type) ? versions.filter(([n]) => n === 0 || n === 1) : findVersions(type, versions);
      if (hits.length) found.push(...hits); else unknown.push(type);
    }
    const slot = { kind: 'rule', label: `Any ${raw.cardType} card`, version: raw.cardType, rarityIds: found.map((v) => v[0]) };
    const problems = [];
    if (found.length) problems.push(`"${raw.cardType}" counts: ${Array.from(new Set(found.map((v) => v[1]))).join(', ')}.`);
    if (unknown.length) problems.push(`${unknown.map((t) => `"${t}"`).join(', ')} ${unknown.length === 1 ? "isn't" : "aren't"} in EA's version list${found.length ? '' : ', so FutFox will show these slots as "check in the game"'}.`);
    return fill(slot, problems);
  }

  function importSlot(row, players, versions) {
    if (!row) return { slot: null, problem: null };
    const version = findVersion(row.version, versions);
    const versionProblem = row.version && !version ? `version "${row.version}" isn't in EA's list` : null;
    const rarity = { rarityId: version ? version[0] : null, version: version ? version[1] : '' };
    if (row.rule) {
      return { slot: cleanSlot({ kind: 'rule', label: row.rule, ...rarity, leagueId: row.leagueId, nationId: row.nationId, minRating: row.minRating }), problem: versionProblem };
    }
    const rating = whole(row.rating, 1, 99);
    // A special card is rated at least as high as the player's base card.
    const hits = searchPlayers(players, row.name || '', 200).filter((p) => rating == null || p[2] <= rating);
    // Best first: the whole name, then every typed word as a whole word ("Saka", "B. Saka"),
    // then only the start of a word ("Pedri" → Pedrinho), which always needs a look.
    const exact = hits.filter((p) => fold(p[1]) === fold(row.name));
    const byWord = hits.filter((p) => wordsMatch(p[1], row.name));
    const pool = exact.length ? exact : byWord.length ? byWord : hits;
    if (!pool.length) {
      const missing = `no player called "${row.name}"${rating ? ` with a base rating of ${rating} or lower` : ''}`;
      return { slot: null, problem: [missing, versionProblem].filter(Boolean).join('; ') };
    }
    const [pick, next] = pool;
    const slot = cleanSlot({ kind: 'card', playerId: pick[0], name: pick[1], rating, ...rarity });
    const partial = pool === hits ? `"${row.name}" only partly matches ${pick[1]} (${pick[2]}, id ${pick[0]})` : null;
    const close = next && next[2] >= pick[2] - 3 ? `"${row.name}" could also be ${next[1]} (${next[2]}, id ${next[0]})` : null;
    return { slot, problem: [versionProblem, partial || close].filter(Boolean).join('; ') || null };
  }

  // Every typed word is a whole word of the name; single letters (initials) only start one.
  function wordsMatch(name, query) {
    const words = fold(name).split(/[\s.'-]+/);
    return fold(query).split(/[\s.]+/).filter(Boolean).every((q) => (q.length === 1 ? words.some((w) => w.startsWith(q)) : words.includes(q)));
  }

  // Each set as a draft ready to save, with the problems found while matching it.
  function importSets(json, players, versions, places) {
    const where = { clubs: (places && places.clubs) || [], leagues: (places && places.leagues) || [], clubLeagues: new Map((places && places.clubLeagues) || []) };
    const list = json && Array.isArray(json.sets) ? json.sets : [];
    // "category" is the game's word for a set's group (its Gallery tab).
    const raws = list.map((given) => ({ ...given, group: given.category != null ? given.category : given.group }));
    // Club ids each club set could mean. When two sets of one category claim the same id, the set
    // whose name it fits best keeps it ("Deportivo" goes to RC Deportivo, not Deportivo Alavés).
    const clubsFor = raws.map((raw) => {
      const req = raw.cardType && !Array.isArray(raw.slots) ? readRequirement(raw.cardType) : null;
      if (!req || (!req.team && findNamed(req.name, where.leagues, true).length)) return null;
      return clubCandidates(req.name, where.clubs);
    });
    raws.forEach((raw, i) => {
      if (!clubsFor[i]) return;
      for (const [id, cover] of Array.from(clubsFor[i])) {
        const rivals = raws.map((r, j) => (j !== i && clubsFor[j] && r.group === raw.group ? clubsFor[j].get(id) || 0 : 0));
        if (rivals.some((c) => c > cover)) clubsFor[i].delete(id);
      }
    });
    return raws.map((raw, index) => {
      // A file's bonusTags are one player's progress (the game shows the tags their cards reach), not
      // part of the set: every set has the same 21, which FutFox scores itself (src/core/bonus-tags.js).
      const bonusTags = [];
      if (!Array.isArray(raw.slots)) {
        const { slots, problems } = typeSlots(raw, versions, where, clubsFor[index]);
        const { set, errors } = normalizeSet({ ...raw, bonusTags, status: 'draft', slotCount: slots.length, slots });
        return { set, problems: errors.concat(problems) };
      }
      const rows = raw.slots;
      const problems = [];
      const slots = rows.map((row, i) => {
        const { slot, problem } = importSlot(row, players, versions);
        if (problem) problems.push(`Slot ${i + 1}: ${problem}`);
        return slot;
      });
      const { set, errors } = normalizeSet({ ...raw, bonusTags, status: 'draft', slotCount: Math.max(rows.length, whole(raw.slotCount, 1, MAX_SLOTS) || 1), slots });
      return { set, problems: errors.concat(problems) };
    });
  }

  const api = {
    GRADES, MAX_SLOTS, SCHEMA, EA_CONTENT_ID, EA_PLAYERS_URL, EA_VERSIONS_URL, EA_TEAMS_URL, PLAYER_CHUNK,
    emptySet, cleanSlot, normalizeSet, filledCount, publicBundle, publishChanges, parseEaPlayers, parseEaVersions, parseEaClubs, parseEaLeagues, parseEaTeams, eaFileKind, chunk, searchPlayers, importSets,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FutFox = root.FutFox || {}).sets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
