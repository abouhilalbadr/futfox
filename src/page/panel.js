// The FutFox side panel, drawn inside a shadow root so the Web App's styles and
// ours never mix.
(function (root) {
  'use strict';

  const H = root.FutFox;
  const STORE_KEY = 'futfox.settings';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .toggle { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; border: 0; border-radius: 999px;
      padding: 8px 16px 8px 10px; font: 700 14px/1 system-ui, sans-serif; letter-spacing: .04em; cursor: pointer;
      display: flex; align-items: center; gap: 8px; background: #0E0B1F; color: #fff; box-shadow: 0 0 0 1px #8B5CF6, 0 4px 14px rgba(0,0,0,.35); }
    .fox { width: 24px; height: 24px; flex: none; }
    header .fox { width: 30px; height: 30px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .toggle:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #C6FF3D; outline-offset: 2px; }
    /* Never narrower than the default, never wider than the screen; the grip on the left edge resizes it. */
    .panel { position: fixed; top: 0; right: 0; bottom: 0; width: var(--futfox-width, 520px); min-width: min(520px, 100vw); max-width: 100vw;
      z-index: 2147483001; display: flex; flex-direction: column;
      background: #120F24; color: #e7ebf2; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: -8px 0 24px rgba(0,0,0,.45); }
    .grip { position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; cursor: ew-resize; touch-action: none; z-index: 1; }
    .grip:hover, .grip:focus-visible, .grip.dragging { background: linear-gradient(90deg, transparent 3px, #8B5CF6 3px, #8B5CF6 5px, transparent 5px); outline: none; }
    .panel[hidden] { display: none; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2A2445; }
    h1 { margin: 0; font-size: 18px; font-weight: 700; }
    h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #9A93B8; }
    .body { flex: 1; overflow-y: auto; padding: 16px; display: grid; gap: 18px; align-content: start; }
    section { display: grid; gap: 8px; }
    select, input[type=number] { width: 100%; background: #1B1733; color: inherit; border: 1px solid #352E55; border-radius: 6px; padding: 7px 8px; font: inherit; }
    input[type=number] { width: 72px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #352E55; background: #1B1733; color: inherit; padding: 7px 12px; }
    button.primary { background: #8B5CF6; color: #fff; border-color: #8B5CF6; font-weight: 700; }
    button:disabled { opacity: .5; cursor: default; }
    .close { border: 0; background: none; font-size: 24px; line-height: 1; padding: 4px 8px; color: #9A93B8; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    label.check { display: flex; align-items: center; gap: 8px; }
    input[type=checkbox] { accent-color: #8B5CF6; }
    .muted { color: #9A93B8; }
    ul.rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    ul.rules li { display: grid; grid-template-columns: 22px 1fr; gap: 6px; }
    .ok { color: #6fd29a; } .bad { color: #f08a7a; } .unknown { color: #e8c45a; }
    .summary { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px 12px; border-radius: 8px; background: #1B1733; font-variant-numeric: tabular-nums; }
    .summary strong { font-size: 17px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    td { padding: 7px 5px; border-bottom: 1px solid #241F3C; vertical-align: middle; }
    td.pos { color: #9A93B8; width: 48px; font-size: 13px; }
    td.r { width: 34px; font-weight: 700; }
    td.chem { width: 40px; color: #C6FF3D; letter-spacing: -1px; }
    .name { display: block; font-weight: 600; }
    .meta { display: block; font-size: 13px; color: #9A93B8; }
    .tag { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 6px; border-radius: 999px; background: #2A2445; color: #C9C3E0; white-space: nowrap; }
    .tag.buy { background: #2A1F4D; color: #C4B1FF; }
    .tag.untr { background: #1d3327; color: #6fd29a; }
    button.small { padding: 4px 10px; font-size: 13px; }
    .note { font-size: 13px; color: #9A93B8; }
    .error { color: #f08a7a; }
    .tabs { display: flex; gap: 4px; padding: 10px 16px 0; border-bottom: 1px solid #2A2445; }
    .tabs button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; color: #9A93B8; padding: 8px 10px; font-weight: 600; }
    .tabs button[aria-selected="true"] { color: #fff; border-bottom-color: #8B5CF6; }
    /* Categories, then a category's sets, as cards: one column at the panel's usual width, one more each
       time it is dragged about 370px wider, never more than four (each column is at least a quarter of the
       row), and every card in a row the same height. */
    .sets { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(360px, calc((100% - 24px) / 4)), 1fr)); grid-auto-rows: 1fr; gap: 8px; }
    /* A category card: logos, tokens and set count; sets per grade; name. */
    .cat { display: grid; gap: 14px; align-content: space-between; min-width: 0; text-align: left; padding: 14px 16px; border: 1px solid #2A2445; border-radius: 10px; background: #1B1733; }
    .cat:hover, .cat:focus-visible { border-color: #8B5CF6; outline: none; }
    .cat-top { display: flex; align-items: center; gap: 8px; }
    .cat .logos { display: flex; align-items: center; gap: 10px; margin-right: auto; min-width: 0; }
    .cat .logos img { height: 36px; max-width: 48px; object-fit: contain; }
    .cat .logos .letter { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #2A2445; color: #C9C3E0; font-weight: 700; }
    .cat .tokens { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cat .tokens img { width: 16px; height: 16px; }
    .cat .tokens strong { color: #E8C45A; }
    .cat .chip { font-size: 12px; padding: 3px 8px; border: 1px solid #352E55; border-radius: 6px; background: #120F24; white-space: nowrap; }
    .cat .grades { display: grid; grid-template-columns: repeat(5, 1fr); justify-items: center; }
    .grade { display: grid; justify-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
    .grade .dia { position: relative; z-index: 0; width: 26px; height: 26px; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
    .grade .dia::before { content: ''; position: absolute; inset: 4px; transform: rotate(45deg); border: 1.5px solid currentColor; border-radius: 3px; background: #120F24; z-index: -1; }
    .grade .n { font-size: 12px; color: #C9C3E0; }
    .g-D .dia, .g-C .dia { color: #C9C3E0; } .g-B .dia, .g-A .dia { color: #E8C45A; } .g-S .dia { color: #A78BFA; }
    .grade.none { opacity: .35; }
    .cat-foot { display: flex; align-items: end; justify-content: space-between; gap: 8px; }
    .cat-name { display: block; font-weight: 700; font-size: 16px; }
    .cat-sub { display: block; font-size: 13px; color: #9A93B8; }
    .cat .go { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 50%; border: 1px solid #352E55; color: #9A93B8; font-size: 13px; }
    .cat:hover .go { border-color: #8B5CF6; color: #fff; }
    .set { display: grid; border: 1px solid #2A2445; border-radius: 8px; background: #1B1733; min-width: 0; }
    button.set-head:hover { background: #221D3D; border-radius: 8px; }
    .set-head { align-content: start; }
    .set.open .set-head .name { -webkit-line-clamp: unset; font-size: 16px; font-weight: 700; }
    .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 13px; }
    .crumbs button { padding: 4px 8px; font-size: 13px; }
    .crumbs .sep { color: #6E6790; }
    .crumbs .current { color: #fff; font-weight: 600; padding: 4px 2px; }
    .set-head { width: 100%; border: 0; background: none; text-align: left; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 10px 12px; }
    /* A league logo (with the women's league small in its corner), club badge, art from art/, or a letter. */
    .pic { grid-row: 1 / 4; position: relative; width: 40px; height: 40px; display: grid; place-items: center; }
    .pic img { width: 40px; height: 40px; object-fit: contain; }
    .pic img.second { position: absolute; right: -6px; bottom: -4px; width: 20px; height: 20px; padding: 2px; border-radius: 50%; background: #1B1733; }
    .pic .letter { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #2A2445; color: #C9C3E0; font-weight: 700; font-size: 16px; }
    .tabs button { display: inline-flex; align-items: center; gap: 6px; }
    .tabs img, .tabs svg { width: 16px; height: 16px; }
    td .token { width: 18px; height: 18px; vertical-align: -4px; margin-right: 6px; }
    .summary .coin { width: 18px; height: 18px; vertical-align: -3px; margin-right: 5px; }
    .set-head .name { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
    .set-head .count { font-weight: 700; font-variant-numeric: tabular-nums; }
    .set-head .meta, .set-head .bar { grid-column: 2 / -1; }
    .bar { height: 4px; border-radius: 2px; background: #2A2445; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: #C6FF3D; }
    .set-body { padding: 0 12px 10px; display: grid; gap: 6px; }
    h3 { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: #C9C3E0; }
    td.mark { width: 22px; font-weight: 700; }
    td.act { width: 1%; white-space: nowrap; text-align: right; }
    label.file { position: relative; display: inline-block; border-radius: 6px; border: 1px solid #352E55; background: #1B1733; padding: 7px 12px; cursor: pointer; }
    label.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
    label.file:focus-within { outline: 2px solid #8B5CF6; }
    footer { padding: 10px 16px; border-top: 1px solid #2A2445; font-size: 13px; color: #9A93B8; }
  `;

  function loadSettings() {
    const defaults = { keepActiveSquad: true, protectFrom: 87, allowMarket: true, untradeablesOnly: false, view: 'sbc' };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
    } catch (e) {
      return defaults;
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (e) {
      // Settings are a convenience; the panel works without them.
    }
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
  }

  const coins = (n) => Math.round(n).toLocaleString('en-US');

  // The FutFox mark (brand/logo/futfox-symbol.svg), built with DOM calls so it needs no innerHTML.
  const FOX_HEAD = 'M128 102L101.59 86.75L63.59 20.93L39 112.7L11.2 160.85L60.82 189.5L100.62 200.16L128 227.54L155.38 200.16'
    + 'L195.18 189.5L244.8 160.85L217 112.7L192.41 20.93L154.41 86.75ZM66.51 62.54L81.27 88.1L55.71 102.86Z'
    + 'M189.49 62.54L174.73 88.1L200.29 102.86Z';
  const FOX_EYES = 'M56 140L110.1 154.5L105.4 171.9L68.7 162.1ZM200 140L145.9 154.5L150.6 171.9L187.3 162.1Z';

  function foxIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 256 256');
    svg.setAttribute('class', 'fox');
    svg.setAttribute('aria-hidden', 'true');
    for (const [d, fill, rule] of [[FOX_EYES, '#C6FF3D'], [FOX_HEAD + FOX_EYES, '#8B5CF6', 'evenodd']]) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', fill);
      if (rule) path.setAttribute('fill-rule', rule);
      svg.append(path);
    }
    return svg;
  }

  // Drag the panel's left edge (or focus it and use the arrow keys) to widen it. The width stays
  // between the default and the screen width and is remembered with the other settings.
  const DEFAULT_WIDTH = 520;
  function resizeGrip(panel, settings) {
    const clamp = (w) => Math.round(Math.min(window.innerWidth, Math.max(Math.min(DEFAULT_WIDTH, window.innerWidth), w)));
    const apply = (w) => panel.style.setProperty('--futfox-width', `${clamp(w)}px`);
    const save = () => { settings.panelWidth = clamp(panel.getBoundingClientRect().width); saveSettings(settings); };
    apply(settings.panelWidth || DEFAULT_WIDTH);

    const grip = el('div', { class: 'grip', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize FutFox', tabindex: '0', title: 'Drag to resize' });
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      grip.classList.add('dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (grip.hasPointerCapture(e.pointerId)) apply(window.innerWidth - e.clientX);
    });
    const stop = (e) => {
      if (!grip.hasPointerCapture(e.pointerId)) return;
      grip.releasePointerCapture(e.pointerId);
      grip.classList.remove('dragging');
      save();
    };
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
    grip.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: 40, ArrowRight: -40 }[e.key];
      if (!step) return;
      e.preventDefault();
      apply(panel.getBoundingClientRect().width + step);
      save();
    });
    return grip;
  }

  function create() {
    const host = el('div', { id: 'futfox-root' });
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(el('style', { text: CSS }));
    document.body.append(host);

    const settings = loadSettings();
    const state = { challenges: [], selectedId: null, result: null, loading: false, error: null, solving: false, sets: { data: null, loading: false, error: null }, category: null, openSet: null, scrolls: {}, scrollTo: null };

    const toggle = el('button', { class: 'toggle', type: 'button' }, [foxIcon(), 'FutFox']);
    const panel = el('aside', { class: 'panel', hidden: true, 'aria-label': 'FutFox' });
    shadow.append(toggle, panel);
    const grip = resizeGrip(panel, settings);

    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) refreshChallenges();
    });

    function refreshChallenges() {
      state.challenges = H.fut.getChallenges();
      const stillThere = state.challenges.some((c) => c.id === state.selectedId);
      if (!stillThere) {
        const open = state.challenges.find((c) => c.status !== 'COMPLETED');
        state.selectedId = open ? open.id : state.challenges[0] && state.challenges[0].id;
        state.result = null;
      }
      render();
    }

    function selected() {
      return state.challenges.find((c) => c.id === state.selectedId) || null;
    }

    async function loadClub() {
      state.loading = true;
      state.error = null;
      render();
      try {
        await H.fut.loadClub((n) => {
          state.loadedCount = n;
          render();
        });
      } catch (e) {
        state.error = e.message;
      }
      state.loading = false;
      render();
    }

    function solve() {
      const entry = selected();
      if (!entry) return;
      state.solving = true;
      state.error = null;
      render();
      // Let the panel paint "Solving..." before the search blocks the page for a moment.
      setTimeout(() => {
        try {
          const c = entry.challenge;
          const slots = H.fut.slotsFor(c);
          if (!slots) throw new Error('This SBC uses a formation the app has not loaded yet. Open the challenge first.');
          const rules = H.fut.rulesFor(c);
          const pool = H.fut.clubPool({ ...settings, protectFrom: Number(settings.protectFrom) || 0 });
          const result = H.solver.solve({
            slots,
            rules,
            pool,
            requiredSlots: H.fut.requiredSlotsFor(c),
            market: { enabled: settings.allowMarket },
            ratingFloat: H.fut.ratingUsesFloat(),
            thresholds: H.fut.chemThresholds(),
            seed: Date.now() % 100000,
          });
          const players = result.squad.map((s) => s.player);
          result.eaChem = H.fut.eaChemistry(c.formation, players);
          result.rules = rules;
          result.poolSize = pool.length;
          state.result = result;
        } catch (e) {
          state.error = e.message;
        }
        state.solving = false;
        render();
      }, 30);
    }

    function setSetting(key, value) {
      settings[key] = value;
      saveSettings(settings);
    }

    // Picking each set's cards takes a moment on a big club, so the result is reused until the
    // cards, the sets or the ticked slots change.
    let lastResults = { key: null, results: [] };
    function gallerySetResults(data) {
      const cards = H.fut.galleryCards();
      const done = settings.galleryDone || {};
      let sum = 0;
      for (const c of cards) sum = (sum * 31 + Number(c.id) + (c.score || 0) * 7) % 2147483647;
      const key = [data.publishedAt, data.sets.length, cards.length, sum, JSON.stringify(done)].join('|');
      if (lastResults.key !== key) lastResults = { key, results: H.setMatch.matchAll(data.sets, cards, done) };
      return lastResults.results;
    }

    // Slots the player ticked as done in the game, per set: { [setId]: [slot indexes] }.
    function toggleDone(setId, index) {
      const all = { ...(settings.galleryDone || {}) };
      const list = new Set(all[setId] || []);
      if (list.has(index)) list.delete(index); else list.add(index);
      if (list.size) all[setId] = Array.from(list).sort((a, b) => a - b); else delete all[setId];
      setSetting('galleryDone', all);
      render();
    }

    function ruleStatus(rule) {
      if (!rule.supported) return { icon: '?', cls: 'unknown', hint: 'Not checked by FutFox yet. Check it yourself.' };
      if (!state.result) return { icon: '•', cls: 'muted', hint: '' };
      const r = state.result.ruleResults.find((x) => x.rule === rule);
      if (!r) return { icon: '•', cls: 'muted', hint: '' };
      return r.shortfall === 0 ? { icon: '✓', cls: 'ok', hint: '' } : { icon: '✗', cls: 'bad', hint: `Short by ${r.shortfall}` };
    }

    function renderResult() {
      const res = state.result;
      if (!res) return null;
      const chem = res.eaChem ? res.eaChem.total : res.chemistry;
      const perPlayer = res.eaChem ? res.eaChem.perPlayer : res.squad.map((s) => s.chemistry);
      const buys = res.squad.filter((s) => s.player && s.player.source === 'market');

      const summary = el('div', { class: 'summary' }, [
        el('span', {}, [el('strong', { text: String(res.rating) }), ' rating']),
        el('span', {}, [el('strong', { text: String(chem) }), res.eaChem ? ' chemistry' : ' chemistry (estimate)']),
        el('span', {}, [
          H.fut.coinImage && H.fut.coinImage() ? el('img', { class: 'coin', src: H.fut.coinImage(), alt: '' }) : null,
          el('strong', { text: coins(res.cost) }), ' est. coins',
        ]),
        el('span', { class: res.feasible ? 'ok' : 'bad', text: res.feasible ? 'Meets the rules' : 'Could not meet every rule' }),
      ]);

      const rows = res.squad.map((s, i) => {
        const p = s.player;
        if (!p) {
          return el('tr', {}, [el('td', { class: 'pos', text: H.fut.positionName(s.typeId) }), el('td', { colspan: '4', class: 'muted', text: 'Empty' })]);
        }
        const isBuy = p.source === 'market';
        const name = isBuy ? `Buy a ${p.rating}-rated ${H.fut.positionName(s.typeId)}` : p.name;
        const meta = `${H.fut.leagueName(p.leagueId)} · ${H.fut.nationName(isBuy ? p.search.nationId : p.nationId)}`;
        const tag = isBuy
          ? el('button', { class: 'small primary', type: 'button', text: 'Search market', onclick: () => H.fut.openMarketSearch(p.search) })
          : el('span', { class: p.untradeable ? 'tag untr' : 'tag', text: p.untradeable ? 'Untradeable' : 'Club' });
        return el('tr', {}, [
          el('td', { class: 'pos', text: H.fut.positionName(s.typeId) }),
          el('td', { class: 'r', text: String(p.rating) }),
          el('td', {}, [el('span', { class: 'name', text: name }), el('span', { class: 'meta', text: meta })]),
          el('td', { class: 'chem', title: `${perPlayer[i]} chemistry`, text: '◆'.repeat(perPlayer[i] || 0) || '–' }),
          el('td', {}, [tag]),
        ]);
      });

      return el('section', {}, [
        el('h2', { text: 'Suggested squad' }),
        summary,
        el('table', {}, [el('tbody', {}, rows)]),
        buys.length
          ? el('p', { class: 'note', text: `${buys.length} card${buys.length > 1 ? 's' : ''} to buy. "Search market" fills in quality, position, league and nation; the market has no rating filter, so pick a card with the rating shown. You press Search and choose what to buy. Prices for cards you don't own are rough estimates.` })
          : null,
        res.eaChem ? null : el('p', { class: 'note', text: "Chemistry is estimated because the squad includes cards to buy. Check it in the squad builder." }),
        el('p', { class: 'note', text: `Picked from ${res.poolSize} club players. Nothing has been placed in your squad.` }),
      ]);
    }

    // What FutFox keeps in this browser for the Gallery (remembered cards, ticked slots), to copy
    // it to a file or bring a copy back. Importing adds to what is here; nothing is replaced.
    function savedDataSection() {
      if (!H.fut.galleryMemory) return null;
      const { memory } = H.fut.galleryMemory();
      const cards = Object.keys(memory.cards).length;
      const ticks = Object.values(settings.galleryDone || {}).reduce((n, list) => n + list.length, 0);
      const msg = state.dataMessage;
      return el('section', {}, [
        el('h2', { text: 'Saved in this browser' }),
        el('p', { class: 'muted', text: `${cards} ${cards === 1 ? 'card' : 'cards'} remembered · ${ticks} ${ticks === 1 ? 'slot' : 'slots'} ticked done in game` }),
        el('div', { class: 'row' }, [
          el('button', { type: 'button', text: 'Export', disabled: !cards && !ticks, onclick: exportGalleryData }),
          el('label', { class: 'file' }, [
            el('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Import a FutFox Gallery data file', onchange: (e) => importGalleryData(e.target.files[0]) }),
            el('span', { text: 'Import' }),
          ]),
        ]),
        msg ? el('p', { class: msg.kind === 'bad' ? 'error' : 'note', role: 'status', text: msg.text }) : null,
        el('p', { class: 'note', text: 'Only this browser keeps these. Export a copy to move them to another browser or keep them safe; importing adds to what is here.' }),
      ]);
    }

    function exportGalleryData() {
      const { memory, persona } = H.fut.galleryMemory();
      const data = H.gallery.exportData({ memory, done: settings.galleryDone || {}, persona, now: Date.now() });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const link = el('a', { href: url, download: `futfox-gallery-${new Date().toISOString().slice(0, 10)}.json` });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      state.dataMessage = { kind: 'ok', text: `Exported ${data.cards.length} cards and ${Object.values(data.done).reduce((n, l) => n + l.length, 0)} ticked slots.` };
      render();
    }

    async function importGalleryData(file) {
      if (!file) return;
      let read;
      try {
        read = H.gallery.readExport(JSON.parse(await file.text()));
      } catch (e) {
        read = { error: `${file.name} isn't a FutFox Gallery data file (it isn't JSON).` };
      }
      if (read.error) { state.dataMessage = { kind: 'bad', text: read.error }; return render(); }
      const { memory, persona } = H.fut.galleryMemory();
      const merged = H.gallery.mergeMemory(memory, read.memory);
      const done = H.gallery.mergeDone(settings.galleryDone, read.done);
      // Only what the file added: cards and ticks already here aren't counted again.
      const tickCount = (d) => Object.values(d || {}).reduce((n, l) => n + l.length, 0);
      const cards = Object.keys(merged.cards).length - Object.keys((memory && memory.cards) || {}).length;
      const ticks = tickCount(done) - tickCount(settings.galleryDone);
      H.fut.replaceGalleryMemory(merged);
      setSetting('galleryDone', done);
      const other = read.persona && String(read.persona) !== String(persona) ? ' The file comes from another EA account; its cards now count for this one.' : '';
      const added = cards || ticks
        ? `Added ${cards} ${cards === 1 ? 'card' : 'cards'} and ${ticks} ticked ${ticks === 1 ? 'slot' : 'slots'}.`
        : 'Nothing new: everything in the file was already here.';
      state.dataMessage = { kind: 'ok', text: `${added}${other}` };
      render();
    }

    function clubSection(known) {
      return el('section', {}, [
        el('h2', { text: 'Your club' }),
        el('p', { class: 'muted', text: state.loading ? `Loading… ${state.loadedCount || 0} players so far` : `${known} players known` }),
        el('div', { class: 'row' }, [el('button', { type: 'button', text: 'Load my club', disabled: state.loading, onclick: loadClub })]),
        el('p', { class: 'note', text: 'Reads your club list the same way the Club screen does, one page every few seconds.' }),
      ]);
    }

    async function loadSets(force) {
      state.sets.loading = true;
      state.sets.error = null;
      render();
      try {
        state.sets.data = await H.gallerySource.load({ force });
      } catch (e) {
        state.sets.error = e.message || String(e);
        state.sets.data = state.sets.data || H.gallerySource.cached();
      }
      state.sets.loading = false;
      render();
    }

    const day = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    function slotLine(slot) {
      if (slot.kind === 'card') return { rating: slot.rating == null ? '' : String(slot.rating), name: slot.name || `Player ${slot.playerId}`, meta: slot.version || 'Any version' };
      const parts = [
        slot.version,
        slot.leagueIds && slot.leagueIds.length && slot.leagueIds.map((id) => H.fut.leagueName(id)).join(' or '),
        slot.leagueId != null && H.fut.leagueName(slot.leagueId),
        slot.nationId != null && H.fut.nationName(slot.nationId),
        slot.minRating != null && `${slot.minRating}+`,
      ];
      return { rating: '', name: slot.label, meta: parts.filter(Boolean).join(' · ') || 'Any card' };
    }

    // A category's or set's picture: its own art from art/ first, then the Web App's club badge or
    // league logos (see setMatch.picture), then its first letter.
    const ART = H.art || {};
    // The Gallery Token: art/token.png, else the generic token the Web App's rewards use.
    const tokenSrc = () => ART.token || (H.fut.tokenImage && H.fut.tokenImage());
    const slug = (name) => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const urlsOf = (found) => (!found ? []
      : found.club != null ? [H.fut.clubBadge && H.fut.clubBadge(found.club)]
        : found.rarity != null ? [H.fut.rarityImage && H.fut.rarityImage(found.rarity)]
          : found.leagues.map((id) => H.fut.leagueLogo && H.fut.leagueLogo(id))).filter(Boolean);
    const pictureUrls = (kind, name, slots) => {
      const own = ART[`${kind}/${slug(name)}`];
      return own ? [own] : urlsOf(H.setMatch.picture(slots));
    };
    function pictureEl(kind, name, slots) {
      const [main, second] = pictureUrls(kind, name, slots);
      const letter = () => el('span', { class: 'letter', text: String(name).trim().charAt(0).toUpperCase() });
      if (!main) return el('span', { class: 'pic', 'aria-hidden': 'true' }, [letter()]);
      // EA has no image for some clubs (London City Lionesses): fall back to the letter.
      const pic = el('span', { class: 'pic', 'aria-hidden': 'true' }, [el('img', { src: main, alt: '', onerror: () => pic.replaceChildren(letter()) })]);
      if (second) pic.append(el('img', { class: 'second', src: second, alt: '', onerror: (e) => e.target.remove() }));
      return pic;
    }

    // The parts every set shows, in the list and when open: picture, name, progress and a one-line summary.
    function setHead(res, tag, attrs) {
      return el(tag, { class: 'set-head', ...attrs }, [
        pictureEl('set', res.name, res.slots.map((e) => e.slot)),
        el('span', { class: 'name', text: res.name }),
        el('span', { class: 'count', text: `${res.have} of ${res.total}` }),
        el('span', { class: 'bar', 'aria-hidden': 'true' }, [el('span', { style: `width:${Math.round((100 * res.have) / (res.total || 1))}%` })]),
        el('span', { class: 'meta', text: [res.grade ? `Grade ${res.grade} with your cards` : null, res.unsure ? `${res.unsure} to check` : null].filter(Boolean).join(' · ') || `${res.total - res.have} missing` }),
      ]);
    }

    // The Gallery has three levels, like the admin: categories, a category's sets, one set.
    // Going down remembers where the list was scrolled; going back returns there.
    const OTHER = 'Other';
    const categoryOf = (res) => res.group || OTHER;
    const level = () => (state.openSet != null ? 'set' : state.category != null ? 'category' : 'home');

    function go(category, setId) {
      const body = panel.querySelector('.body');
      const from = level();
      state.scrolls[from] = body ? body.scrollTop : 0;
      state.category = category;
      state.openSet = setId;
      const to = level();
      // Back up a level: where that list was; down a level: the top.
      state.scrollTo = ['home', 'category', 'set'].indexOf(to) < ['home', 'category', 'set'].indexOf(from) ? state.scrolls[to] || 0 : 0;
      render();
    }

    function crumbs(parts) {
      const items = [];
      parts.forEach(([text, onclick], i) => {
        if (i) items.push(el('span', { class: 'sep', 'aria-hidden': 'true', text: '›' }));
        items.push(onclick ? el('button', { type: 'button', class: 'small', text: i ? text : `← ${text}`, onclick }) : el('span', { class: 'current', 'aria-current': 'page', text }));
      });
      return el('nav', { class: 'crumbs', 'aria-label': 'Gallery' }, items);
    }

    // Gallery Tokens a set gives: every grade's token reward, and the ones of the grades your cards reach
    // (a grade's reward comes with it, so reaching S earns D to S).
    const tokensIn = (reward) => { const m = /(\d+)\s+Gallery Tokens?/i.exec(reward || ''); return m ? Number(m[1]) : 0; };
    function setTokens(res) {
      const graded = H.setMatch.GRADES.filter((g) => res.grades[g] != null);
      const sum = (list) => list.reduce((n, g) => n + tokensIn(res.rewards[g]), 0);
      return { earned: sum(graded.filter((g) => res.score >= res.grades[g])), total: sum(graded) };
    }

    // A category's logos: its own art, else the club or one or two leagues all its sets share (Premier
    // League and Barclays WSL), else the first picture of each set, up to three (Leagues, Rarities).
    function categoryLogos(name, sets) {
      const own = ART[`category/${slug(name)}`];
      if (own) return { urls: [own], from: [] };
      const shared = H.setMatch.picture(sets.flatMap((r) => r.slots.map((e) => e.slot)));
      if (shared && shared.rarity == null) return { urls: urlsOf(shared), from: [] };
      const urls = [];
      const from = [];
      for (const r of sets) {
        const [url] = pictureUrls('set', r.name, r.slots.map((e) => e.slot));
        if (url && !urls.includes(url)) { urls.push(url); from.push(r.name); }
        if (urls.length === 3) break;
      }
      return { urls, from };
    }

    // One card per category: its logos, the Gallery Tokens your cards earn of all its sets give, how many
    // sets it has, and how many of them your cards take to each grade.
    function categoryCard(name, sets) {
      const [title, ...rest] = name.split(' / ');
      const logos = categoryLogos(name, sets);
      const pictured = sets.map((r) => H.setMatch.picture(r.slots.map((e) => e.slot)) || {});
      const sub = rest.join(' / ')
        || (pictured.every((p) => p.club != null) ? 'Explore club collections'
          : pictured.every((p) => p.leagues) ? 'Explore league collections'
            : `${(logos.from.length ? logos.from : sets.map((r) => r.name)).slice(0, 2).join(', ')}${sets.length > 2 ? ' & more' : ''}`);
      const tokens = sets.map(setTokens).reduce((t, s) => ({ earned: t.earned + s.earned, total: t.total + s.total }), { earned: 0, total: 0 });
      const grades = H.setMatch.GRADES.map((g) => {
        const n = sets.filter((r) => r.grade === g).length;
        return el('span', { class: `grade g-${g}${n ? '' : ' none'}`, title: `${n} ${n === 1 ? 'set' : 'sets'} at grade ${g} with your cards` }, [
          el('span', { class: 'dia', text: g }),
          el('span', { class: 'n', text: String(n) }),
        ]);
      });
      const logo = (src) => el('img', { src, alt: '', onerror: (e) => e.target.remove() });
      return el('button', { type: 'button', class: 'cat', onclick: () => go(name, null) }, [
        el('span', { class: 'cat-top' }, [
          el('span', { class: 'logos', 'aria-hidden': 'true' }, logos.urls.length ? logos.urls.map(logo) : [el('span', { class: 'letter', text: title.trim().charAt(0).toUpperCase() })]),
          tokens.total ? el('span', { class: 'tokens', title: 'Gallery Tokens your cards earn, of all this category gives' }, [
            tokenSrc() ? el('img', { src: tokenSrc(), alt: '' }) : null,
            el('strong', { text: coins(tokens.earned) }),
            el('span', { class: 'muted', text: ` / ${coins(tokens.total)}` }),
          ]) : null,
          el('span', { class: 'chip', text: `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}` }),
        ]),
        el('span', { class: 'grades' }, grades),
        el('span', { class: 'cat-foot' }, [
          el('span', {}, [el('span', { class: 'cat-name', text: title }), el('span', { class: 'cat-sub', text: sub })]),
          el('span', { class: 'go', 'aria-hidden': 'true', text: '↗' }),
        ]),
      ]);
    }

    function setCard(res) {
      return el('div', { class: 'set' }, [setHead(res, 'button', { type: 'button', onclick: () => go(categoryOf(res), res.id) })]);
    }

    function setPage(res) {
      const entries = res.slots.map((e, index) => ({ ...e, index })).filter((e) => e.slot);
      const missing = entries.filter((e) => !e.card && !e.done);
      const have = entries.filter((e) => e.card);
      const done = entries.filter((e) => e.done);
      const row = (entry) => {
        const line = slotLine(entry.slot);
        const mark = entry.done ? { cls: 'ok', icon: '✓', hint: 'You marked this slot as done in the game' }
          : !entry.card ? { cls: 'bad', icon: '✗', hint: 'Missing' }
          : entry.unsure ? { cls: 'unknown', icon: '?', hint: "This slot's version has no number yet, so FutFox can't check it: check this card in the game" }
          : entry.card.remembered ? { cls: 'ok', icon: '✓', hint: 'FutFox saw this card in your club before; it still counts in the Gallery' }
          : { cls: 'ok', icon: '✓', hint: 'In your club' };
        const yours = entry.card && `yours: ${entry.card.name} ${entry.card.rating}${entry.card.remembered ? ' (seen earlier)' : ''}`;
        // A missing slot can be ticked when the card is already in the game's Gallery; a ticked one can be undone.
        const tick = entry.done || !entry.card
          ? el('button', { type: 'button', class: 'small', text: entry.done ? 'Undo' : 'Done in game', title: entry.done ? 'Count this slot as missing again' : 'Already in this set in the game: count it as filled', onclick: () => toggleDone(res.id, entry.index) })
          : null;
        return el('tr', { title: mark.hint }, [
          el('td', { class: `mark ${mark.cls}`, text: mark.icon }),
          el('td', { class: 'r', text: line.rating }),
          el('td', {}, [
            el('span', { class: 'name', text: line.name }),
            el('span', { class: 'meta', text: [line.meta, yours, entry.done && 'done in the game'].filter(Boolean).join(' · ') }),
          ]),
          el('td', { class: 'act' }, tick ? [tick] : []),
        ]);
      };
      // The set's grade ladder: the lowest score for each grade, what it gives, and which ones your cards reach.
      const grades = H.setMatch.GRADES.filter((g) => res.grades[g] != null).map((g) => {
        const reached = res.score >= res.grades[g];
        return el('tr', { title: reached ? 'Your matching cards reach this grade' : 'Not reached yet' }, [
          el('td', { class: `mark ${reached ? 'ok' : 'bad'}`, text: reached ? '✓' : '·' }),
          el('td', { class: 'r', text: g }),
          el('td', {}, [
            el('span', { class: 'name' }, [
              /token/i.test(res.rewards[g] || '') && tokenSrc() ? el('img', { class: 'token', src: tokenSrc(), alt: '' }) : null,
              res.rewards[g] || 'Reward not listed',
            ]),
            el('span', { class: 'meta', text: `From ${coins(res.grades[g])} Item Score` }),
          ]),
        ]);
      });
      // Bonus tags the set's cards reach, then the ones a card or two short of their first tier.
      const tagRow = (t) => el('tr', { title: t.rule }, [
        el('td', { class: `mark ${t.tier ? 'ok' : 'bad'}`, text: t.tier ? '✓' : '·' }),
        el('td', { class: 'r', text: t.tier ? `+${t.tier.percent}%` : '' }),
        el('td', {}, [
          el('span', { class: 'name', text: t.name }),
          el('span', { class: 'meta', text: [
            t.tier ? `${t.count} cards · +${coins(t.bonus)} Item Score` : `${t.count} of ${t.next.count} cards`,
            t.next && `${t.next.count} for +${t.next.percent}%`,
          ].filter(Boolean).join(' · ') }),
        ]),
      ]);
      const active = res.tags.filter((t) => t.tier);
      // One card is always "1 copy" of itself, so Multiples! only counts as close from two copies.
      const close = res.tags.filter((t) => !t.tier && t.count > (t.name === 'Multiples!' ? 1 : 0) && t.next.count - t.count <= 2);
      return el('div', { class: 'set open' }, [
        setHead(res, 'div', {}),
        el('div', { class: 'set-body' }, [
          missing.length ? el('h3', { text: `Missing (${missing.length})` }) : null,
          missing.length ? el('table', {}, [el('tbody', {}, missing.map(row))]) : null,
          have.length ? el('h3', { text: `Your cards (${have.length})` }) : null,
          have.length ? el('table', {}, [el('tbody', {}, have.map(row))]) : null,
          done.length ? el('h3', { text: `Done in the game (${done.length})` }) : null,
          done.length ? el('table', {}, [el('tbody', {}, done.map(row))]) : null,
          res.score ? el('p', { class: 'note', text: res.bonus ? `Gallery Item Score of your matching cards: ${coins(res.baseScore)} + ${coins(res.bonus)} from bonus tags = ${coins(res.score)}.` : `Gallery Item Score of your matching cards: ${coins(res.score)}.` }) : null,
          active.length ? el('h3', { text: `Bonus tags (${active.length})` }) : null,
          active.length ? el('table', {}, [el('tbody', {}, active.map(tagRow))]) : null,
          close.length ? el('h3', { text: 'Bonus tags almost reached' }) : null,
          close.length ? el('table', {}, [el('tbody', {}, close.map(tagRow))]) : null,
          grades.length ? el('h3', { text: 'Grades' }) : null,
          grades.length ? el('table', {}, [el('tbody', {}, grades)]) : null,
        ]),
      ]);
    }

    function renderGallery(known) {
      const { data, loading, error } = state.sets;
      const results = data ? gallerySetResults(data) : [];
      const open = state.openSet != null && results.find((r) => r.id === state.openSet);
      if (open) {
        const category = categoryOf(open);
        return [el('section', {}, [
          crumbs([['Categories', () => go(null, null)], [category, () => go(category, null)], [open.name]]),
          setPage(open),
        ])];
      }
      const inCategory = state.category != null ? results.filter((r) => categoryOf(r) === state.category) : [];
      if (inCategory.length) {
        return [el('section', {}, [
          crumbs([['Categories', () => go(null, null)], [state.category]]),
          el('div', { class: 'sets' }, inCategory.map(setCard)),
        ])];
      }
      const categories = new Map();
      for (const r of results) {
        if (!categories.has(categoryOf(r))) categories.set(categoryOf(r), []);
        categories.get(categoryOf(r)).push(r);
      }
      const names = [...categories.keys()].sort((a, b) => (a === OTHER) - (b === OTHER) || a.localeCompare(b));
      return [
        el('section', {}, [
          el('h2', { text: 'Gallery sets' }),
          el('div', { class: 'row' }, [
            el('span', { class: 'muted', text: loading ? 'Loading sets…' : data && data.sets.length ? `${data.sets.length} ${data.sets.length === 1 ? 'set' : 'sets'} · updated ${day(data.publishedAt)}` : 'No sets published yet' }),
            el('button', { class: 'small', type: 'button', text: 'Refresh sets', disabled: loading, onclick: () => loadSets(true) }),
          ]),
          error ? el('p', { class: 'error', text: error }) : null,
          known ? null : el('p', { class: 'note', text: 'Press Load my club so FutFox can check which cards you have.' }),
          results.length ? el('div', { class: 'sets' }, names.map((name) => categoryCard(name, categories.get(name)))) : null,
          results.length ? el('p', { class: 'note', text: 'Cards match on player, rating and version. "?" means FutFox can\'t check the version for that slot, so check it in the game. Cards you sold or used in an SBC still count in the Gallery: FutFox keeps every card it has seen in your club in this browser, and for older ones press Done in game. Loan cards never count. Bonus tags are worked out from the cards FutFox would use. Build and submit sets in the game.' }) : null,
        ]),
        clubSection(known),
        savedDataSection(),
      ];
    }

    function setView(view) {
      setSetting('view', view);
      if (view === 'gallery' && !state.sets.data && !state.sets.loading) loadSets(false);
      else render();
    }

    function render() {
      // Rebuilding the panel keeps the scroll position, unless a set was just opened or closed.
      const before = panel.querySelector('.body');
      const scroll = state.scrollTo != null ? state.scrollTo : before ? before.scrollTop : 0;
      state.scrollTo = null;
      const entry = selected();
      const known = H.fut.knownClubItems().length;
      const view = H.fut.galleryEnabled ? settings.view : 'sbc';
      // The Gallery tab shows the Gallery Token until there is an art/gallery.png.
      const tabIcon = (name) => {
        const src = ART[name] || (name === 'gallery' ? ART.token : null);
        return src ? el('img', { src, alt: '' }) : null;
      };
      const tab = (name, label) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === name), onclick: () => setView(name) }, [tabIcon(name), label]);
      panel.replaceChildren(...[
        grip,
        el('header', {}, [el('div', { class: 'brand' }, [foxIcon(), el('h1', { text: 'FutFox' })]), el('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '×', onclick: () => (panel.hidden = true) })]),
        H.fut.galleryEnabled ? el('div', { class: 'tabs', role: 'tablist' }, [tab('sbc', 'SBC'), tab('gallery', 'Gallery')]) : null,
        view === 'gallery' ? el('div', { class: 'body' }, renderGallery(known)) : el('div', { class: 'body' }, [
          el('section', {}, [
            el('h2', { text: 'Challenge' }),
            state.challenges.length
              ? el('select', { id: 'futfox-challenge', onchange: (e) => { state.selectedId = Number(e.target.value); state.result = null; render(); } },
                  state.challenges.map((c) => el('option', { value: String(c.id), selected: c.id === state.selectedId, text: `${c.setName} – ${c.name}${c.status === 'COMPLETED' ? ' (done)' : ''}` })))
              : el('p', { class: 'muted', text: 'Open an SBC set in the app, then press Refresh.' }),
            el('div', { class: 'row' }, [el('button', { type: 'button', text: 'Refresh', onclick: refreshChallenges })]),
          ]),
          entry
            ? el('section', {}, [
                el('h2', { text: 'Requirements' }),
                el('ul', { class: 'rules' }, H.fut.rulesFor(entry.challenge).map((rule) => {
                  // Match by key and value, since rulesFor() builds fresh objects each time.
                  const resultRule = state.result && state.result.rules.find((r) => r.key === rule.key && r.label === rule.label);
                  const st = ruleStatus(resultRule || rule);
                  return el('li', { title: st.hint }, [el('span', { class: st.cls, text: st.icon }), el('span', { text: rule.label + (st.hint ? ` – ${st.hint}` : '') })]);
                })),
              ])
            : null,
          clubSection(known),
          el('section', {}, [
            el('h2', { text: 'Options' }),
            el('label', { class: 'check' }, [el('input', { id: 'futfox-keep', type: 'checkbox', checked: settings.keepActiveSquad, onchange: (e) => setSetting('keepActiveSquad', e.target.checked) }), 'Keep my active squad players']),
            el('label', { class: 'check' }, [el('input', { id: 'futfox-untr', type: 'checkbox', checked: settings.untradeablesOnly, onchange: (e) => setSetting('untradeablesOnly', e.target.checked) }), 'Use untradeables only']),
            el('label', { class: 'check' }, [el('input', { id: 'futfox-market', type: 'checkbox', checked: settings.allowMarket, onchange: (e) => setSetting('allowMarket', e.target.checked) }), 'Suggest cards to buy when the club falls short']),
            el('label', { class: 'check' }, ['Keep players rated', el('input', { id: 'futfox-protect', type: 'number', min: '0', max: '99', value: String(settings.protectFrom), onchange: (e) => setSetting('protectFrom', Number(e.target.value)) }), 'and above']),
          ]),
          el('div', { class: 'row' }, [
            el('button', { class: 'primary', type: 'button', text: state.solving ? 'Solving…' : 'Find cheapest squad', disabled: !entry || state.solving, onclick: solve }),
          ]),
          state.error ? el('p', { class: 'error', text: state.error }) : null,
          renderResult(),
        ]),
        el('footer', { text: 'Read-only: FutFox never buys, bids, lists or submits. Not affiliated with EA.' }),
      ].filter(Boolean));
      const body = panel.querySelector('.body');
      if (body) body.scrollTop = scroll;
    }

    if (H.fut.galleryEnabled && settings.view === 'gallery') loadSets(false);
    else render();
    return { refresh: refreshChallenges };
  }

  H.panel = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
