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
      padding: 8px 16px 8px 10px; font: 700 13px/1 system-ui, sans-serif; letter-spacing: .04em; cursor: pointer;
      display: flex; align-items: center; gap: 8px; background: #0E0B1F; color: #fff; box-shadow: 0 0 0 1px #8B5CF6, 0 4px 14px rgba(0,0,0,.35); }
    .fox { width: 22px; height: 22px; flex: none; }
    header .fox { width: 26px; height: 26px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .toggle:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #C6FF3D; outline-offset: 2px; }
    .panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(420px, 100vw); z-index: 2147483001; display: flex; flex-direction: column;
      background: #120F24; color: #e7ebf2; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: -8px 0 24px rgba(0,0,0,.45); }
    .panel[hidden] { display: none; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2A2445; }
    h1 { margin: 0; font-size: 16px; font-weight: 700; }
    h2 { margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #9A93B8; }
    .body { flex: 1; overflow-y: auto; padding: 16px; display: grid; gap: 18px; align-content: start; }
    section { display: grid; gap: 8px; }
    select, input[type=number] { width: 100%; background: #1B1733; color: inherit; border: 1px solid #352E55; border-radius: 6px; padding: 7px 8px; font: inherit; }
    input[type=number] { width: 72px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #352E55; background: #1B1733; color: inherit; padding: 7px 12px; }
    button.primary { background: #8B5CF6; color: #fff; border-color: #8B5CF6; font-weight: 700; }
    button:disabled { opacity: .5; cursor: default; }
    .close { border: 0; background: none; font-size: 20px; line-height: 1; padding: 4px 8px; color: #9A93B8; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    label.check { display: flex; align-items: center; gap: 8px; }
    input[type=checkbox] { accent-color: #8B5CF6; }
    .muted { color: #9A93B8; }
    ul.rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    ul.rules li { display: grid; grid-template-columns: 18px 1fr; gap: 6px; }
    .ok { color: #6fd29a; } .bad { color: #f08a7a; } .unknown { color: #e8c45a; }
    .summary { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px 12px; border-radius: 8px; background: #1B1733; font-variant-numeric: tabular-nums; }
    .summary strong { font-size: 15px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    td { padding: 6px 4px; border-bottom: 1px solid #241F3C; vertical-align: middle; }
    td.pos { color: #9A93B8; width: 40px; font-size: 11px; }
    td.r { width: 28px; font-weight: 700; }
    td.chem { width: 34px; color: #C6FF3D; letter-spacing: -1px; }
    .name { display: block; font-weight: 600; }
    .meta { display: block; font-size: 11px; color: #9A93B8; }
    .tag { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 6px; border-radius: 999px; background: #2A2445; color: #C9C3E0; white-space: nowrap; }
    .tag.buy { background: #2A1F4D; color: #C4B1FF; }
    .tag.untr { background: #1d3327; color: #6fd29a; }
    button.small { padding: 3px 8px; font-size: 11px; }
    .note { font-size: 11px; color: #9A93B8; }
    .error { color: #f08a7a; }
    .tabs { display: flex; gap: 4px; padding: 10px 16px 0; border-bottom: 1px solid #2A2445; }
    .tabs button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; color: #9A93B8; padding: 8px 10px; font-weight: 600; }
    .tabs button[aria-selected="true"] { color: #fff; border-bottom-color: #8B5CF6; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { padding: 4px 10px; border-radius: 999px; font-size: 12px; }
    .chips button[aria-pressed="true"] { background: #8B5CF6; border-color: #8B5CF6; color: #fff; font-weight: 700; }
    td.score { text-align: right; font-weight: 700; white-space: nowrap; }
    td.marks { text-align: right; }
    .marks .tag { display: inline-block; margin: 2px 0 2px 4px; }
    .tag.owner { background: #2A1F4D; color: #C4B1FF; }
    footer { padding: 10px 16px; border-top: 1px solid #2A2445; font-size: 11px; color: #9A93B8; }
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

  function create() {
    const host = el('div', { id: 'futfox-root' });
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(el('style', { text: CSS }));
    document.body.append(host);

    const settings = loadSettings();
    const state = { challenges: [], selectedId: null, result: null, loading: false, error: null, solving: false, galleryFilter: 'all', galleryLimit: 50 };

    const toggle = el('button', { class: 'toggle', type: 'button' }, [foxIcon(), 'FutFox']);
    const panel = el('aside', { class: 'panel', hidden: true, 'aria-label': 'FutFox' });
    shadow.append(toggle, panel);

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
        el('span', {}, [el('strong', { text: coins(res.cost) }), ' est. coins']),
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

    function clubSection(known) {
      return el('section', {}, [
        el('h2', { text: 'Your club' }),
        el('p', { class: 'muted', text: state.loading ? `Loading… ${state.loadedCount || 0} players so far` : `${known} players known` }),
        el('div', { class: 'row' }, [el('button', { type: 'button', text: 'Load my club', disabled: state.loading, onclick: loadClub })]),
        el('p', { class: 'note', text: 'Reads your club list the same way the Club screen does, one page every few seconds.' }),
      ]);
    }

    const GALLERY_FILTERS = [['all', 'All'], ['collected', 'Collected'], ['unmarked', 'Not marked'], ['firstOwner', 'First owner']];

    function renderGallery(known) {
      const rows = H.fut.galleryCards();
      const counts = H.gallery.countByFilter(rows);
      const shown = H.gallery.filterRows(rows, state.galleryFilter);
      const visible = shown.slice(0, state.galleryLimit);

      const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Show' }, GALLERY_FILTERS.map(([key, label]) =>
        el('button', {
          type: 'button',
          'aria-pressed': String(state.galleryFilter === key),
          text: `${label} ${counts[key].toLocaleString('en-US')}`,
          onclick: () => { state.galleryFilter = key; state.galleryLimit = 50; render(); },
        })));

      const table = el('table', {}, [el('tbody', {}, visible.map((row) => el('tr', {}, [
        el('td', { class: 'r', text: String(row.rating) }),
        el('td', {}, [el('span', { class: 'name', text: row.name }), el('span', { class: 'meta', text: `${H.fut.leagueName(row.leagueId)} · ${H.fut.nationName(row.nationId)}` })]),
        el('td', { class: 'score', title: 'Gallery Item Score', text: coins(row.score) }),
        el('td', { class: 'marks' }, [
          row.collected ? el('span', { class: 'tag untr', text: 'Collected' }) : null,
          row.firstOwner ? el('span', { class: 'tag owner', title: 'EA reports one owner, so you most likely packed it', text: '1st owner' }) : null,
        ]),
      ])))]);

      return [
        el('section', {}, [
          el('h2', { text: 'Gallery' }),
          el('p', { class: 'note', text: "Each club card's Gallery Item Score, EA's collected mark and likely First Owner cards, highest score first. FutFox doesn't read or fill your Gallery sets: build those in the game." }),
          chips,
          shown.length
            ? table
            : el('p', { class: 'muted', text: rows.length ? 'No cards match this filter.' : 'No club cards yet. Press Load my club.' }),
          shown.length > visible.length
            ? el('div', { class: 'row' }, [
                el('span', { class: 'muted', text: `Showing ${visible.length} of ${shown.length}` }),
                el('button', { class: 'small', type: 'button', text: 'Show 50 more', onclick: () => { state.galleryLimit += 50; render(); } }),
              ])
            : null,
          el('p', { class: 'note', text: 'Collected marks come from the club pages FutFox has read, so press Load my club to see them all. "1st owner" means EA reports one owner; EA doesn\'t say for certain who packed a card.' }),
        ]),
        clubSection(known),
      ];
    }

    function setView(view) {
      setSetting('view', view);
      render();
    }

    function render() {
      const entry = selected();
      const known = H.fut.knownClubItems().length;
      const tab = (view, label) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(settings.view === view), text: label, onclick: () => setView(view) });
      panel.replaceChildren(
        el('header', {}, [el('div', { class: 'brand' }, [foxIcon(), el('h1', { text: 'FutFox' })]), el('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '×', onclick: () => (panel.hidden = true) })]),
        el('div', { class: 'tabs', role: 'tablist' }, [tab('sbc', 'SBC'), tab('gallery', 'Gallery')]),
        settings.view === 'gallery' ? el('div', { class: 'body' }, renderGallery(known)) : el('div', { class: 'body' }, [
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
      );
    }

    render();
    return { refresh: refreshChallenges };
  }

  H.panel = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
