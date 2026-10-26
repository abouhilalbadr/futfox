// Everything that touches the EA FC Web App lives here. It reads the app's in-memory
// objects (services, repositories) and makes exactly one kind of request: the paged
// club list, and only when the user presses "Load my club". It also reads, without
// changing them, the club list replies the Web App receives, for their Gallery marks.
// It never bids, buys, lists, saves or submits anything.
(function (root) {
  'use strict';

  const H = root.FutFox;
  const { qualityOf, parseRequirement } = H.requirements;
  const { estimatePrice } = H.solver;

  const CLUB_PAGE_SIZE = 91;
  const CLUB_MAX_PAGES = 40;

  function isReady() {
    return !!(root.services && root.services.SBC && root.repositories && root.repositories.Item && root.UTSquadChemCalculatorUtils);
  }

  function listOf(collection) {
    if (!collection) return [];
    if (typeof collection.values === 'function') return Array.from(collection.values());
    return Object.values(collection);
  }

  function attempt(fn, fallback) {
    try {
      const value = fn();
      return value === undefined ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  // ---- SBCs -------------------------------------------------------------------------

  // Challenges whose requirements the app has loaded (it loads them when a set is opened).
  function getChallenges() {
    const data = attempt(() => root.services.SBC.currentSetsData(), null);
    if (!data) return [];
    const out = [];
    for (const set of listOf(data.sets)) {
      for (const c of listOf(set.challenges)) {
        if (!c || !c.eligibilityRequirements || !c.eligibilityRequirements.length) continue;
        out.push({ id: c.id, setId: set.id, setName: set.name, name: c.name, status: c.status, challenge: c });
      }
    }
    return out;
  }

  function rulesFor(challenge) {
    return challenge.eligibilityRequirements.map((dto) => {
      const label = attempt(() => dto.buildString(), null);
      return parseRequirement(dto, typeof label === 'string' && label.trim() ? label.trim() : null);
    });
  }

  function slotsFor(challenge) {
    const formation = attempt(() => root.repositories.Squad.getFormation(challenge.formation), null);
    if (!formation) return null;
    return formation.positions.map((p) => ({ typeId: p.typeId, name: p.name }));
  }

  // Slots the user has to fill. Some SBCs pre-fill "brick" slots or need fewer players.
  function requiredSlotsFor(challenge) {
    const bricks = attempt(() => challenge.squad.getAllBrickIndices(), []) || [];
    return Array.from({ length: 11 }, (_, i) => i).filter((i) => !bricks.includes(i));
  }

  // ---- Club -------------------------------------------------------------------------

  let chemCalc = null;
  function calculator() {
    if (!chemCalc) chemCalc = new root.UTSquadChemCalculatorUtils(root.services.Chemistry, root.repositories.TeamConfig);
    return chemCalc;
  }

  const PARAM = H.chemistry.PARAM;
  const UNIVERSAL = 2; // ChemistryProfileRuleCalculationType.UNIVERSAL_WITH_PLAYER_COUNT

  function chemProfileOf(item) {
    const calc = calculator();
    const profile = attempt(() => calc.getChemProfileForPlayer(item), null);
    const contrib = (param) => attempt(() => calc.getContribution(param, item, profile), 1) || 0;
    const leagueRule = profile && attempt(() => profile.getRuleByParamId(PARAM.LEAGUE), null);
    return {
      maxChem: !!attempt(() => calc.isMaxChem(item, profile), false),
      contrib: { nation: contrib(PARAM.NATION), league: contrib(PARAM.LEAGUE), club: contrib(PARAM.CLUB) },
      universalLeague: !!leagueRule && leagueRule.calculationType === UNIVERSAL,
    };
  }

  // The app doesn't keep the active squad in memory, but the only players it holds right
  // after login are the active squad's (from the login data). main.js takes this snapshot
  // before the user browses the club or presses "Load my club".
  let activeSquad = new Set();
  function rememberActiveSquad() {
    activeSquad = new Set(knownClubItems().map((item) => item.id));
    return activeSquad.size;
  }

  // FC 27 items expose isTradeable() (older games had an `untradeable` field).
  function isUntradeable(item) {
    return attempt(() => (typeof item.isTradeable === 'function' ? !item.isTradeable() : !!item.untradeable), false);
  }

  // A loan for some games (loans counts the games left, -1 otherwise) or for some days (time-limited).
  function isLoan(item) {
    return attempt(() => (item.loans != null && item.loans !== -1) || item.isLimitedUse() || item.isTimeLimited(), false);
  }

  // Loans, timed cards and cards in a running evolution can't go into an SBC.
  function isUsable(item) {
    return !attempt(() => item.isLimitedUse() || item.isTimeLimited() || item.isActiveInTimedEvolution() || item.loans >= 0, false);
  }

  function toPlayer(item, prices) {
    const marketAverage = attempt(() => item.getMarketAverage(), -1);
    const estimate = estimatePrice(item.rating, prices);
    const untradeable = isUntradeable(item);
    // Using an untradeable card costs you little: it could never be sold.
    const cost = untradeable ? Math.round(estimate * 0.15) : marketAverage > 0 ? marketAverage : estimate;
    const quality = attempt(() => (item.isGoldRating() ? 3 : item.isSilverRating() ? 2 : 1), qualityOf(item.rating));
    return {
      key: `club:${item.id}`,
      id: item.id,
      defId: item.definitionId,
      name: attempt(() => item._staticData.name, null) || `#${item.definitionId}`,
      rating: item.rating,
      quality,
      nationId: item.nationId,
      leagueId: item.leagueId,
      clubId: attempt(() => root.repositories.TeamConfig.getLinkedTeam(item.teamId), item.teamId) || item.teamId,
      rarity: item.rareflag,
      isIcon: attempt(() => item.isLegend(), false),
      positions: (item.possiblePositions || [item.preferredPosition]).slice(),
      profile: chemProfileOf(item),
      untradeable,
      marketAverage,
      cost,
      source: 'club',
      item,
    };
  }

  const loadedItems = new Map();

  // Players the app already holds in memory (the active squad, pages you browsed).
  function knownClubItems() {
    const club = attempt(() => root.repositories.Item.getClub(), null);
    for (const item of listOf(club && club.items)) {
      if (attempt(() => item.isPlayer(), false)) loadedItems.set(item.id, item);
    }
    return Array.from(loadedItems.values());
  }

  function observe(observable) {
    return new Promise((resolve, reject) => {
      const owner = {};
      observable.observe(owner, (obs, result) => {
        obs.unobserve(owner);
        if (result && result.success) resolve(result);
        else reject(new Error(`EA answered ${result ? result.status : 'nothing'} while loading the club.`));
      });
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The same paged request the Club screen makes, spaced out like a person paging.
  async function loadClub(onProgress) {
    for (let page = 0; page < CLUB_MAX_PAGES; page++) {
      const criteria = new root.UTSearchCriteriaDTO();
      criteria.type = root.SearchType.PLAYER;
      criteria.count = CLUB_PAGE_SIZE;
      criteria.offset = page * CLUB_PAGE_SIZE;
      const result = await observe(root.services.Club.search(criteria));
      const items = (result.response && result.response.items) || [];
      for (const item of items) loadedItems.set(item.id, item);
      onProgress(loadedItems.size);
      if (items.length < CLUB_PAGE_SIZE) break;
      await sleep(1500 + Math.random() * 1500);
    }
    return loadedItems.size;
  }

  function clubPool({ prices, keepActiveSquad, protectFrom, untradeablesOnly }) {
    const active = keepActiveSquad ? activeSquad : new Set();
    return knownClubItems()
      .filter((item) => !active.has(item.id))
      .filter((item) => !protectFrom || item.rating < protectFrom)
      .filter((item) => !untradeablesOnly || isUntradeable(item))
      .filter(isUsable)
      .map((item) => toPlayer(item, prices));
  }

  // ---- Gallery ----------------------------------------------------------------------

  // The Gallery tab matches the published Gallery sets (gallery-source.js) against these cards.
  const GALLERY_ENABLED = true;

  // Club list replies carry an isCollected mark that the Web App drops while parsing them.
  // Watching the replies (the user's own Club pages and "Load my club") keeps it.
  const CLUB_REPLY = /\/ut\/game\/[^/]+\/club(\?|$)/;
  const gallerySeen = new Set();
  const galleryCollected = new Set();

  function onClubReply() {
    if (this.status !== 200) return;
    const reply = attempt(() => (this.responseType === 'json' ? this.response : JSON.parse(this.responseText)), null);
    const { seen, collected } = H.gallery.readClubReply(reply);
    for (const id of seen) gallerySeen.add(id);
    for (const id of collected) galleryCollected.add(id);
  }

  function watchClubReplies() {
    const XHR = root.XMLHttpRequest;
    if (!XHR || XHR.prototype.futfoxWatched) return;
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      this.futfoxUrl = String(url);
      return open.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      if (CLUB_REPLY.test(this.futfoxUrl || '')) this.addEventListener('load', onClubReply);
      return send.apply(this, arguments);
    };
    XHR.prototype.futfoxWatched = true;
  }
  if (GALLERY_ENABLED) watchClubReplies();

  // What the Gallery bonus tags look at. Icons and Heroes are told apart by EA's version name
  // ("Base Icon", "Prime Hero"); EA's own hero check also covers Hall of FUT cards.
  function bonusFields(item) {
    const version = attempt(() => root.services.Localization.localize(`item.raretype${item.rareflag}`), '') || '';
    const level = attempt(() => (item.isGoldRating() ? 'gold' : item.isSilverRating() ? 'silver' : item.isBronzeRating() ? 'bronze' : null), null);
    return {
      level: level || H.bonusTags.levelFor(item.rating),
      icon: /\bicons?\b/i.test(version),
      hero: /\bhero(es)?\b/i.test(version) || attempt(() => item.isLeagueHeroItem(), false),
      totw: item.rareflag === 3 || /team of the week/i.test(version),
      // The stored stars: getSkillMoves() gives goalkeepers a different number.
      weakFoot: item._weakFoot,
      skillMoves: item._skillMoves,
      positions: attempt(() => item.getBasePossiblePositions(), null) || item.basePossiblePositions || [],
    };
  }

  function galleryCards() {
    const cards = knownClubItems().map((item) => ({
      id: item.id,
      // EA's player id, the same id as in its players.json and in the Gallery sets.
      playerId: attempt(() => item.databaseId, null),
      // EA's version number (3 = Team of the Week), matched against the sets' rarityId.
      rarityId: item.rareflag,
      name: attempt(() => item._staticData.name, null) || `#${item.definitionId}`,
      rating: item.rating,
      score: item.sbsScore || 0,
      owners: item.owners,
      leagueId: item.leagueId,
      nationId: item.nationId,
      // EA's club id (teamId), matched against club sets' clubIds.
      clubId: item.teamId,
      // Holographic cards carry a foil cosmetic (-1 means none); the Holographics set needs it.
      foil: attempt(() => item.getFoilSubtype() !== -1, false),
      // Loan cards never count in the Gallery: loans counts a game loan's games left (-1 when it
      // isn't one); a loan for some days has loans -1 but is time-limited.
      loan: isLoan(item),
      ...bonusFields(item),
    }));
    return H.gallery.galleryRows(H.gallery.withRemembered(cards.filter((c) => !c.loan), rememberSeen(cards)), { seen: gallerySeen, collected: galleryCollected });
  }

  // Cards keep counting toward Gallery sets after they leave the club, so every card FutFox sees
  // is kept in this browser, one list per EA account. Saved only when something changed.
  let memoryCache = { key: null, memory: null };

  // The remembered cards of the signed-in EA account, and that account's id.
  function galleryMemory() {
    const persona = attempt(() => root.services.User.getUser().selectedPersona, null) || 'default';
    const key = `futfox.galleryMemory.${persona}`;
    if (memoryCache.key !== key) memoryCache = { key, memory: attempt(() => JSON.parse(localStorage.getItem(key) || 'null'), null) || { cards: {} } };
    return { persona, memory: memoryCache.memory };
  }

  function replaceGalleryMemory(memory) {
    const { persona } = galleryMemory();
    attempt(() => localStorage.setItem(`futfox.galleryMemory.${persona}`, JSON.stringify(memory)), null);
    memoryCache.memory = memory;
  }

  function rememberSeen(cards) {
    const before = galleryMemory().memory;
    const changed = cards.some((c) => (c.loan ? Boolean(before.cards[c.id]) : !before.cards[c.id] || before.cards[c.id].score !== c.score));
    if (!changed) return before;
    const after = H.gallery.rememberCards(before, cards, Date.now());
    replaceGalleryMemory(after);
    return after;
  }

  // ---- Game settings ----------------------------------------------------------------

  function ratingUsesFloat() {
    return attempt(
      () => root.services.Configuration.checkFeatureEnabled(root.UTServerSettingsRepository.KEY.SQUAD_RATING_FLOAT_CALCULATION_ENABLED),
      true,
    );
  }

  function chemThresholds() {
    const params = attempt(() => root.repositories.Chemistry.getParameters(), null);
    if (!params || !params.length) return H.chemistry.DEFAULT_THRESHOLDS;
    const out = { ...H.chemistry.DEFAULT_THRESHOLDS };
    for (const p of params) out[p.id] = p.thresholds.map((t) => t.requirement);
    return out;
  }

  // EA's own chemistry for a squad made only of real club cards; null otherwise.
  function eaChemistry(formationName, players) {
    if (players.length !== 11 || players.some((p) => !p || !p.item)) return null;
    const formation = attempt(() => root.repositories.Squad.getFormation(formationName), null);
    if (!formation) return null;
    const result = attempt(() => calculator().calculate(formation, players.map((p) => p.item), []), null);
    if (!result) return null;
    return { total: result.chemistry, perPlayer: result.slots.map((s) => s.points) };
  }

  // ---- Images -----------------------------------------------------------------------
  // The Web App's own league logos, club badges, version cards and token art, from EA's servers.
  // FutFox's panel is dark, so it uses the white "dark" logos the Web App shows on its own dark screens.

  const darkImage = (uri) => (typeof uri === 'string' && uri ? uri.replace('/light/', '/dark/') : null);
  const leagueLogo = (id) => (id > 0 ? darkImage(attempt(() => root.AssetLocationUtils.getLeagueImageUri(id), null)) : null);
  const clubBadge = (id) => (id > 0 ? darkImage(attempt(() => root.AssetLocationUtils.getBadgeImageUri(id), null)) : null);
  // The blank card of a version (3 = Team of the Week), as the Transfer Market's version filter shows it.
  const rarityImage = (id) => (id >= 0 ? attempt(() => root.AssetLocationUtils.getFilterImage(root.AssetLocationUtils.FILTER.RARITY, id), null) : null);
  // The Web App has no Gallery Token picture; this is the generic token its rewards use.
  const tokenImage = () => attempt(() => new URL('images/rewards/meta/flat/generic_token.png', root.location.href).href, null);
  // The coin the Web App shows beside your coin balance in its top bar.
  const coinImage = () => attempt(() => new URL('images/coinIcon.png', root.location.href).href, null);

  // ---- Names ------------------------------------------------------------------------

  function leagueName(id) {
    if (!id || id < 0) return 'Any league';
    const l = attempt(() => root.repositories.TeamConfig.getLeague(id), null);
    return l ? l.abbreviation || l.name : `League ${id}`;
  }

  function nationName(id) {
    if (!id || id < 0) return 'Any nation';
    const n = attempt(() => root.repositories.TeamConfig.getNation(id), null);
    return n ? n.name : `Nation ${id}`;
  }

  function positionName(typeId) {
    return (root.PlayerPosition && root.PlayerPosition[typeId]) || String(typeId);
  }

  // ---- Market search (pre-fill only) ------------------------------------------------

  // Opens the Transfer Market search screen with the filters filled in. The user still
  // presses Search, and Buy, themselves.
  function openMarketSearch(search) {
    const criteria = new root.UTSearchCriteriaDTO();
    criteria.type = root.SearchType.PLAYER;
    const quality = qualityOf(search.rating);
    criteria.level = quality === 3 ? root.SearchLevel.GOLD : quality === 2 ? root.SearchLevel.SILVER : root.SearchLevel.BRONZE;
    // The market screen hides its rating range, so a rating set here would filter results
    // invisibly. The panel tells the user which rating to look for instead.
    if (search.leagueId > 0) criteria.league = search.leagueId;
    if (search.nationId > 0) criteria.nation = search.nationId;
    if (search.typeId != null) criteria.position = positionName(search.typeId);

    const nav = root.getAppMain().getRootViewController().getPresentedViewController().getCurrentViewController();
    const controller = new root.UTMarketSearchFiltersViewController();
    controller.initWithSearchCriteria(criteria);
    nav.pushViewController(controller);
  }

  H.fut = {
    isReady, getChallenges, rulesFor, slotsFor, requiredSlotsFor,
    knownClubItems, rememberActiveSquad, loadClub, clubPool, galleryEnabled: GALLERY_ENABLED, galleryCards, galleryMemory, replaceGalleryMemory, ratingUsesFloat, chemThresholds, eaChemistry,
    leagueName, nationName, positionName, openMarketSearch, leagueLogo, clubBadge, rarityImage, tokenImage, coinImage,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
