// The FutFox side panel, drawn inside a shadow root so the Web App's styles and
// ours never mix.
(function (root) {
  'use strict';

  const H = root.FutFox;
  const { t, plural, parts } = H.i18n;
  const STORE_KEY = 'futfox.settings';

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    /* Scroll bars in the panel's colours: a thin rounded thumb on no track, lighter on hover and
       violet while dragged. */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #352E55; background-clip: padding-box; border: 3px solid transparent; border-radius: 999px; min-height: 40px; }
    ::-webkit-scrollbar-thumb:hover { background-color: #4A4170; }
    ::-webkit-scrollbar-thumb:active { background-color: #8B5CF6; }
    .toggle { position: fixed; right: 24px; bottom: 24px; z-index: 2147483000; border: 0; border-radius: 999px;
      padding: 8px 16px 8px 10px; font: 700 14px/1 system-ui, sans-serif; letter-spacing: .04em; cursor: pointer;
      display: flex; align-items: center; gap: 8px; background: #0E0B1F; color: #fff; box-shadow: 0 0 0 1px #8B5CF6, 0 4px 14px rgba(0,0,0,.35); }
    .fox { width: 24px; height: 24px; flex: none; }
    header .fox { width: 30px; height: 30px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .toggle:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #C6FF3D; outline-offset: 2px; }
    /* Never narrower than the default, never wider than the screen; the grip on the left edge resizes it. */
    .panel { position: fixed; top: 0; right: 0; bottom: 0; width: var(--futfox-width, 520px); min-width: min(520px, 100vw); max-width: 100vw;
      z-index: 2147483001; display: flex; flex-direction: column; overflow: hidden;
      background: #120F24; color: #e7ebf2; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: -8px 0 24px rgba(0,0,0,.45); }
    .grip { position: absolute; top: 0; bottom: 0; left: 0; width: 8px; cursor: ew-resize; touch-action: none; z-index: 1; }
    .grip:hover, .grip:focus-visible, .grip.dragging { background: linear-gradient(90deg, transparent 3px, #8B5CF6 3px, #8B5CF6 5px, transparent 5px); outline: none; }
    .panel[hidden], .toggle[hidden], .dock[hidden] { display: none; }
    /* While one of them shrinks away, clicks go to what is under it. */
    .leaving { pointer-events: none; }
    /* Drag and drop: the button, the placing card and the panel's header pick them up. */
    .toggle, .dock, header { touch-action: none; user-select: none; }
    .dock, header { cursor: grab; }
    .dragging, .dragging header { cursor: grabbing; }
    .dragging { opacity: .92; }
    /* Once moved, the panel floats: full height until it is resized from its bottom-right corner. */
    .panel.moved { bottom: auto; height: 100vh; min-height: 280px; max-height: 100vh; border-radius: 10px; overflow: hidden; resize: both;
      box-shadow: 0 0 0 1px #352E55, 0 12px 32px rgba(0,0,0,.5); }
    .panel.moved .grip { display: none; }
    /* The placing list, in the corner where the FutFox button sits: one line with the next player, or every player above it. */
    .dock { position: fixed; right: 24px; bottom: 16px; z-index: 2147483000; width: 360px; max-height: calc(100vh - 32px); display: flex; flex-direction: column;
      border-radius: 10px; background: #120F24; color: #e7ebf2; font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 0 0 1px #8B5CF6, 0 8px 24px rgba(0,0,0,.45); overflow: hidden; }
    .dock button { padding: 2px 8px; font-size: 12px; }
    /* A checklist: progress on top, then one row per card (small card, name, where to find it,
       Copy and a round tick), placed rows faded. */
    .dock-progress { flex: none; height: 3px; background: #2A2445; }
    /* Full width, scaled to the share placed, so a tick can grow it smoothly. */
    .dock-progress i { display: block; height: 100%; background: #C6FF3D; transform-origin: left; }
    .dock-head { padding: 8px 12px 4px; font-size: 12px; color: #9A93B8; }
    .dock-head strong { color: #e7ebf2; font-weight: 600; }
    .dock-bar { display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 8px; }
    .dock-list + .dock-bar { border-top: 1px solid #2A2445; }
    .dock .fox-btn { border: 0; background: none; padding: 2px; display: grid; }
    .dock .fox-btn .fox { width: 22px; height: 22px; }
    .dock .close { font-size: 20px; padding: 0 6px; height: 28px; }
    .dock-bar .icon-btn svg { width: 16px; height: 16px; }
    .dock-bar .count { flex: 1; color: #9A93B8; font-variant-numeric: tabular-nums; }
    .dock-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
    .dock-row { display: flex; align-items: center; gap: 10px; min-width: 0; font-variant-numeric: tabular-nums; }
    .dock-list .dock-row { padding: 6px 10px; border-top: 1px solid #221D3D; }
    .dock-list .dock-row:first-child { border-top: 0; }
    .dock-bar .dock-row { flex: 1; }
    .dock-row .card.small { width: 26px; }
    .dock-row .who { flex: 1; min-width: 0; display: grid; }
    .dock .name { position: relative; justify-self: start; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
    /* Isolated, so in Arabic the rating sits before a Latin name instead of running into it. */
    .dock .name .r { margin-inline-end: 6px; unicode-bidi: isolate; }
    .dock .sub { font-size: 12px; color: #9A93B8; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .dock .sub .store { color: #8cc4ff; }
    .dock .sub .pts { color: #e7ebf2; font-weight: 600; }
    .dock .sub .pts-icon { width: 12px; height: 12px; margin-inline-end: 3px; vertical-align: -2px; }
    .dock .icon-btn { margin: 0; width: 28px; height: 28px; }
    .dock button.tick { flex: none; width: 24px; height: 24px; padding: 0; border-radius: 50%; border: 2px solid #352E55; background: none; display: grid; place-items: center; color: #0B0918; font-size: 13px; font-weight: 800; line-height: 1; }
    .dock button.tick:hover { border-color: #C6FF3D; }
    .dock button.tick[aria-checked=true] { background: #C6FF3D; border-color: #C6FF3D; }
    .dock-row.placed > :not(.tick) { opacity: .45; }
    /* A line through the name, drawn from the left when the card is ticked. */
    .dock-row.placed .name::after { content: ""; position: absolute; left: 0; right: 0; top: 52%; height: 1.5px; background: currentColor; transform-origin: left; }
    .dock-bar .done { flex: 1; color: #6fd29a; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2A2445; }
    h1 { margin: 0; font-size: 18px; font-weight: 700; }
    h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #9A93B8; }
    .body { flex: 1; overflow-y: auto; padding: 16px; display: grid; gap: 18px; align-content: start; }
    section { display: grid; gap: 8px; }
    select, input[type=number] { width: 100%; background: #1B1733; color: inherit; border: 1px solid #352E55; border-radius: 6px; padding: 7px 8px; font: inherit; }
    input[type=number] { width: 72px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #352E55; background: #1B1733; color: inherit; padding: 7px 12px; }
    /* Lime marks the main action, as on the website; violet stays for opening the market. */
    button.primary { background: #C6FF3D; color: #0B0918; border-color: #C6FF3D; font-weight: 700; }
    button.primary:not(:disabled):hover { background: #D4FF6B; border-color: #D4FF6B; }
    /* Faded lime reads as olive, so a disabled main button goes grey instead. */
    button.primary:disabled { opacity: 1; background: #1B1733; border-color: #352E55; color: #6E6790; }
    button.market { background: #8B5CF6; color: #fff; border-color: #8B5CF6; font-weight: 700; }
    button:disabled { opacity: .5; cursor: default; }
    .close { border: 0; background: none; font-size: 24px; line-height: 1; padding: 4px 8px; color: #9A93B8; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    input[type=checkbox] { accent-color: #C6FF3D; }
    .muted { color: #9A93B8; }
    ul.rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    ol.steps { margin: 0; padding-inline-start: 20px; display: grid; gap: 6px; color: #C9C3E0; }
    ul.rules li { display: grid; grid-template-columns: 22px 1fr; gap: 6px; }
    .ok { color: #6fd29a; } .bad { color: #f08a7a; } .unknown { color: #e8c45a; }
    .summary { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px 12px; border-radius: 8px; background: #1B1733; font-variant-numeric: tabular-nums; }
    .summary strong { font-size: 17px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    td { padding: 7px 5px; border-bottom: 1px solid #241F3C; vertical-align: middle; }
    td.pos { color: #9A93B8; width: 48px; font-size: 13px; }
    td.r { width: 34px; font-weight: 700; }
    .name { display: block; font-weight: 600; }
    .meta { display: block; font-size: 13px; color: #9A93B8; }
    .tag { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 6px; border-radius: 999px; background: #2A2445; color: #C9C3E0; white-space: nowrap; }
    .tag.buy { background: #2A1F4D; color: #C4B1FF; }
    .tag.untr { background: #1d3327; color: #6fd29a; }
    /* A suggested card: untradeable, points or chemistry and Change on one line, then where it is. */
    /* As wide as the card's art (about 80% of its box), so the line starts and ends at its corners. */
    .pick-line { display: flex; align-items: center; gap: 4px; width: 80%; max-width: 128px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .pick-line .pts-icon { width: 14px; height: 14px; }
    .untr-ico { font-family: UltimateTeam-Icons, sans-serif; font-weight: 400; font-size: 14px; line-height: 1; color: #C9C3E0; }
    /* The game's untradeable glyph from its own icon font (the backslash is doubled for the template). */
    .untr-ico::before { content: '\\e0ea'; }
    button.icon-btn { margin-inline-start: auto; display: grid; place-items: center; width: 26px; height: 26px; padding: 0; color: #C9C3E0; }
    button.icon-btn:hover { border-color: #8B5CF6; color: #fff; }
    button.icon-btn svg { width: 14px; height: 14px; }
    .pick .src { font-size: 11px; color: #9A93B8; }
    .pick .src.store { color: #8cc4ff; }
    /* A squad SBC's cards on a pitch, in the formation's lines; each line centred. */
    .pitch { display: grid; gap: 14px; padding: 14px 10px; border: 1px solid #1f3a2a; border-radius: 12px; background: #10201a; }
    .pitch-row { display: flex; justify-content: center; gap: 8px; }
    .pitch-row > .slot { flex: 0 1 calc((100% - 32px) / 5); max-width: 140px; min-width: 0; }
    .slot.locked .card { opacity: .45; }
    .slot.dim { opacity: .3; }
    .rule-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rule-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid #2A2445; border-radius: 999px; background: #15112A; font-size: 13px; color: #C9C3E0; }
    button.rule-chip:hover { border-color: #8B5CF6; }
    button.rule-chip[aria-pressed=true] { border-color: #C6FF3D; color: #fff; }
    .rule-chip .ri { font-weight: 700; }
    .rule-chip.ok .ri { color: #6fd29a; } .rule-chip.bad .ri { color: #f08a7a; } .rule-chip.unknown .ri { color: #9A93B8; }
    /* A card's chemistry as the game shows it: three diamonds on a round badge, lit for each point. */
    .chem-pts { position: relative; flex: none; width: 20px; height: 20px; border-radius: 50%; background: #1d272f; border: 1px solid #333d47; }
    .chem-pts i { position: absolute; font: normal 400 7px/1 UltimateTeam-Icons, sans-serif; color: #fff; opacity: .3; }
    .chem-pts i::before { content: '\\e031'; }
    .chem-pts i.on { opacity: 1; }
    .chem-pts i:nth-child(1) { left: 3px; bottom: 4px; }
    .chem-pts i:nth-child(2) { left: 50%; top: 3px; transform: translateX(-50%); }
    .chem-pts i:nth-child(3) { right: 3px; bottom: 4px; }
    button.small { padding: 4px 10px; font-size: 13px; white-space: nowrap; }
    .note { font-size: 13px; color: #9A93B8; }
    .error { color: #f08a7a; }
    .tabs { position: relative; display: flex; gap: 4px; padding: 10px 16px 0; border-bottom: 1px solid #2A2445; }
    /* The selected tab's underline, one bar that slides from tab to tab. */
    .tabs .ink { position: absolute; left: 0; bottom: -1px; width: 1px; height: 2px; background: #C6FF3D; transform-origin: left; pointer-events: none; }
    .tabs button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; color: #9A93B8; padding: 8px 10px; font-weight: 600; }
    .tabs button[aria-selected="true"] { color: #fff; }
    /* Categories, then a category's sets, as cards: one column at the panel's usual width, one more each
       time it is dragged about 370px wider, never more than four (each column is at least a quarter of the
       row), and every card in a row the same height. */
    .sets { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(360px, calc((100% - 24px) / 4)), 1fr)); grid-auto-rows: 1fr; gap: 8px; }
    /* A category card: logos, tokens and set count; sets per grade; name. */
    .cat { display: grid; gap: 14px; align-content: space-between; min-width: 0; text-align: left; padding: 14px 16px; border: 1px solid #2A2445; border-radius: 10px; background: #1B1733; }
    .cat:hover, .cat:focus-visible { border-color: #8B5CF6; outline: none; }
    .cat-top { display: flex; align-items: center; gap: 8px; }
    .cat .logos { display: flex; align-items: center; gap: 10px; margin-inline-end: auto; min-width: 0; }
    .cat .logos img { height: 36px; max-width: 48px; object-fit: contain; }
    .cat .logos .letter { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #2A2445; color: #C9C3E0; font-weight: 700; }
    .cat .tokens { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cat .tokens img { width: 16px; height: 16px; }
    .cat .tokens strong { color: #E8C45A; }
    .cat .chip { font-size: 12px; padding: 3px 8px; border: 1px solid #352E55; border-radius: 6px; background: #120F24; white-space: nowrap; }
    .cat .grades { display: grid; grid-template-columns: repeat(5, 1fr); justify-items: center; }
    .grade { display: grid; justify-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
    .grade .dia, .step .dia, .aimg .dia { position: relative; z-index: 0; width: 26px; height: 26px; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
    .grade .dia::before, .step .dia::before, .aimg .dia::before { content: ''; position: absolute; inset: 4px; transform: rotate(45deg); border: 1.5px solid currentColor; border-radius: 3px; background: #120F24; z-index: -1; }
    .grade .n { font-size: 12px; color: #C9C3E0; }
    .grade.none { opacity: .35; }
    .cat-foot { display: flex; align-items: end; justify-content: space-between; gap: 8px; }
    .cat-name { display: block; font-weight: 700; font-size: 16px; }
    .cat-sub { display: block; font-size: 13px; color: #9A93B8; }
    .cat .go { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 50%; border: 1px solid #352E55; color: #9A93B8; font-size: 13px; }
    .cat:hover .go { border-color: #8B5CF6; color: #fff; }
    .set { display: grid; border: 1px solid #2A2445; border-radius: 8px; background: #1B1733; min-width: 0; }
    button.set-head:hover { background: #221D3D; border-radius: 8px; }
    .set-head { align-content: start; }
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
    .summary .coin { width: 18px; height: 18px; vertical-align: -3px; margin-inline-end: 5px; }
    .set-head .name { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
    .set-head .count { font-weight: 700; font-variant-numeric: tabular-nums; }
    .set-head .meta, .set-head .bar { grid-column: 2 / -1; }
    .bar { height: 4px; border-radius: 2px; background: #2A2445; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: #C6FF3D; }
    h3 { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: #C9C3E0; }
    /* One set: its grade and ladder, its cards, its bonus tags. */
    .set-page { display: grid; gap: 18px; }
    .set-page h3 { margin: 0 0 10px; text-transform: uppercase; letter-spacing: .06em; }
    .grade-panel { gap: 14px; padding: 16px; border: 1px solid #2A2445; border-radius: 12px; background: #1B1733; }
    .grade-top { display: flex; align-items: center; gap: 16px; }
    .grade.big .dia { width: 60px; height: 60px; font-size: 22px; }
    .grade.big .dia::before { inset: 9px; border-width: 2px; border-radius: 5px; background: #221D3D; }
    .grade-text { display: grid; gap: 2px; min-width: 0; font-size: 13px; }
    .grade-text .score { display: flex; align-items: center; gap: 6px; }
    .grade-text .score strong { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .grade-text .score .score-icon { width: 18px; height: 18px; }
    .pick-score strong { display: inline-flex; align-items: center; gap: 5px; }
    .pick-score .score-icon { width: 13px; height: 13px; }
    .to-next { display: grid; gap: 6px; }
    .to-next .bar > span { background: #E8C45A; }
    .ladder { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .ladder .step { display: grid; justify-items: center; gap: 2px; padding: 6px 2px; border-radius: 8px; font-variant-numeric: tabular-nums; }
    .ladder .step.current { background: #221D3D; box-shadow: inset 0 -2px 0 #C6FF3D; }
    .ladder .n { font-size: 12px; font-weight: 700; color: inherit; }
    .ladder .gives { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #9A93B8; }
    .ladder .gives img { width: 13px; height: 13px; }
    .step.none { opacity: .45; }
    .g-D .dia, .g-C .dia { color: #C9C3E0; } .g-B .dia, .g-A .dia { color: #E8C45A; } .g-S .dia { color: #A78BFA; }
    /* Cards drawn like the game's: five per row, growing with the panel, and one more per row each
       time a card would pass 160px wide. Their text scales with the card (cqw: % of its width). */
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(84px, min(160px, calc((100% - 32px) / 5))), 1fr)); gap: 12px 8px; }
    .slot { display: grid; justify-items: center; align-content: start; gap: 4px; min-width: 0; }
    .card { position: relative; width: 100%; max-width: 160px; aspect-ratio: 576 / 800; display: block; container-type: inline-size; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.85); }
    .card.blank { clip-path: polygon(50% 0, 63% 3.5%, 100% 5%, 100% 90%, 50% 100%, 0 90%, 0 5%, 37% 3.5%); background: #221D3D; }
    .card .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
    /* The face stands on the card's divider line, 64% of the way down, above the name. */
    .card .face { position: absolute; left: 28%; bottom: 36.3%; width: 66%; }
    .card .rt { position: absolute; left: 17%; top: 21%; font-size: 16.7cqw; font-weight: 800; line-height: 1; }
    .card .ps { position: absolute; left: 17%; top: 33%; font-size: 9.5cqw; font-weight: 700; }
    .card .nm { position: absolute; left: 8%; right: 8%; top: 66%; text-align: center; font-size: 11.9cqw; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card .lbl { position: absolute; inset: 22% 10%; display: grid; place-items: center; text-align: center; font-size: min(11.9cqw, 13px); font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
    /* Common and rare cards are drawn narrower than special ones (10% to 91% of the image across), with
       dark text; their rating and position sit nearer the edge to clear the face. */
    .card.plain { color: #2B2210; text-shadow: none; }
    .card.plain .rt, .card.plain .ps { left: 13%; }
    .card.plain .nm { left: 14%; right: 14%; }
    /* Flag, league and club, in a row under the name as on the game's cards. */
    .card .bdg { position: absolute; left: 14%; right: 14%; top: 79%; display: flex; justify-content: center; align-items: center; gap: 5cqw; }
    .card .bdg img { height: 10cqw; max-width: 17cqw; object-fit: contain; }
    .card.missing .bg, .card.missing .face { opacity: .3; filter: grayscale(1); }
    .card.missing .rt, .card.missing .nm { opacity: .6; }
    .slot .cap { font-size: 11px; white-space: nowrap; }
    .slot .acts { display: flex; gap: 8px; }
    /* Holographic cards: EA's sweep plays across the card, 27 frames in a row; its still layer stands in when motion is off. */
    .card .holo, .card .holo-still { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .card .holo { background-repeat: no-repeat; background-size: 2700% 100%; animation: futfox-holo 2.2s steps(27, jump-none) infinite; }
    .card .holo-still { display: none; }
    .card .holo-still.only { display: block; }
    /* No EA art: a soft shine, cut to the card art's own outline. */
    .card .holo.css {
      -webkit-mask: var(--card-art) 0 0 / 100% 100% no-repeat; mask: var(--card-art) 0 0 / 100% 100% no-repeat;
      background: linear-gradient(115deg, transparent 38%, rgba(214,200,255,.35) 48%, rgba(198,255,61,.15) 53%, transparent 62%) 0 0 / 300% 100% no-repeat;
      animation: futfox-shine 3s linear infinite;
    }
    @keyframes futfox-holo { from { background-position: 0% 0; } to { background-position: 100% 0; } }
    @keyframes futfox-shine { from { background-position: 100% 0; } to { background-position: 0% 0; } }
    /* Busy: a spinning ring beside the text, and faded cards pulsing where the result will go.
       Only rotation and opacity move, so they keep going while a squad search blocks the page. */
    .spin { display: inline-block; flex: none; width: 12px; height: 12px; margin-inline-end: 8px; vertical-align: -2px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: futfox-spin .7s linear infinite; }
    .muted .spin, p .spin { color: #C6FF3D; }
    .slot.skel .card, .skel-box, .cat.skel { animation: futfox-pulse 1.2s ease-in-out infinite; }
    .skel-box { display: block; height: 10px; border-radius: 5px; background: #2A2445; }
    .cat.skel { min-height: 150px; }
    .pick-skel { display: flex; align-items: center; gap: 12px; padding: 6px 12px 6px 8px; border: 1px solid #2A2445; border-radius: 8px; }
    .skel-text { display: grid; gap: 8px; flex: 1; }
    /* Loading the club: one bordered line with the spinner, and a counter that climbs page by page. */
    .club-loading { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #352E55; border-radius: 6px; color: #C9C3E0; }
    .club-loading .spin { margin-inline-end: 0; color: #C6FF3D; }
    .club-loading .club-count { margin-inline-start: auto; color: #9A93B8; font-variant-numeric: tabular-nums; }
    .club-pointer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px dashed #352E55; border-radius: 8px; font-size: 13px; color: #C9C3E0; }
    button.load { transition: transform .1s; }
    button.load:active { transform: scale(.97); }
    @keyframes futfox-spin { to { transform: rotate(360deg); } }
    @keyframes futfox-pulse { 50% { opacity: .35; } }
    @media (prefers-reduced-motion: reduce) {
      .spin { animation-duration: 2s; }
      .slot.skel .card, .skel-box, .cat.skel { animation: none; opacity: .6; }
      .card .holo { animation: none; }
      .card .holo.has-still { display: none; }
      .card .holo-still { display: block; }
    }
    .card.small { width: 44px; flex: none; }
    .card.small .rt, .card.small .ps, .card.small .nm { display: none; }
    /* Pick player: the cards that fit a slot, one row each. */
    .picker { display: grid; gap: 12px; }
    .picker-head { display: grid; gap: 2px; }
    .picker-head .name { font-weight: 700; font-size: 16px; }
    .picker form input { flex: 1; min-width: 0; background: #1B1733; color: inherit; border: 1px solid #352E55; border-radius: 6px; padding: 7px 8px; font: inherit; }
    .picks { display: grid; gap: 6px; }
    button.pick { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 6px 12px 6px 8px; border-color: #2A2445; }
    button.pick:hover, button.pick:focus-visible { border-color: #8B5CF6; }
    button.pick.chosen { border-color: #C6FF3D; }
    .pick-text { flex: 1; min-width: 0; }
    .pick-score { display: grid; justify-items: end; font-variant-numeric: tabular-nums; font-size: 12px; }
    .pick-score strong { font-size: 15px; }
    button.link { border: 0; background: none; padding: 0; font-size: 11px; color: #C4B1FF; text-decoration: underline; text-underline-offset: 2px; }
    /* Suggest: pick a grade (its diamond), and the cards that would reach it fill the empty slots. */
    .suggest { display: grid; gap: 8px; margin-bottom: 12px; }
    .suggest .aim { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .suggest .aim .label { font-size: 13px; color: #C9C3E0; margin-inline-end: 4px; }
    button.aimg { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; background: none; border-color: #2A2445; border-radius: 8px; }
    button.aimg:hover, button.aimg:focus-visible { border-color: #8B5CF6; }
    button.aimg[aria-pressed="true"] { border-color: #C6FF3D; background: #221D3D; }
    .suggest .sum { font-size: 13px; color: #C9C3E0; font-variant-numeric: tabular-nums; }
    .suggest .sum strong.reached { color: #C6FF3D; }
    .slot.suggested .card { outline: 1.5px dashed #C6FF3D; outline-offset: 3px; border-radius: 4px; }
    .slot .cap.sug { color: #C6FF3D; font-weight: 700; direction: ltr; unicode-bidi: isolate; }
    .slot .src { font-size: 10px; color: #C4B1FF; white-space: nowrap; }
    .slot .src.club { color: #6FD29A; }
    button.link:hover { color: #fff; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .tags { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; }
    .tagc { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #2A2445; border-radius: 10px; background: #1B1733; }
    .tagc.near { border-style: dashed; border-color: #352E55; background: none; }
    .tagc.near strong { color: #C9C3E0; }
    .tagc strong { display: block; font-size: 14px; }
    .tagc .meta { font-size: 12px; }
    .tag-icon { width: 26px; height: 26px; flex: none; }
    label.file { position: relative; display: inline-block; border-radius: 6px; border: 1px solid #352E55; background: #1B1733; padding: 7px 12px; cursor: pointer; }
    label.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
    label.file:focus-within { outline: 2px solid #8B5CF6; }
    footer { padding: 10px 16px; border-top: 1px solid #2A2445; font-size: 13px; color: #9A93B8; }
    /* The challenge picker: a button that opens a searchable list grouped by SBC set. */
    .menu { position: relative; }
    .menu-btn { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 10px; }
    .menu-btn:hover, .menu-btn[aria-expanded=true] { border-color: #8B5CF6; }
    .menu-text { flex: 1; min-width: 0; display: grid; }
    .menu-set, .menu-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .menu-set { font-size: 12px; color: #9A93B8; }
    .menu-name { font-weight: 600; }
    .chev { flex: none; width: 10px; height: 10px; border: solid #9A93B8; border-width: 0 2px 2px 0; transform: translateY(-2px) rotate(45deg); transition: transform .15s; }
    .menu-btn[aria-expanded=true] .chev { transform: translateY(2px) rotate(-135deg); }
    .menu-pop { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 5; display: grid; gap: 6px; padding: 6px;
      background: #141029; border: 1px solid #352E55; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.5); }
    .menu-pop input { width: 100%; background: #1B1733; color: inherit; border: 1px solid #352E55; border-radius: 6px; padding: 7px 8px; font: inherit; }
    .menu-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; }
    .menu-group { padding: 8px 8px 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #6E6790; }
    .menu-opt { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; }
    .menu-opt.active { background: #231D40; }
    .menu-opt .menu-name { flex: 1; min-width: 0; font-weight: 500; }
    .menu-opt[aria-selected=true] .menu-name { color: #C6FF3D; font-weight: 600; }
    .menu-empty { padding: 10px 8px; color: #9A93B8; }
    .chip { flex: none; font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #2A2445; color: #C9C3E0; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .chip.done { background: #1d3327; color: #6fd29a; }
    .chip.pts { display: inline-flex; align-items: center; gap: 3px; background: #22203a; color: #C6FF3D; }
    .chip .pts-icon { width: 11px; height: 11px; }
    .summary .pts-icon, .rules .pts-icon { width: 14px; height: 14px; margin-inline-end: 4px; vertical-align: -2px; }
    .chem-ico { font: normal 400 13px/1 UltimateTeam-Icons, sans-serif; margin-inline-end: 4px; color: #C6FF3D; }
    .chem-ico::before { content: '\\e030'; }
    /* Number boxes with their own - and + buttons instead of the browser's spinner. */
    .stepper { display: inline-flex; align-items: stretch; border: 1px solid #352E55; border-radius: 6px; background: #1B1733; }
    .stepper:focus-within { border-color: #8B5CF6; }
    .stepper button { border: 0; background: none; padding: 0 10px; color: #9A93B8; font-size: 16px; line-height: 1; }
    .stepper button:not(:disabled):hover { color: #fff; }
    .stepper input { width: 52px; border: 0; background: none; color: inherit; font: inherit; text-align: center; padding: 6px 0; font-variant-numeric: tabular-nums; }
    .stepper input:focus-visible { outline: none; }
    .stepper input.wide { width: 76px; }
    .stepper input::placeholder { color: #6E6790; }
    .segmented { display: inline-flex; border: 1px solid #352E55; border-radius: 6px; overflow: hidden; }
    .segmented button { border: 0; border-radius: 0; padding: 6px 12px; background: #1B1733; color: #9A93B8; }
    .segmented button + button { border-left: 1px solid #352E55; }
    /* On the Club tab the language switch is only as wide as its three choices. */
    section > .segmented { justify-self: start; }
    .segmented button[aria-pressed=true] { background: #2A2445; color: #fff; font-weight: 600; }
    /* SBC options: small cards, each a 2-column grid of equal fields and a list of switches. */
    .opt-card { display: grid; gap: 10px; padding: 12px; border: 1px solid #2A2445; border-radius: 10px; background: #15112A; }
    .opt-card h3 { margin: 0; font-size: 12px; font-weight: 600; color: #9A93B8; }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 4px; min-width: 0; }
    .field > span { font-size: 13px; color: #9A93B8; }
    .field .stepper { display: flex; }
    .field .stepper input, .field .stepper input.wide { flex: 1; width: 0; min-width: 0; }
    .segmented.full { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* On/off options: the text on the left, a switch on the right, one row each. */
    .switches { display: grid; }
    .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #2A2445; cursor: pointer; }
    .switch-row:first-child { border-top: 0; padding-top: 2px; }
    input.switch { appearance: none; -webkit-appearance: none; flex: none; position: relative; width: 34px; height: 20px; margin: 0; border-radius: 999px; background: #352E55; cursor: pointer; transition: background .15s; }
    input.switch::before { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #C9C3E0; transition: transform .15s, background .15s; }
    input.switch:checked { background: #C6FF3D; }
    input.switch:checked::before { transform: translateX(14px); background: #0B0918; }
    /* Arabic: right to left. Cards and the pitch keep the game's own left and right; letter spacing
       would break the joined Arabic letters. */
    [dir=rtl] .card, [dir=rtl] .pitch { direction: ltr; }
    [dir=rtl] h2, [dir=rtl] h3, [dir=rtl] .tag, [dir=rtl] .menu-group { letter-spacing: 0; }
    [dir=rtl] .dock-progress i, [dir=rtl] .dock-row.placed .name::after { transform-origin: right; }
    [dir=rtl] .cat, [dir=rtl] .set-head, [dir=rtl] .menu-btn, [dir=rtl] button.pick { text-align: right; }
    [dir=rtl] input.switch::before { left: auto; right: 3px; }
    [dir=rtl] input.switch:checked::before { transform: translateX(-14px); }
    [dir=rtl] .segmented button + button { border-left: 0; border-right: 1px solid #352E55; }
  `;

  function loadSettings() {
    const defaults = {
      keepActiveSquad: true, protectFrom: 87, allowMarket: true, untradeablesOnly: false, view: 'sbc', lang: 'auto',
      // Streamlined SBCs: the rating range, the most cards a time (empty: the game's limit), the
      // points to reach now (empty: all that's left), where cards come from and what to favour.
      slMinRating: 45, slMaxRating: 86, slMaxCards: null, slPoints: null,
      slClub: true, slStorage: true, slKeepSpecial: false, slPrefer: 'cheapest',
      // Both kinds: SBC storage cards are used before club cards.
      storageFirst: true,
    };
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

  // Two arrows chasing each other: swap this card for another.
  // A formation's slot indexes in the lines the game draws them, attack first, each line from
  // left to right. Slot names say the side: LCB is the left centre-back, RS the right striker.
  const LINES = [[20, 27], [17, 19], [12, 16], [9, 11], [1, 8], [0, 0]];
  const WIDE = new Set(['LWB', 'LB', 'LM', 'LW', 'LF', 'RWB', 'RB', 'RM', 'RW', 'RF']);
  function pitchRows(slots) {
    const across = (name) => {
      const side = /^L/.test(name) ? -1 : /^R/.test(name) ? 1 : 0;
      return 2 + side * (WIDE.has(name) ? 2 : 1);
    };
    return LINES
      .map(([lo, hi]) => slots
        .map((slot, i) => ({ i, x: across(slot.name || '') }))
        .filter(({ i }) => slots[i].typeId >= lo && slots[i].typeId <= hi)
        .sort((a, b) => a.x - b.x)
        .map(({ i }) => i))
      .filter((row) => row.length);
  }

  function spinner() {
    return el('span', { class: 'spin', 'aria-hidden': 'true' });
  }

  // A faded bar that pulses, standing in for a line of text still loading; n staggers the pulse.
  function skelBar(width, n = 0) {
    return el('span', { class: 'skel-box', style: `width: ${width}; animation-delay: ${(n % 5) * 120}ms` });
  }

  // A chevron pointing up (to open the list above) or down (to fold it).
  function chevronIcon(up) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    for (const [k, v] of Object.entries({ d: up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(k, v);
    svg.append(path);
    return svg;
  }

  function copyIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of [['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }], ['path', { d: 'M5 15V6a2 2 0 0 1 2-2h8' }]]) {
      const node = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries({ ...attrs, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) node.setAttribute(k, v);
      svg.append(node);
    }
    return svg;
  }

  function swapIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M20 11a8 8 0 0 0-14.3-4.9L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.3 4.9L20 16', 'M20 20v-4h-4']) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.append(path);
    }
    return svg;
  }

  // A number box with - and + buttons. Empty is allowed when `empty` names what it means
  // (shown as the placeholder); onChange gets a number, or null for empty.
  function stepper({ value, min, max, step = 1, label, empty, wide, onChange }) {
    const clamp = (n) => Math.min(max, Math.max(min, n));
    const input = el('input', { type: 'text', inputmode: 'numeric', 'aria-label': label, class: wide ? 'wide' : null, value: value == null ? '' : String(value), placeholder: empty || '' });
    const set = (n) => {
      const next = n == null ? null : clamp(Math.round(n));
      input.value = next == null ? '' : String(next);
      onChange(next);
    };
    const current = () => (input.value.trim() === '' ? null : Number(input.value.replace(/[^\d]/g, '')));
    input.addEventListener('change', () => {
      const n = current();
      set(n == null || Number.isNaN(n) ? (empty ? null : value) : n);
    });
    input.addEventListener('keydown', (e) => {
      const dir = { ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      set((current() ?? (dir > 0 ? min - step : max + step)) + dir * step);
    });
    const bump = (dir) => set((current() ?? (dir > 0 ? min - step : max + step)) + dir * step);
    return el('span', { class: 'stepper' }, [
      el('button', { type: 'button', tabindex: '-1', 'aria-label': t('Less {label}', { label }), text: '−', onclick: () => bump(-1) }),
      input,
      el('button', { type: 'button', tabindex: '-1', 'aria-label': t('More {label}', { label }), text: '+', onclick: () => bump(1) }),
    ]);
  }

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

  // One line icon per bonus tag, on a 24px grid, drawn with DOM calls like the fox.
  const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const roundRect = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}`
    + `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  const MEDAL = [circle(12, 14.5, 5.5), 'M8.5 3.5l2.2 5.6', 'M15.5 3.5l-2.2 5.6'];
  const TAG_ICONS = {
    'Same Nation': ['M6 21V4', 'M6 4h11l-2 3.5L17 11H6'],
    'Different Nation': ['M5 21V4h9l-1.5 3L14 10H5', 'M12 21v-8h7l-1.2 2.5L19 18h-7'],
    'Same Club': ['M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z'],
    'Different Club': ['M9 3.5l5.5 2.2v4c0 3.4-2.3 6-5.5 7-3.2-1-5.5-3.6-5.5-7v-4z', 'M17 9l3.5 1.4v3.3c0 3-2 5.4-5 6.3-1.3-.4-2.4-1.1-3.2-2'],
    'Same League': ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5.5a2.5 2.5 0 0 0 2.7 3.9', 'M16 6h2.5a2.5 2.5 0 0 1-2.7 3.9', 'M12 13v3.5', 'M10 16.5h4v4h-4z'],
    'Different League': ['M12 3l9 5-9 5-9-5z', 'M3 12.5l9 5 9-5', 'M3 17l9 5 9-5'],
    Bronze: MEDAL,
    Silver: MEDAL,
    Golden: MEDAL,
    Holographic: ['M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z', 'M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'],
    Iconic: [circle(12, 12, 9.5), 'M12 6.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L12 15.2 8.6 17l.7-3.8-2.8-2.7 3.8-.5z'],
    Heroic: ['M13 2.5L5 13.5h6l-1 8 8-11h-6z'],
    TOTW: [roundRect(3.5, 5, 17, 15, 2.5), 'M3.5 9.5h17M8 3v4M16 3v4', 'M12 11.6l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z'],
    'First Owner': [circle(8, 15.5, 4.5), 'M11.3 12.2L20 3.5', 'M17 6.5l2.5 2.5', 'M14.5 9l2 2'],
    'Hands Only': ['M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 14.5V13a2 2 0 0 1 2-2'],
    'Multiples!': [roundRect(4, 7, 11, 14, 2), 'M9 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3'],
    Ambidextrous: ['M8 3.5c1.7 0 2.5 2 2.5 4.5S9.5 13 8 13s-2.5-2.5-2.5-5S6.3 3.5 8 3.5z', 'M6.3 15.5h3.4v2.2a1.7 1.7 0 0 1-3.4 0z',
      'M16 7c1.7 0 2.5 2 2.5 4.5S17.5 16.5 16 16.5s-2.5-2.5-2.5-5S14.3 7 16 7z', 'M14.3 19h3.4v.5a1.7 1.7 0 0 1-3.4 0z'],
    Skilled: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M20 4v4.5h-4.5', circle(12, 12, 1.5)],
    'Defensive Wall': [roundRect(3, 5, 18, 14, 1), 'M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19'],
    'Midfield Control': [circle(12, 12, 8.5), circle(12, 12, 3), 'M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4'],
    'All out Attack': ['M3 19V7h18v12', 'M7 16l6-5.5', 'M9.5 10.5H13V14'],
  };
  // Lime when the tag is active, grey when not; the medals keep their metal.
  const METAL = { Bronze: '#C8834A', Silver: '#D5DAE3', Golden: '#E8C45A' };

  function clubIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', TAG_ICONS['Same Club'][0]);
    svg.append(path);
    return svg;
  }

  function tagIcon(name, active) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const attrs = { viewBox: '0 0 24 24', class: 'tag-icon', fill: 'none', stroke: active ? METAL[name] || '#C6FF3D' : '#6E6790',
      'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
    for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
    for (const d of TAG_ICONS[name] || [circle(12, 12, 8)]) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
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

    const grip = el('div', { class: 'grip', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': t('Resize FutFox'), tabindex: '0', title: t('Drag to resize') });
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

  const EASE = 'cubic-bezier(.2, .8, .2, 1)';
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Container transform: the panel's visible shape eases from `box` (where the button or card is,
  // with that corner radius) out to its full size, or back into the box when out is set. Its content
  // fades in once the shape has opened, and out before it closes, so nothing is scaled or blurred.
  function morph(node, box, radius, out) {
    const own = node.getBoundingClientRect();
    const w = Math.min(box.width, own.width);
    const h = Math.min(box.height, own.height);
    // Where the box would sit inside the panel; a box outside it is reached by moving the panel there.
    const x = Math.min(Math.max(box.left, own.left), own.right - w);
    const y = Math.min(Math.max(box.top, own.top), own.bottom - h);
    const round = Math.min(radius, h / 2);
    const small = {
      clipPath: `inset(${y - own.top}px ${own.right - x - w}px ${own.bottom - y - h}px ${x - own.left}px round ${round}px)`,
      transform: `translate(${box.left - x}px, ${box.top - y}px)`,
    };
    const full = {
      clipPath: `inset(0px 0px 0px 0px round ${parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0}px)`,
      transform: 'translate(0px, 0px)',
    };
    for (const child of node.children) {
      child.animate(out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
        out ? { duration: 110, fill: 'forwards' } : { duration: 200, delay: 120, fill: 'backwards' });
    }
    return node.animate(out ? [full, small] : [small, full],
      { duration: out ? 280 : 360, easing: 'cubic-bezier(.3, 0, .1, 1)', fill: out ? 'forwards' : 'none' });
  }

  // Animates node's height from what it was before change() ran to what it is after.
  function resizeHeight(node, change) {
    const before = node.offsetHeight;
    change();
    const after = node.offsetHeight;
    if (before && after && before !== after && !reducedMotion()) {
      node.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 260, easing: EASE });
    }
  }

  // Shown, and not on its way out.
  function isShown(node) {
    return !node.hidden && !node.classList.contains('leaving');
  }

  // Drag and drop for the button, the placing card and the panel: grab(target) says which part of
  // the element picks it up. Where it was dropped is kept in settings.places as the window corner it
  // is nearest and its distance from that corner, so it lands in the same corner on any screen, and
  // is pulled back on screen when the window is too small for it. A double-click on the grabbed part
  // puts it back. An element dropped near the bottom keeps its bottom edge there and grows upwards.
  function movable(node, key, settings, grab) {
    const places = settings.places || (settings.places = {});
    // A spot kept as plain pixels from the top left (before corners) belongs to another screen.
    if (places[key] && !places[key].corner) delete places[key];
    // Heights used to be kept in pixels, often a smaller window's height; it is a share of the window now.
    if (places[key] && places[key].h) delete places[key].h;
    let start = null;
    let dragged = false;
    // Whether the last press was on the part that picks it up; the element holds the pointer from
    // then on, so later events no longer say which part was pressed.
    let grabbed = false;

    // A hidden element measures 0 wide, which would let it be pulled back only as far as the very
    // edge, off screen; it is placed when it shows instead.
    function place() {
      if (node.hidden) return;
      const at = places[key];
      node.classList.toggle('moved', Boolean(at));
      if (!at) {
        for (const prop of ['left', 'top', 'right', 'bottom', 'width', 'height']) node.style[prop] = '';
        return;
      }
      // The width in pixels, the height as a share of the window (full height when none is kept), so
      // it fits any screen.
      node.style.width = at.w ? `${Math.min(at.w, window.innerWidth)}px` : '';
      node.style.height = at.hr ? `${Math.round(Math.min(at.hr, 1) * window.innerHeight)}px` : '';
      // Its layout size, not the box on screen, which is scaled while it animates in.
      const r = { width: node.offsetWidth, height: node.offsetHeight };
      const left = at.corner[1] === 'l' ? at.dx : window.innerWidth - at.dx - r.width;
      const top = at.corner[0] === 't' ? at.dy : window.innerHeight - at.dy - r.height;
      const x = Math.max(0, Math.min(left, window.innerWidth - r.width));
      const y = Math.max(0, Math.min(top, window.innerHeight - r.height));
      Object.assign(node.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, right: 'auto', bottom: 'auto' });
    }

    function spot(left, top) {
      const right = window.innerWidth - left - node.offsetWidth;
      const bottom = window.innerHeight - top - node.offsetHeight;
      return {
        corner: (top <= bottom ? 't' : 'b') + (left <= right ? 'l' : 'r'),
        dx: Math.max(0, Math.round(Math.min(left, right))),
        dy: Math.max(0, Math.round(Math.min(top, bottom))),
      };
    }

    node.addEventListener('pointerdown', (e) => {
      grabbed = e.button === 0 && grab(e.target);
      if (!grabbed) return;
      const r = node.getBoundingClientRect();
      start = { id: e.pointerId, px: e.clientX, py: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top };
      dragged = false;
      // Follow the pointer even where it leaves the element on a quick drag.
      node.setPointerCapture(e.pointerId);
    });
    node.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!dragged) {
        if (Math.hypot(e.clientX - start.px, e.clientY - start.py) < 5) return;
        dragged = true;
        node.classList.add('dragging');
        if (!places[key]) places[key] = {};
      }
      places[key] = { ...places[key], ...spot(e.clientX - start.dx, e.clientY - start.dy) };
      place();
    });
    const drop = (e) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      if (!dragged) return;
      node.classList.remove('dragging');
      const r = node.getBoundingClientRect();
      places[key] = { ...places[key], ...spot(Math.round(r.left), Math.round(r.top)) };
      saveSettings(settings);
    };
    node.addEventListener('pointerup', drop);
    node.addEventListener('pointercancel', drop);
    // A drag is not a click: the button must not open or close the panel after one.
    node.addEventListener('click', (e) => {
      if (!dragged) return;
      dragged = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
    node.addEventListener('dblclick', () => {
      if (!grabbed || !places[key]) return;
      delete places[key];
      saveSettings(settings);
      place();
    });
    window.addEventListener('resize', place);
    place();

    // Keeps the size the panel is resized to from its corner. A panel as tall as the window keeps no
    // height, so it fills any window; one squeezed by a narrower window keeps the width chosen before.
    function keepSize(w, h) {
      const at = places[key];
      if (!at || !w || !h) return;
      const squeezed = w >= window.innerWidth - 1 && at.w > w;
      const hr = Math.round((h / window.innerHeight) * 1000) / 1000;
      const { hr: _, ...rest } = at;
      places[key] = { ...rest, w: squeezed ? at.w : Math.round(w), ...(hr < 0.98 ? { hr } : {}) };
      saveSettings(settings);
    }
    return { place, keepSize };
  }

  function create() {
    const host = el('div', { id: 'futfox-root' });
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(el('style', { text: CSS }));
    document.body.append(host);

    const settings = loadSettings();
    const state = { challenges: [], selectedId: null, result: null, keptOut: new Map(), loading: false, error: null, solving: false, sets: { data: null, loading: false, error: null }, category: null, openSet: null, scrolls: {}, scrollTo: null };

    const toggle = el('button', { class: 'toggle', type: 'button', title: t('Drag to move. Double-click to put it back.') }, [foxIcon(), 'FutFox']);
    const dock = el('aside', { class: 'dock', hidden: true, 'aria-label': t('Place the squad') });
    const panel = el('aside', { class: 'panel', hidden: true, 'aria-label': 'FutFox' });
    shadow.append(toggle, dock, panel);
    const grip = resizeGrip(panel, settings);

    const free = (t) => !t.closest('button, input, select, a, .grip');
    const toggleSpot = movable(toggle, 'toggle', settings, () => true);
    const dockSpot = movable(dock, 'dock', settings, free);
    const panelSpot = movable(panel, 'panel', settings, (t) => Boolean(t.closest('header')) && free(t));
    let resized = null;
    new ResizeObserver(() => {
      if (!open || !panel.classList.contains('moved')) return;
      clearTimeout(resized);
      resized = setTimeout(() => {
        const r = panel.getBoundingClientRect();
        panelSpot.keepSize(r.width, r.height);
      }, 300);
    }).observe(panel);

    let open = false;

    // The game's language (Arabic when the Web App is in Arabic) unless one is chosen in Options.
    function applyLang() {
      const chosen = settings.lang === 'en' || settings.lang === 'ar' ? settings.lang : H.fut.language() === 'ar' ? 'ar' : 'en';
      H.i18n.setLang(chosen);
      for (const node of [panel, dock]) {
        node.setAttribute('dir', H.i18n.dir());
        node.setAttribute('lang', chosen);
      }
      toggle.title = t('Drag to move. Double-click to put it back.');
      panel.setAttribute('aria-label', 'FutFox');
      dock.setAttribute('aria-label', t('Place the squad'));
    }

    function openPanel(view) {
      open = true;
      const next = view || (!state.clubLoadedAt ? 'club' : H.fut.shownChallengeId() != null ? 'sbc' : settings.view);
      if (next !== settings.view) setSetting('view', next);
      if (next === 'gallery' && !state.sets.data && !state.sets.loading) loadSets(false);
      // Closing the placing list hides it until FutFox is opened again; closing the panel then
      // folds back into the list while the squad's SBC is open.
      state.dockClosed = false;
      refreshChallenges();
      sync();
    }

    function hidePanel() {
      open = false;
      state.menu = null;
      sync();
    }

    // A press anywhere else in the panel closes the challenge list, without redrawing the panel so
    // the press still reaches what it was on.
    panel.addEventListener('pointerdown', (e) => {
      if (!state.menu) return;
      const box = panel.querySelector('.menu');
      if (box && e.composedPath().includes(box)) return;
      state.menu = null;
      const pop = box && box.querySelector('.menu-pop');
      if (pop) pop.remove();
      const button = box && box.querySelector('.menu-btn');
      if (button) button.setAttribute('aria-expanded', 'false');
    });

    toggle.addEventListener('click', () => openPanel());

    // A click anywhere in the game folds the panel away, so the game's own boxes on the right are free.
    document.addEventListener('pointerdown', (e) => {
      if (open && !e.composedPath().includes(host)) hidePanel();
    }, true);

    // The placing list shows instead of the FutFox button while the suggested squad's SBC is open,
    // or after "Place it in the game", until it is closed.
    function placingShown() {
      const res = state.result;
      if (!res || res.challengeId == null || state.dockClosed) return false;
      return state.placing || H.fut.openChallengeId() === res.challengeId;
    }

    // One of the three shows at a time: the panel while open, else the placing card or the FutFox
    // button. The panel opens out of the button or card and closes back into it; the button and the
    // card swap with a quick fade.
    function sync() {
      const want = open ? panel : placingShown() ? dock : toggle;
      const was = [panel, dock, toggle].find(isShown);
      if (want === was) return;
      const from = was ? was.getBoundingClientRect() : null;
      for (const node of [panel, dock, toggle]) if (node !== want && node !== was) node.hidden = true;
      if (was) was.classList.add('leaving');
      for (const node of [want, was]) if (node) node.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      want.classList.remove('leaving');
      want.hidden = false;
      if (want === panel) {
        panelSpot.place();
        placeInk();
      }
      if (want === dock) {
        dock.replaceChildren(...placingList());
        dockSpot.place();
      }
      if (want === toggle) toggleSpot.place();
      if (!was) return;
      const hide = () => {
        if (!was.classList.contains('leaving')) return;
        was.classList.remove('leaving');
        was.hidden = true;
      };
      if (reducedMotion()) return hide();
      const radius = (node) => parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
      const done = (anim, node) => anim.finished.then(() => {
        hide();
        node.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      }, () => {});
      if (want === panel) {
        // The panel lies over the button or card and opens out of its shape.
        hide();
        morph(panel, from, radius(was), false);
      } else if (was === panel) {
        // The panel closes into the button or card, which shows as it arrives.
        want.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: 170, fill: 'backwards' });
        done(morph(panel, want.getBoundingClientRect(), radius(want), true), panel);
      } else {
        want.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE });
        done(was.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }), was);
      }
    }

    // Draws the placing card again, its height easing to the new size.
    function renderDock() {
      if (!isShown(dock)) return sync();
      resizeHeight(dock, () => {
        dock.replaceChildren(...placingList());
        dockSpot.place();
      });
    }

    // The app changes screens without telling the page, so check now and then while the panel is folded.
    setInterval(() => { if (!open && state.result) sync(); }, 1000);

    function copyName(name, button) {
      const kids = [...button.childNodes];
      const done = () => { button.replaceChildren('✓'); setTimeout(() => button.replaceChildren(...kids), 1200); };
      navigator.clipboard.writeText(name).then(done, () => {});
    }

    // One player's line: placed tick, position, rating, name, and Copy (or Market for a card to buy).
    // One card to place: a small card, its name and rating, its position (or a Streamlined card's
    // points) and where the game's picker lists it, then Copy (or Market) and the tick.
    function placingRow(s, i, tick) {
      const p = s.player;
      const isBuy = p.source === 'market';
      const points = H.fut.sbcPointsImage && H.fut.sbcPointsImage();
      // A Streamlined SBC's card has no position: its points show there, with the game's points icon.
      const where = s.typeId != null ? H.fut.positionName(s.typeId)
        : el('span', { class: 'pts', title: t('Item Score') }, [points ? el('img', { class: 'pts-icon', src: points, alt: '' }) : null, coins(p.score)]);
      const name = isBuy ? t('Buy a {rating} {position}', { rating: p.rating, position: H.fut.positionName(s.typeId) }) : p.name;
      const placed = state.placed.has(i);
      return el('div', { class: `dock-row${placed ? ' placed' : ''}`, 'data-i': String(i) }, [
        isBuy ? miniCard({ small: true }) : miniCard({ rarityId: p.rarity, rating: p.rating, playerId: p.playerId, small: true }),
        el('span', { class: 'who' }, [
          el('span', { class: 'name', title: name }, isBuy ? [name] : [el('span', { class: 'r', text: String(p.rating) }), name]),
          // The game's picker has separate Club and SBC Storage tabs, so say which one to look in.
          el('span', { class: 'sub' }, isBuy ? [where, ` · ${t('Market')}`] : [where, ' · ', el('span', { class: p.storage ? 'store' : null, text: t(p.storage ? 'SBC storage' : 'Club') })]),
        ]),
        isBuy
          ? el('button', { type: 'button', text: t('Market'), onclick: () => H.fut.openMarketSearch(p.search) })
          : el('button', { class: 'icon-btn', type: 'button', title: t('Copy the name to search your club'), 'aria-label': t('Copy {name}', { name: p.name }), onclick: (e) => copyName(p.name, e.currentTarget) }, [copyIcon()]),
        el('button', { class: 'tick', type: 'button', role: 'checkbox', 'aria-checked': String(placed), 'aria-label': t('{name} placed', { name }), title: t(placed ? 'Placed' : 'Tick once it is in the game'), text: placed ? '✓' : '', onclick: () => tick(i) }),
      ]);
    }

    // Folded, it is one line with the next player to place, small enough to sit under the game's
    // right-hand column; unfolded, every player shows above that line.
    function placingList() {
      applyLang();
      const res = state.result;
      const rows = res.squad.map((s, i) => ({ s, i })).filter(({ s }) => s.player);
      const done = rows.filter(({ i }) => state.placed.has(i)).length;
      const next = rows.find(({ i }) => !state.placed.has(i));
      const share = (n) => (rows.length ? n / rows.length : 0);
      const tick = (i) => {
        const adding = !state.placed.has(i);
        if (adding) state.placed.add(i);
        else state.placed.delete(i);
        renderDock();
        if (!reducedMotion()) animateTick(i, adding, share(done), share(done + (adding ? 1 : -1)));
      };
      const progress = el('div', { class: 'dock-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(rows.length), 'aria-valuenow': String(done), 'aria-label': t('Cards placed') }, [
        el('i', { style: `transform: scaleX(${share(done)})` }),
      ]);
      const allDone = el('span', { class: 'done', text: t('All placed: check it and submit') });
      return [
        progress,
        state.dockOpen ? el('div', { class: 'dock-head' }, [el('strong', { text: t('Placing') }), ` ${t("{done} of {total} · tick each card once it's in the game", { done, total: rows.length })}`]) : null,
        state.dockOpen ? el('ul', { class: 'dock-list' }, rows.map(({ s, i }) => el('li', {}, [placingRow(s, i, tick)]))) : null,
        el('div', { class: 'dock-bar' }, [
          el('button', { class: 'fox-btn', type: 'button', title: t('Open FutFox'), 'aria-label': t('Open FutFox'), onclick: () => { state.showSquad = true; state.scrollTo = 0; openPanel('sbc'); } }, [foxIcon()]),
          !next ? allDone
            : state.dockOpen ? el('span', { class: 'count', text: t('{done} of {total} placed', { done, total: rows.length }) })
              : placingRow(next.s, next.i, tick),
          el('button', { class: 'icon-btn', type: 'button', 'aria-expanded': String(Boolean(state.dockOpen)), 'aria-label': t(state.dockOpen ? 'Hide the list' : 'Show every card'), title: t(state.dockOpen ? 'Hide the list' : 'Show every card'), onclick: () => { state.dockOpen = !state.dockOpen; renderDock(); } }, [chevronIcon(!state.dockOpen)]),
          el('button', { class: 'close', type: 'button', 'aria-label': t('Close the list'), title: t('Close the list'), text: '×', onclick: () => { state.placing = false; state.dockClosed = true; sync(); } }),
        ]),
      ].filter(Boolean);
    }

    // After a tick redraws the card: the round tick pops, the row fades and a line is drawn through
    // the name, the progress bar grows from `from` to `to`, and "All placed" rises in with the last
    // one. Unticking only eases the bar and the row back.
    function animateTick(i, adding, from, to) {
      const bar = dock.querySelector('.dock-progress i');
      if (bar) bar.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }], { duration: 360, easing: EASE });
      const row = dock.querySelector(`.dock-list .dock-row[data-i="${i}"]`);
      if (row) {
        const rest = [...row.children].filter((node) => !node.classList.contains('tick'));
        rest.forEach((node) => node.animate([{ opacity: adding ? 1 : 0.45 }, {}], { duration: 220, easing: 'ease-out' }));
      }
      if (!adding) return;
      const button = row && row.querySelector('button.tick');
      if (button) button.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1.18)', offset: 0.6 }, { transform: 'none' }], { duration: 320, easing: EASE });
      const name = row && row.querySelector('.name');
      if (name) name.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 280, delay: 60, easing: EASE, fill: 'backwards', pseudoElement: '::after' });
      const done = dock.querySelector('.dock-bar .done');
      if (done) done.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 120, easing: EASE, fill: 'backwards' });
    }

    // Follows the challenge the game shows; otherwise keeps the one picked here while it is listed.
    function refreshChallenges() {
      state.challenges = H.fut.getChallenges();
      const shown = H.fut.shownChallengeId();
      if (shown != null && shown !== state.selectedId && state.challenges.some((c) => c.id === shown)) {
        state.selectedId = shown;
        state.result = null;
      }
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

    // When something happened, for "loaded just now", "loaded 5 min ago" or "loaded at 14:05".
    function ago(ms) {
      const min = Math.floor((Date.now() - ms) / 60000);
      if (min < 1) return t('just now');
      if (min < 60) return t('{n} min ago', { n: min });
      return t('at {time}', { time: new Date(ms).toLocaleTimeString(H.i18n.locale(), { hour: '2-digit', minute: '2-digit' }) });
    }

    // The club loads a page at a time, so the counter climbs to each page's total instead of jumping.
    let climbing = 0;
    function climbCount() {
      if (climbing) return;
      const step = () => {
        const target = state.loadedCount || 0;
        const shown = state.shownCount || 0;
        if (!state.loading || shown >= target) { climbing = 0; return; }
        state.shownCount = reducedMotion() ? target : Math.min(target, shown + Math.max(1, Math.ceil((target - shown) / 8)));
        const count = panel.querySelector('.club-count');
        if (count) count.textContent = t('{players} so far', { players: plural('player', state.shownCount) });
        climbing = requestAnimationFrame(step);
      };
      climbing = requestAnimationFrame(step);
    }

    async function loadClub() {
      state.loading = true;
      state.error = null;
      state.loadedCount = 0;
      state.shownCount = 0;
      render();
      try {
        await H.fut.loadClub((n) => {
          state.loadedCount = n;
          render();
          climbCount();
        });
        state.clubLoadedAt = Date.now();
      } catch (e) {
        state.error = e.message;
      }
      state.loading = false;
      render();
      // The finished line and Reload my club rise in where the loading line was.
      if (state.clubLoadedAt && !state.error && !reducedMotion()) {
        panel.querySelectorAll('.club-actions > *').forEach((node, n) => node.animate(
          [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, delay: n * 60, easing: EASE, fill: 'backwards' }));
      }
    }

    // Cards the player kept out of a challenge's suggestions with Change: { id → name } per challenge.
    function keptOut(challengeId) {
      if (!state.keptOut.has(challengeId)) state.keptOut.set(challengeId, new Map());
      return state.keptOut.get(challengeId);
    }

    function poolOptions() {
      return { ...settings, protectFrom: Number(settings.protectFrom) || 0 };
    }

    // The cheapest squad for a challenge with a formation. fixed keeps players where they are
    // ({ [slot index]: player }) so only the other slots are searched.
    function solveSquad(entry, { fixed, market = settings.allowMarket, iterations } = {}) {
      const c = entry.challenge;
      const slots = H.fut.slotsFor(c);
      if (!slots) throw new Error(t('This SBC uses a formation the app has not loaded yet. Open the challenge first.'));
      const out = keptOut(entry.id);
      const rules = H.fut.rulesFor(c);
      const pool = H.fut.clubPool(poolOptions()).filter((p) => !out.has(p.id));
      const result = H.solver.solve({
        slots,
        rules,
        pool,
        fixed,
        iterations,
        requiredSlots: H.fut.requiredSlotsFor(c),
        market: { enabled: market },
        ratingFloat: H.fut.ratingUsesFloat(),
        thresholds: H.fut.chemThresholds(),
        seed: Date.now() % 100000,
      });
      const players = result.squad.map((s) => s.player);
      result.eaChem = H.fut.eaChemistry(c.formation, players);
      result.rules = rules;
      result.required = new Set(H.fut.requiredSlotsFor(c));
      result.poolSize = pool.length;
      result.challengeId = entry.id;
      return result;
    }

    // The cheapest cards for a Streamlined SBC, from the cards its own picker lists (pool), within
    // the Streamlined options.
    function pickScore(entry, pool) {
      const c = entry.challenge;
      const out = keptOut(entry.id);
      const min = Number(settings.slMinRating) || 0;
      const max = Number(settings.slMaxRating) || 99;
      const cards = pool
        .filter((p) => !out.has(p.id))
        .filter((p) => (p.storage ? settings.slStorage : settings.slClub))
        .filter((p) => p.rating >= min && p.rating <= max)
        .filter((p) => !settings.keepActiveSquad || !p.active)
        .filter((p) => !settings.untradeablesOnly || p.untradeable)
        // Common and rare cards only: special versions are worth keeping.
        .filter((p) => !settings.slKeepSpecial || p.rarity <= 1)
        // A card in SBC storage can't go back to the club, so using it first costs nothing.
        .map((p) => (settings.storageFirst && p.storage ? { ...p, cost: 0 } : p));
      const remaining = Math.max(0, (c.scoreRequirement || 0) - (c.submittedScore || 0));
      const need = Number(settings.slPoints) > 0 ? Math.min(Number(settings.slPoints), remaining) : remaining;
      const limit = Math.min(H.fut.submitLimit(), Number(settings.slMaxCards) || Infinity);
      const pick = H.streamlined.pickForScore({ cards, need, limit, prefer: settings.slPrefer });
      return {
        ...pick,
        kind: 'score',
        challengeId: entry.id,
        need,
        remaining,
        limit,
        pool,
        poolSize: cards.length,
        rules: H.fut.rulesFor(c),
        ruleResults: [],
        squad: pick.picks.map((player) => ({ player, typeId: null })),
      };
    }

    // The cards a Streamlined SBC takes, asked of the game once and reused while the challenge's
    // progress is unchanged, so trying other options is instant.
    let streamlinedCache = null;
    async function streamlinedCards(entry) {
      const c = entry.challenge;
      const key = `${entry.id}:${c.submittedScore || 0}`;
      if (streamlinedCache && streamlinedCache.key === key && Date.now() - streamlinedCache.at < 5 * 60 * 1000) return streamlinedCache.pool;
      const pool = await H.fut.streamlinedPool(c, { prices: settings.prices });
      streamlinedCache = { key, at: Date.now(), pool };
      return pool;
    }

    function showResult(result) {
      state.result = result;
      state.ruleFocus = null;
      state.placed = new Set();
      state.placing = false;
      state.dockClosed = false;
      // The squad opens on its own page, from the top; the challenge page is one step back.
      state.showSquad = true;
      state.scrollTo = 0;
    }

    function solve() {
      const entry = selected();
      if (!entry) return;
      const body = panel.querySelector('.body');
      state.setupScroll = body ? body.scrollTop : 0;
      state.solving = true;
      state.error = null;
      state.scrollTo = 0;
      render();
      if (H.fut.isStreamlined(entry.challenge)) {
        // EA's picker lists the cards a Streamlined SBC takes; FutFox asks it, then picks.
        streamlinedCards(entry)
          .then((pool) => showResult(pickScore(entry, pool)), (e) => { state.error = e.message; })
          .then(() => { state.solving = false; render(); });
        return;
      }
      // Let the panel paint "Solving..." before the search blocks the page for a moment.
      setTimeout(() => {
        try {
          showResult(solveSquad(entry));
        } catch (e) {
          state.error = e.message;
        }
        state.solving = false;
        render();
      }, 30);
    }

    // Change: keeps that card out of this challenge's suggestions and finds another for its place.
    // In a squad the other players stay where they are, and a card to buy fills the place when no
    // club card fits; a Streamlined SBC's cards are picked again without it.
    function changePlayer(entry, index) {
      const res = state.result;
      const player = res.squad[index].player;
      keptOut(entry.id).set(player.id, player.name);
      try {
        if (res.kind === 'score') {
          state.result = pickScore(entry, res.pool);
          state.placed = new Set();
        } else {
          const fixed = {};
          res.squad.forEach((s, i) => { if (i !== index && s.player) fixed[i] = s.player; });
          state.result = solveSquad(entry, { fixed, market: true, iterations: 6000 });
          state.placed.delete(index);
        }
        state.error = null;
      } catch (e) {
        state.error = e.message;
      }
      render();
    }

    // The cards kept out with Change, and a way to let FutFox use them again.
    function keptOutNote(entry) {
      const out = keptOut(entry.id);
      if (!out.size) return null;
      return el('p', { class: 'note' }, [
        t('Kept out: {names}. ', { names: Array.from(out.values()).join(', ') }),
        el('button', { class: 'small', type: 'button', text: t('Use them again'), onclick: () => { out.clear(); render(); } }),
      ]);
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
      const picked = settings.galleryPicked || {};
      let sum = 0;
      for (const c of cards) sum = (sum * 31 + Number(c.id) + (c.score || 0) * 7) % 2147483647;
      const key = [data.publishedAt, data.sets.length, cards.length, sum, JSON.stringify(done), JSON.stringify(picked)].join('|');
      if (lastResults.key !== key) lastResults = { key, results: H.setMatch.matchAll(data.sets, cards, done, picked) };
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

    // Cards the player picked for slots filled in the game, per set: { [setId]: { [slot index]: card } }.
    // A pick replaces the slot's done tick.
    function setPicked(setId, index, card) {
      const all = { ...(settings.galleryPicked || {}) };
      const slots = { ...(all[setId] || {}) };
      if (card) slots[index] = card; else delete slots[index];
      if (Object.keys(slots).length) all[setId] = slots; else delete all[setId];
      setSetting('galleryPicked', all);
      const done = (settings.galleryDone || {})[setId] || [];
      if (card && done.includes(index)) toggleDone(setId, index);
      else render();
    }

    // "Pick player": the cards that fit a slot, from the squad builder's search, a page at a time.
    // A slot with nothing to search by (any foil card) waits for a name.
    const searchable = (slot) => slot.kind === 'card' || [slot.clubIds, slot.leagueIds, slot.rarityIds].some((l) => l && l.length)
      || [slot.leagueId, slot.nationId, slot.rarityId, slot.minRating].some((v) => v != null);
    function openPicker(res, entry) {
      const body = panel.querySelector('.body');
      state.scrolls.set = body ? body.scrollTop : 0;
      // text: what is in the name box; query: the name of the search on screen; seq: the newest search.
      state.picker = { setId: res.id, index: entry.index, slot: entry.slot, text: '', query: '', page: 0, cards: [], more: false, loading: false, error: null, cleared: false, seq: 0, timer: null };
      state.scrollTo = 0;
      if (searchable(entry.slot)) searchPicker(false); else render();
    }

    async function searchPicker(more) {
      const p = state.picker;
      if (!p) return;
      if (!more) { p.page = 0; p.cards = []; p.more = false; }
      if (!p.query && !searchable(p.slot)) return render();
      const seq = ++p.seq;
      p.loading = true;
      p.error = null;
      render();
      try {
        const found = await H.fut.searchSlotCards(p.slot, { name: p.query, page: p.page });
        // A newer search, or an emptied name box, replaces this one.
        if (state.picker !== p || p.seq !== seq) return;
        const seen = new Set(p.cards.map((c) => c.defId));
        p.cards = p.cards.concat(found.cards.filter((c) => !seen.has(c.defId) && H.setMatch.fitsSlot(p.slot, c)));
        p.more = found.more;
        p.page += 1;
      } catch (e) {
        if (state.picker !== p || p.seq !== seq) return;
        p.error = e.message || String(e);
      }
      p.loading = false;
      render();
    }

    // Typing searches once the name has 3 letters and the typing pauses; an empty box clears the list.
    const TYPE_PAUSE = 350;
    function typePicker(value) {
      const p = state.picker;
      p.text = value;
      clearTimeout(p.timer);
      const name = value.trim();
      if (!name) {
        Object.assign(p, { query: '', page: 0, cards: [], more: false, loading: false, error: null, cleared: true, seq: p.seq + 1 });
        return render();
      }
      if (name.length < 3 || name === p.query) return;
      p.timer = setTimeout(() => {
        p.query = name;
        searchPicker(false);
      }, TYPE_PAUSE);
    }

    // "Suggest cards" on a set page: for each missing slot, the club's cards that fit and are not in
    // the set, then the squad builder list's, one search per different slot, a moment apart. The
    // plan itself (set-match planGrade) is worked out from these for whichever grade is chosen.
    const SUGGEST_GAP = 400;
    function aimFor(res, grade) {
      if (!state.suggest || state.suggest.setId !== res.id) state.suggest = { setId: res.id, grade, options: null, loading: false, done: 0, total: 0, error: null };
      else state.suggest.grade = grade;
      render();
    }

    async function suggestCards(res, grade) {
      const s = { setId: res.id, grade, options: null, loading: true, done: 0, total: 0, error: null };
      state.suggest = s;
      const inSet = new Set(res.slots.filter((e) => e.card).map((e) => e.card.id));
      const club = H.fut.galleryCards().filter((c) => !inSet.has(c.id));
      const missing = res.slots.map((e, index) => ({ ...e, index })).filter((e) => e.slot && !e.card && !e.done);
      const options = {};
      const groups = new Map();
      for (const e of missing) {
        options[e.index] = club.filter((c) => H.setMatch.fitsSlot(e.slot, c)).map((c) => ({ ...c, source: 'club' }));
        if (!searchable(e.slot)) continue;
        const key = JSON.stringify(e.slot);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(e);
      }
      s.total = groups.size;
      render();
      for (const group of groups.values()) {
        if (s.done) await new Promise((r) => setTimeout(r, SUGGEST_GAP));
        if (state.suggest !== s) return;
        try {
          const found = await H.fut.searchSlotCards(group[0].slot, {});
          const fit = found.cards.filter((c) => H.setMatch.fitsSlot(group[0].slot, c)).map((c) => ({ ...c, source: 'search' }));
          for (const e of group) options[e.index] = options[e.index].concat(fit);
        } catch (e) {
          s.error = e.message || String(e);
        }
        if (state.suggest !== s) return;
        s.done += 1;
        render();
      }
      s.options = options;
      s.loading = false;
      render();
    }

    function closePicker() {
      if (state.picker) clearTimeout(state.picker.timer);
      state.picker = null;
      state.scrollTo = state.scrolls.set || 0;
      render();
    }

    function ruleStatus(rule) {
      if (!rule.supported) return { icon: '?', cls: 'unknown', hint: t('Not checked by FutFox yet. Check it yourself.') };
      if (!state.result) return { icon: '•', cls: 'muted', hint: '' };
      const r = state.result.ruleResults.find((x) => x.rule === rule);
      if (!r) return { icon: '•', cls: 'muted', hint: '' };
      return r.shortfall === 0 ? { icon: '✓', cls: 'ok', hint: '' } : { icon: '✗', cls: 'bad', hint: t('Short by {n}', { n: r.shortfall }) };
    }

    // The game's SBC points icon and chemistry glyph, shown in place of the words.
    const pointsIcon = () => {
      const src = H.fut.sbcPointsImage && H.fut.sbcPointsImage();
      return src ? el('img', { class: 'pts-icon', src, alt: '' }) : null;
    };
    const chemIcon = () => el('span', { class: 'chem-ico', 'aria-hidden': 'true' });

    // A challenge's progress as a small chip: done, or a Streamlined SBC's points so far.
    function challengeChip(c) {
      if (c.status === 'COMPLETED') return el('span', { class: 'chip done', text: t('Done') });
      if (H.fut.isStreamlined(c.challenge)) {
        const ch = c.challenge;
        return el('span', { class: 'chip pts', title: t('Points so far'), 'aria-label': t('{done} of {total} points', { done: coins(ch.submittedScore || 0), total: coins(ch.scoreRequirement || 0) }) }, [pointsIcon(), `${coins(ch.submittedScore || 0)} / ${coins(ch.scoreRequirement || 0)}`]);
      }
      return null;
    }

    function chooseChallenge(id) {
      state.menu = null;
      if (id !== state.selectedId) {
        state.selectedId = id;
        state.result = null;
      }
      render();
      const button = panel.querySelector('.menu-btn');
      if (button) button.focus();
    }

    // The challenge picker: the browser's own select can't match the panel, and a long list of
    // challenges reads better grouped by set and searchable. Keys: arrows move, Enter picks, Escape
    // closes. Moving and typing update the list in place; only opening, closing and picking redraw.
    function challengeMenu() {
      const current = selected();
      const open = Boolean(state.menu);
      const toggleMenu = () => { state.menu = open ? null : { query: '' }; render(); };
      const trigger = el('button', {
        class: 'menu-btn', type: 'button', id: 'futfox-challenge', 'aria-haspopup': 'listbox', 'aria-expanded': String(open),
        onclick: toggleMenu,
        onkeydown: (e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); toggleMenu(); }
        },
      }, [
        el('span', { class: 'menu-text' }, current
          ? [current.setName !== current.name ? el('span', { class: 'menu-set', text: current.setName }) : null, el('span', { class: 'menu-name', text: current.name })].filter(Boolean)
          : [el('span', { class: 'menu-name', text: t('Pick a challenge') })]),
        current ? challengeChip(current) : null,
        el('span', { class: 'chev', 'aria-hidden': 'true' }),
      ]);
      const box = el('div', { class: 'menu' }, [trigger]);
      if (!open) return box;

      const list = el('ul', { class: 'menu-list', role: 'listbox', id: 'futfox-challenge-list', 'aria-label': t('Challenges'), tabindex: '-1' });
      let options = [];
      let active = -1;
      const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const mark = (i) => {
        if (options[active]) options[active].node.classList.remove('active');
        active = Math.max(0, Math.min(i, options.length - 1));
        const o = options[active];
        if (!o) return;
        o.node.classList.add('active');
        o.node.scrollIntoView({ block: 'nearest' });
        (search || list).setAttribute('aria-activedescendant', o.node.id);
      };
      const fill = () => {
        const words = fold(state.menu.query).split(/\s+/).filter(Boolean);
        const shown = state.challenges.filter((c) => words.every((w) => fold(`${c.setName} ${c.name}`).includes(w)));
        const rows = [];
        options = [];
        let set = null;
        for (const c of shown) {
          if (c.setId !== set) {
            set = c.setId;
            // A set that is a single challenge of the same name needs no heading of its own.
            const alone = shown.filter((x) => x.setId === c.setId).length === 1 && c.setName === c.name;
            if (!alone) rows.push(el('li', { class: 'menu-group', role: 'presentation', text: c.setName }));
          }
          const node = el('li', {
            class: 'menu-opt', role: 'option', id: `futfox-challenge-${c.id}`, 'aria-selected': String(c.id === state.selectedId),
            onpointerdown: (e) => e.preventDefault(),
            onclick: () => chooseChallenge(c.id),
          }, [el('span', { class: 'menu-name', text: c.name }), challengeChip(c)]);
          node.addEventListener('pointermove', () => mark(options.findIndex((o) => o.node === node)));
          options.push({ id: c.id, node });
          rows.push(node);
        }
        list.replaceChildren(...(rows.length ? rows : [el('li', { class: 'menu-empty', role: 'presentation', text: t('No challenge matches.') })]));
        active = -1;
        mark(Math.max(0, options.findIndex((o) => o.id === state.selectedId)));
      };
      const keys = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); mark(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); mark(active - 1); }
        else if (e.key === 'Home' && !search) { e.preventDefault(); mark(0); }
        else if (e.key === 'End' && !search) { e.preventDefault(); mark(options.length - 1); }
        else if (e.key === 'Enter' && options[active]) { e.preventDefault(); chooseChallenge(options[active].id); }
        else if (e.key === 'Escape' || e.key === 'Tab') {
          if (e.key === 'Escape') e.preventDefault();
          state.menu = null;
          render();
          if (e.key === 'Escape') panel.querySelector('.menu-btn').focus();
        }
      };
      // A search box only when the list is long enough to need one.
      const search = state.challenges.length > 6
        ? el('input', { type: 'search', placeholder: t('Search challenges'), 'aria-label': t('Search challenges'), 'aria-controls': list.id, value: state.menu.query, oninput: (e) => { state.menu.query = e.target.value; fill(); } })
        : null;
      (search || list).addEventListener('keydown', keys);
      fill();
      box.append(el('div', { class: 'menu-pop' }, [search, list].filter(Boolean)));
      // Focus moves into the list once it is on the page.
      queueMicrotask(() => { if (state.menu && box.isConnected) (search || list).focus({ preventScroll: true }); });
      return box;
    }

    // Streamlined SBCs: which cards to use, how many and how many points to reach now, and whether
    // they come from the club, SBC storage or both; one small card each.
    // An on/off option: its text on the left, a switch on the right.
    const switchRow = (key, text, hint) => el('label', { class: 'switch-row', title: hint ? t(hint) : null }, [
      el('span', { text: t(text) }),
      el('input', { class: 'switch', type: 'checkbox', role: 'switch', checked: settings[key], onchange: (e) => setSetting(key, e.target.checked) }),
    ]);
    // A div, not a label: clicking a label would press the stepper's first button.
    const field = (label, control) => el('div', { class: 'field' }, [el('span', { text: t(label) }), control]);

    // A squad SBC's options, in the same cards as a Streamlined SBC's.
    function squadOptions() {
      return el('section', {}, [
        el('h2', { text: t('Options') }),
        el('div', { class: 'opt-card' }, [
          el('h3', { text: t('Which cards') }),
          el('div', { class: 'pair' }, [
            // Stored as the lowest rating kept back (0: none), shown as the highest one used.
            field('Highest rating to use', stepper({ value: Number(settings.protectFrom) ? settings.protectFrom - 1 : 99, min: 40, max: 99, label: t('Highest rating to use'), onChange: (n) => setSetting('protectFrom', n == null || n >= 99 ? 0 : n + 1) })),
          ]),
          el('div', { class: 'switches' }, [
            switchRow('untradeablesOnly', 'Use untradeable cards only'),
            switchRow('keepActiveSquad', "Don't use my active squad", 'Players in your active squad are left out'),
          ]),
        ]),
        el('div', { class: 'opt-card' }, [
          el('h3', { text: t('Take cards from') }),
          el('div', { class: 'switches' }, [
            switchRow('storageFirst', 'SBC storage cards first', 'SBC storage cards go in before club cards'),
            switchRow('allowMarket', 'Suggest cards to buy when the club falls short'),
          ]),
        ]),
      ]);
    }

    // The panel's language: the game's own (Arabic when the Web App is in Arabic), or English or Arabic.
    function languageSection() {
      const choice = (value, text, lang) => el('button', { type: 'button', lang, 'aria-pressed': String((settings.lang || 'auto') === value), text,
        onclick: () => { setSetting('lang', value); render(); if (isShown(dock)) renderDock(); } });
      return el('section', {}, [
        el('h2', { text: t('Language') }),
        el('div', { class: 'segmented', role: 'group', 'aria-label': t('Language') }, [
          choice('auto', t('Same as the game')), choice('en', 'English', 'en'), choice('ar', 'العربية', 'ar'),
        ]),
      ]);
    }

    function streamlinedOptions(entry) {
      const c = entry.challenge;
      const remaining = Math.max(0, (c.scoreRequirement || 0) - (c.submittedScore || 0));
      const limit = H.fut.submitLimit();
      const prefer = (value, text) => el('button', { type: 'button', 'aria-pressed': String(settings.slPrefer === value), text, onclick: () => { setSetting('slPrefer', value); render(); } });
      return el('section', {}, [
        el('h2', { text: t('Options') }),
        el('div', { class: 'opt-card' }, [
          el('h3', { text: t('Which cards') }),
          el('div', { class: 'pair' }, [
            field('From rating', stepper({ value: settings.slMinRating, min: 40, max: 99, label: t('Lowest rating'), onChange: (n) => setSetting('slMinRating', n) })),
            field('To rating', stepper({ value: settings.slMaxRating, min: 40, max: 99, label: t('Highest rating'), onChange: (n) => setSetting('slMaxRating', n) })),
          ]),
          el('div', { class: 'switches' }, [
            switchRow('slKeepSpecial', "Don't use special cards", 'Only common and rare cards are used'),
            switchRow('untradeablesOnly', 'Use untradeable cards only'),
            switchRow('keepActiveSquad', "Don't use my active squad", 'Players in your active squad are left out'),
          ]),
        ]),
        el('div', { class: 'opt-card' }, [
          el('h3', { text: t('How many') }),
          el('div', { class: 'pair' }, [
            field(t('Max cards (up to {n})', { n: limit }), stepper({ value: settings.slMaxCards, min: 1, max: limit, label: t('Cards'), empty: String(limit), onChange: (n) => setSetting('slMaxCards', n) })),
            field('Points now', stepper({ value: settings.slPoints, min: 1, max: Math.max(1, remaining), step: 500, wide: true, label: t('Points'), empty: coins(remaining), onChange: (n) => setSetting('slPoints', n) })),
          ]),
          el('div', { class: 'segmented full', role: 'group', 'aria-label': t('Favour') }, [prefer('cheapest', t('Fewest coins')), prefer('fewest', t('Fewest cards'))]),
        ]),
        el('div', { class: 'opt-card' }, [
          el('h3', { text: t('Take cards from') }),
          el('div', { class: 'switches' }, [
            switchRow('slClub', 'Use club cards'),
            switchRow('slStorage', 'Use SBC storage'),
            switchRow('storageFirst', 'Storage cards first', 'SBC storage cards go in before club cards'),
          ]),
        ]),
      ]);
    }

    // While FutFox works out a suggestion: its page, with faded cards pulsing where the cards will go
    // (a squad's in its formation, locked slots as they are).
    function solvingPage(entry) {
      const streamlined = H.fut.isStreamlined(entry.challenge);
      const skel = (n) => {
        const card = miniCard({});
        card.style.animationDelay = `${(n % 5) * 120}ms`;
        return el('div', { class: 'slot skel' }, [card]);
      };
      const slots = streamlined ? null : H.fut.slotsFor(entry.challenge);
      const required = slots ? new Set(H.fut.requiredSlotsFor(entry.challenge)) : null;
      const cards = slots
        ? el('div', { class: 'pitch' }, pitchRows(slots).map((row) => el('div', { class: 'pitch-row' }, row.map((i) => (required.has(i)
          ? skel(i)
          : el('div', { class: 'slot locked' }, [miniCard({ position: H.fut.positionName(slots[i].typeId), label: t('Locked') })]))))))
        : el('div', { class: 'cards' }, [0, 1, 2, 3, 4].map(skel));
      return [
        crumbs([[entry.setName || t('Challenge')], [entry.name]], 'SBC'),
        el('section', { 'aria-busy': 'true' }, [
          el('h2', { text: t(streamlined ? 'Suggested cards' : 'Suggested squad') }),
          el('p', { class: 'muted', role: 'status' }, [spinner(), t(streamlined ? 'Asking the game which cards this challenge takes…' : 'Finding the cheapest squad in your club…')]),
          cards,
        ]),
      ];
    }

    // The suggested squad on its own page, like a Gallery set: the challenge's options are one step back.
    function squadPage(entry) {
      const back = () => { state.showSquad = false; state.scrollTo = state.setupScroll || 0; render(); };
      return [
        crumbs([[entry.setName || t('Challenge'), back], [entry.name]], 'SBC'),
        state.result.kind === 'score' ? renderScoreResult(entry) : renderResult(entry),
        placeSteps(state.result.kind === 'score'),
      ];
    }

    // FutFox never changes a squad, so the player places the suggestion in the game.
    function placeSteps(streamlined) {
      const steps = streamlined
        ? [
            'In the game, open this challenge and press Start Challenge (or Continue) to reach its card picker.',
            'Press the button below: FutFox folds into a small list in the corner, each card with its Item Score.',
            "Tick each card in the game's picker, then in the list. Both list the highest Item Score first.",
            'Check the points reach the target, then submit it yourself.',
          ]
        : null;
      return el('section', {}, [
        el('h2', { text: t(streamlined ? 'Pick them in the game' : 'Place it in the game') }),
        el('ol', { class: 'steps' }, steps ? steps.map((text) => el('li', { text: t(text) })) : [
          el('li', { text: t('Press the button below, or click anywhere in the game: FutFox folds into a small list in the corner while this SBC is open.') }),
          el('li', { text: t('Click a position on the pitch, search your club for that player (Copy puts the name on your clipboard), then tick the player in the list.') }),
          el('li', { text: t('For a card to buy, press Search market (Market in the list), buy one with the rating shown, then place it the same way.') }),
          el('li', { text: t('When every position is filled, check the rating and chemistry in the SBC screen, then submit it yourself.') }),
        ]),
        el('p', { class: 'note', text: t('In the way? Drag the list, the FutFox button or this panel by its top bar anywhere on the screen. A double-click puts it back.') }),
        el('div', { class: 'row' }, [
          el('button', { class: 'primary', type: 'button', text: t('Place it in the game'), onclick: () => { state.placing = true; state.dockClosed = false; hidePanel(); } }),
        ]),
      ]);
    }

    function changeButton(entry, index, name) {
      return el('button', { class: 'icon-btn', type: 'button', title: t('Change: keep this card and suggest another'), 'aria-label': t('Change {name}', { name }), onclick: () => changePlayer(entry, index) }, [swapIcon()]);
    }

    function renderResult(entry) {
      const res = state.result;
      if (!res) return null;
      const chem = res.eaChem ? res.eaChem.total : res.chemistry;
      const perPlayer = res.eaChem ? res.eaChem.perPlayer : res.squad.map((s) => s.chemistry);
      const buys = res.squad.filter((s) => s.player && s.player.source === 'market');

      const summary = el('div', { class: 'summary' }, [
        el('span', {}, parts('{n} rating', { n: el('strong', { text: String(res.rating) }) })),
        el('span', { title: t(res.eaChem ? 'Chemistry' : 'Chemistry, estimated: check it in the squad builder') }, [chemIcon(), el('strong', { text: String(chem) }), ` / ${3 * res.squad.length}`, res.eaChem ? '' : t(' (estimate)')]),
        el('span', {}, [
          H.fut.coinImage && H.fut.coinImage() ? el('img', { class: 'coin', src: H.fut.coinImage(), alt: '' }) : null,
          ...parts('{n} est. coins', { n: el('strong', { text: coins(res.cost) }) }),
        ]),
        el('span', { class: res.feasible ? 'ok' : 'bad', text: t(res.feasible ? 'Meets the rules' : 'Could not meet every rule') }),
      ]);

      // The SBC's rules on top. A rule about single cards (a club, nation, rarity...) is a button
      // that picks out the cards meeting it.
      const focus = state.ruleFocus != null ? res.ruleResults[state.ruleFocus] : null;
      // The game shows how many players the squad needs (the slots that aren't locked) as a rule
      // of its own, though it isn't one of the SBC's requirements.
      const needed = res.required ? res.required.size : res.squad.length;
      const filled = res.squad.filter((s, i) => s.player && (!res.required || res.required.has(i))).length;
      const count = el('span', { class: `rule-chip ${filled === needed ? 'ok' : 'bad'}` }, [el('span', { class: 'ri', text: filled === needed ? '✓' : '✗' }), t('Number of Players in the Squad: {n}', { n: needed })]);
      const rules = el('div', { class: 'rule-chips' }, [count].concat(res.ruleResults.map((r, n) => {
        const icon = !r.rule.supported ? '?' : r.shortfall === 0 ? '✓' : '✗';
        const cls = `rule-chip ${!r.rule.supported ? 'unknown' : r.shortfall === 0 ? 'ok' : 'bad'}`;
        const text = [el('span', { class: 'ri', text: icon }), r.rule.label];
        const players = res.squad.map((s) => s.player).filter(Boolean);
        if (!players.length || H.requirements.cardMeets(r.rule, players[0]) === null) return el('span', { class: cls }, text);
        return el('button', { type: 'button', class: cls, 'aria-pressed': String(state.ruleFocus === n), title: t('Show the cards that meet this rule'), onclick: () => { state.ruleFocus = state.ruleFocus === n ? null : n; render(); } }, text);
      })));

      // Drawn like the game's cards on its squad screen: each card in its slot's position, then
      // untradeable, chemistry and Change on one line, then where the card is.
      const formation = H.fut.slotsFor(entry.challenge) || res.squad.map((s) => ({ typeId: s.typeId, name: H.fut.positionName(s.typeId) }));
      const cell = (s, i) => {
        const p = s.player;
        const position = H.fut.positionName(s.typeId);
        if (!p) {
          const locked = res.required && !res.required.has(i);
          return el('div', { class: 'slot pick locked', title: t(locked ? 'This slot is locked: the SBC needs no card here' : 'No card fits this slot') }, [
            miniCard({ position, label: t(locked ? 'Locked' : 'Empty') }),
            el('span', { class: 'src', text: t(locked ? 'Not needed' : 'Nothing fits') }),
          ]);
        }
        const dim = focus && !H.requirements.cardMeets(focus.rule, p);
        if (p.source === 'market') {
          return el('div', { class: `slot pick${dim ? ' dim' : ''}`, title: t('Buy a {rating}-rated {position}: {league} · {nation}', { rating: p.rating, position, league: H.fut.leagueName(p.search.leagueId), nation: H.fut.nationName(p.search.nationId) }) }, [
            miniCard({ rating: p.rating, position, name: t('To buy') }),
            el('button', { class: 'small market', type: 'button', text: t('Search market'), onclick: () => H.fut.openMarketSearch(p.search) }),
            el('span', { class: 'src', text: `${H.fut.leagueName(p.search.leagueId)} · ${H.fut.nationName(p.search.nationId)}` }),
          ]);
        }
        const chem = perPlayer[i] || 0;
        const plain = p.rarity === 0 || p.rarity === 1;
        return el('div', { class: `slot pick${dim ? ' dim' : ''}`, title: `${p.name} ${p.rating} · ${H.fut.leagueName(p.leagueId)} · ${H.fut.nationName(p.nationId)}` }, [
          miniCard({ rarityId: p.rarity, rating: p.rating, playerId: p.playerId, position, name: p.name, badges: H.fut.cardBadges(p, { light: plain }) }),
          el('div', { class: 'pick-line' }, [
            p.untradeable ? el('span', { class: 'untr-ico', role: 'img', title: t('Untradeable'), 'aria-label': t('Untradeable') }) : null,
            el('span', { class: 'chem-pts', role: 'img', title: t('{n} chemistry', { n: chem }), 'aria-label': t('{n} chemistry', { n: chem }) }, [0, 1, 2].map((n) => el('i', { class: n < chem ? 'on' : null }))),
            changeButton(entry, i, p.name),
          ]),
          el('span', { class: p.storage ? 'src store' : 'src', text: t(p.storage ? 'SBC storage' : 'Club') }),
        ]);
      };
      const pitch = el('div', { class: 'pitch' }, pitchRows(formation).map((row) => el('div', { class: 'pitch-row' }, row.map((i) => cell(res.squad[i], i)))));

      return el('section', {}, [
        el('h2', { text: t('Suggested squad') }),
        summary,
        rules,
        pitch,
        buys.length
          ? el('p', { class: 'note', text: t("{cards} to buy. \"Search market\" fills in quality, position, league and nation; the market has no rating filter, so pick a card with the rating shown. You press Search and choose what to buy. Prices for cards you don't own are rough estimates.", { cards: plural('card', buys.length) }) })
          : null,
        res.eaChem ? null : el('p', { class: 'note', text: t(buys.length
          ? 'Chemistry is estimated because the squad includes cards to buy. Check it in the squad builder.'
          : "Chemistry is estimated because the game's own count wasn't available. Check it in the squad builder.") }),
        el('p', { class: 'note', text: t('Picked from {players} in your club and SBC storage. Nothing has been placed in your squad.', { players: plural('player', res.poolSize) }) }),
        keptOutNote(entry),
      ]);
    }

    // A Streamlined SBC's picks: cards, not a squad, with the points each one brings.
    function renderScoreResult(entry) {
      const res = state.result;
      const summary = el('div', { class: 'summary' }, [
        el('span', { title: t('Points') }, [pointsIcon(), el('strong', { text: coins(res.score) }), ` / ${coins(res.need)}`, res.need < res.remaining ? t(' ({n} left)', { n: coins(res.remaining) }) : '']),
        el('span', {}, parts('{n} of {cards}', { n: el('strong', { text: String(res.picks.length) }), cards: plural('card', res.limit) })),
        el('span', {}, [
          H.fut.coinImage && H.fut.coinImage() ? el('img', { class: 'coin', src: H.fut.coinImage(), alt: '' }) : null,
          ...parts('{n} est. coins', { n: el('strong', { text: coins(res.cost) }) }),
        ]),
        res.reached ? el('span', { class: 'ok', text: t('Reaches the target') }) : el('span', { class: 'bad', title: t('Points still missing') }, parts('Short by {n}', { n: [pointsIcon(), coins(res.need - res.score)] })),
      ]);
      // Drawn like the game's own cards, with the line the game's picker shows under each card.
      const points = H.fut.sbcPointsImage && H.fut.sbcPointsImage();
      const cells = res.squad.map((s, i) => {
        const p = s.player;
        const plain = p.rarity === 0 || p.rarity === 1;
        return el('div', { class: 'slot pick' }, [
          miniCard({ rarityId: p.rarity, rating: p.rating, playerId: p.playerId, position: H.fut.positionName(p.position ?? p.positions[0]), name: p.name, badges: H.fut.cardBadges(p, { light: plain }) }),
          el('div', { class: 'pick-line' }, [
            p.untradeable ? el('span', { class: 'untr-ico', role: 'img', title: t('Untradeable'), 'aria-label': t('Untradeable') }) : null,
            points ? el('img', { class: 'pts-icon', src: points, alt: '' }) : null,
            el('span', { title: t('Item Score'), text: coins(p.score) }),
            changeButton(entry, i, p.name),
          ]),
          el('span', { class: p.storage ? 'src store' : 'src', text: t(p.storage ? 'SBC storage' : 'Club') }),
        ]);
      });
      return el('section', {}, [
        el('h2', { text: t('Suggested cards') }),
        summary,
        cells.length ? el('div', { class: 'cards' }, cells) : el('p', { class: 'muted', text: t('No card in your club or SBC storage fits this challenge.') }),
        res.reached ? null : el('p', { class: 'note', text: t('These are your {cards} with the highest Item Score. Submit them to bank their points, then come back for the rest.', { cards: plural('card', res.limit) }) }),
        el('p', { class: 'note', text: t("Picked from {cards} the game's picker lists for this challenge. Nothing has been ticked or submitted.", { cards: plural('card', res.poolSize) }) }),
        keptOutNote(entry),
      ]);
    }

    // What FutFox keeps in this browser for the Gallery (remembered cards, ticked slots), to copy
    // it to a file or bring a copy back. Importing adds to what is here; nothing is replaced.
    function savedDataSection() {
      if (!H.fut.galleryMemory) return null;
      const { memory } = H.fut.galleryMemory();
      const cards = Object.keys(memory.cards).length;
      const ticks = Object.values(settings.galleryDone || {}).reduce((n, list) => n + list.length, 0);
      const picks = Object.values(settings.galleryPicked || {}).reduce((n, slots) => n + Object.keys(slots).length, 0);
      const msg = state.dataMessage;
      return el('section', {}, [
        el('h2', { text: t('Saved in this browser') }),
        el('p', { class: 'muted', text: [t('{cards} remembered', { cards: plural('card', cards) }), t('{cards} picked', { cards: plural('card', picks) }), ticks ? t('{slots} ticked done in game', { slots: plural('slot', ticks) }) : null].filter(Boolean).join(' · ') }),
        el('div', { class: 'row' }, [
          el('button', { type: 'button', text: t('Export'), disabled: !cards && !ticks && !picks, onclick: exportGalleryData }),
          el('label', { class: 'file' }, [
            el('input', { type: 'file', accept: '.json,application/json', 'aria-label': t('Import a FutFox Gallery data file'), onchange: (e) => importGalleryData(e.target.files[0]) }),
            el('span', { text: t('Import') }),
          ]),
        ]),
        msg ? el('p', { class: msg.kind === 'bad' ? 'error' : 'note', role: 'status', text: msg.text }) : null,
        el('p', { class: 'note', text: t('Only this browser keeps these. Export a copy to move them to another browser or keep them safe; importing adds to what is here and keeps your picks.') }),
      ]);
    }

    function exportGalleryData() {
      const { memory, persona } = H.fut.galleryMemory();
      const data = H.gallery.exportData({ memory, done: settings.galleryDone || {}, picked: settings.galleryPicked || {}, persona, now: Date.now() });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const link = el('a', { href: url, download: `futfox-gallery-${new Date().toISOString().slice(0, 10)}.json` });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const picks = Object.values(data.picked).reduce((n, slots) => n + Object.keys(slots).length, 0);
      state.dataMessage = { kind: 'ok', text: t('Exported {cards}, {picks} picked and {slots} ticked.', { cards: plural('card', data.cards.length), picks: plural('card', picks), slots: plural('slot', Object.values(data.done).reduce((n, l) => n + l.length, 0)) }) };
      render();
    }

    async function importGalleryData(file) {
      if (!file) return;
      let read;
      try {
        read = H.gallery.readExport(JSON.parse(await file.text()));
      } catch (e) {
        read = { error: t("{file} isn't a FutFox Gallery data file (it isn't JSON).", { file: file.name }) };
      }
      if (read.error) { state.dataMessage = { kind: 'bad', text: t(read.error) }; return render(); }
      const { memory, persona } = H.fut.galleryMemory();
      const merged = H.gallery.mergeMemory(memory, read.memory);
      const done = H.gallery.mergeDone(settings.galleryDone, read.done);
      const picked = H.gallery.mergePicked(settings.galleryPicked, read.picked);
      // Only what the file added: cards and ticks already here aren't counted again.
      const tickCount = (d) => Object.values(d || {}).reduce((n, l) => n + l.length, 0);
      const cards = Object.keys(merged.cards).length - Object.keys((memory && memory.cards) || {}).length;
      const ticks = tickCount(done) - tickCount(settings.galleryDone);
      const pickCount = (p) => Object.values(p || {}).reduce((n, slots) => n + Object.keys(slots).length, 0);
      const picks = pickCount(picked) - pickCount(settings.galleryPicked);
      H.fut.replaceGalleryMemory(merged);
      setSetting('galleryDone', done);
      setSetting('galleryPicked', picked);
      const other = read.persona && String(read.persona) !== String(persona) ? t(' The file comes from another EA account; its cards now count for this one.') : '';
      const added = cards || ticks || picks
        ? t('Added {cards}, {picks} picked and {slots} ticked.', { cards: plural('card', cards), picks: plural('card', picks), slots: plural('slot', ticks) })
        : t('Nothing new: everything in the file was already here.');
      state.dataMessage = { kind: 'ok', text: `${added}${other}` };
      render();
    }

    function clubSection(known) {
      return el('section', {}, [
        el('h2', { text: t('Your club') }),
        // As in the video: Load my club (lime until the club is loaded) with what FutFox knows beside
        // it; while it loads, one line with the spinner and how many players so far; then Reload my
        // club with how many players and when.
        state.loading
          ? el('div', { class: 'club-loading' }, [
            spinner(),
            el('span', { role: 'status', text: t('Loading your club…') }),
            el('span', { class: 'club-count', text: t('{players} so far', { players: plural('player', state.shownCount || 0) }) }),
          ])
          : el('div', { class: 'row club-actions' }, [
            el('button', { class: state.clubLoadedAt ? 'load' : 'load primary', type: 'button', onclick: loadClub }, [t(state.clubLoadedAt ? 'Reload my club' : 'Load my club')]),
            el('span', { class: 'muted club-status', role: 'status', text: [
              state.clubLoadedAt ? plural('player', known) : t('{players} known', { players: plural('player', known) }),
              H.fut.knownStorageItems().length ? t('{n} in SBC storage', { n: H.fut.knownStorageItems().length }) : null,
              state.clubLoadedAt ? t('loaded {when}', { when: ago(state.clubLoadedAt) }) : null,
            ].filter(Boolean).join(' · ') }),
          ]),
        el('p', { class: 'note', text: t('Reads your club list and SBC storage the same way the Club screen does, one page every few seconds.') }),
      ]);
    }

    async function loadSets(force) {
      state.sets.loading = true;
      state.sets.error = null;
      render();
      try {
        state.sets.data = await H.gallerySource.load({ force });
      } catch (e) {
        state.sets.error = t(e.message || String(e));
        state.sets.data = state.sets.data || H.gallerySource.cached();
      }
      state.sets.loading = false;
      render();
    }

    const day = (ms) => new Date(ms).toLocaleDateString(H.i18n.locale(), { day: 'numeric', month: 'short' });

    function slotLine(slot) {
      if (slot.kind === 'card') return { rating: slot.rating == null ? '' : String(slot.rating), name: slot.name || t('Player {id}', { id: slot.playerId }), meta: slot.version || t('Any version') };
      const parts = [
        slot.version,
        slot.leagueIds && slot.leagueIds.length && slot.leagueIds.map((id) => H.fut.leagueName(id)).join(t(' or ')),
        slot.leagueId != null && H.fut.leagueName(slot.leagueId),
        slot.nationId != null && H.fut.nationName(slot.nationId),
        slot.minRating != null && `${slot.minRating}+`,
      ];
      return { rating: '', name: slot.label, meta: parts.filter(Boolean).join(' · ') || t('Any card') };
    }

    // A category's or set's picture: its own art from art/ first, then the Web App's club badge or
    // league logos (see setMatch.picture), then its first letter.
    const ART = H.art || {};
    // The Gallery Token: art/token.png, else the generic token the Web App's rewards use.
    const tokenSrc = () => ART.token || (H.fut.tokenImage && H.fut.tokenImage());
    // Item Score (the cards' SBC score) is marked with the SBC icon, art/sbc.webp.
    const scoreIcon = () => (ART.sbc ? el('img', { class: 'score-icon', src: ART.sbc, alt: '' }) : null);
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
        el('span', { class: 'count', text: t('{have} of {total}', { have: res.have, total: res.total }) }),
        el('span', { class: 'bar', 'aria-hidden': 'true' }, [el('span', { style: `width:${Math.round((100 * res.have) / (res.total || 1))}%` })]),
        el('span', { class: 'meta', text: [res.grade ? t('Grade {grade} with your cards', { grade: res.grade }) : null, res.unsure ? t('{n} to check', { n: res.unsure }) : null].filter(Boolean).join(' · ') || t('{n} missing', { n: res.total - res.have }) }),
      ]);
    }

    // The Gallery has three levels, like the admin: categories, a category's sets, one set.
    // Going down remembers where the list was scrolled; going back returns there.
    const OTHER = 'Other';
    const categoryOf = (res) => res.group || OTHER;
    const shownCategory = (name) => (name === OTHER ? t(OTHER) : name);
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

    function crumbs(parts, label = 'Gallery') {
      const items = [];
      parts.forEach(([text, onclick], i) => {
        if (i) items.push(el('span', { class: 'sep', 'aria-hidden': 'true', text: H.i18n.dir() === 'rtl' ? '‹' : '›' }));
        items.push(onclick ? el('button', { type: 'button', class: 'small', text: i ? text : `${H.i18n.dir() === 'rtl' ? '→' : '←'} ${text}`, onclick }) : el('span', { class: 'current', 'aria-current': 'page', text }));
      });
      return el('nav', { class: 'crumbs', 'aria-label': t(label) }, items);
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
        || (pictured.every((p) => p.club != null) ? t('Explore club collections')
          : pictured.every((p) => p.leagues) ? t('Explore league collections')
            : `${(logos.from.length ? logos.from : sets.map((r) => r.name)).slice(0, 2).join(', ')}${sets.length > 2 ? t(' & more') : ''}`);
      const tokens = sets.map(setTokens).reduce((t, s) => ({ earned: t.earned + s.earned, total: t.total + s.total }), { earned: 0, total: 0 });
      const grades = H.setMatch.GRADES.map((g) => {
        const n = sets.filter((r) => r.grade === g).length;
        return el('span', { class: `grade g-${g}${n ? '' : ' none'}`, title: t('{sets} at grade {grade} with your cards', { sets: plural('set', n), grade: g }) }, [
          el('span', { class: 'dia', text: g }),
          el('span', { class: 'n', text: String(n) }),
        ]);
      });
      const logo = (src) => el('img', { src, alt: '', onerror: (e) => e.target.remove() });
      return el('button', { type: 'button', class: 'cat', onclick: () => go(name, null) }, [
        el('span', { class: 'cat-top' }, [
          el('span', { class: 'logos', 'aria-hidden': 'true' }, logos.urls.length ? logos.urls.map(logo) : [el('span', { class: 'letter', text: title.trim().charAt(0).toUpperCase() })]),
          tokens.total ? el('span', { class: 'tokens', title: t('Gallery Tokens your cards earn, of all this category gives') }, [
            tokenSrc() ? el('img', { src: tokenSrc(), alt: '' }) : null,
            el('strong', { text: coins(tokens.earned) }),
            el('span', { class: 'muted', text: ` / ${coins(tokens.total)}` }),
          ]) : null,
          el('span', { class: 'chip', text: plural('set', sets.length) }),
        ]),
        el('span', { class: 'grades' }, grades),
        el('span', { class: 'cat-foot' }, [
          el('span', {}, [el('span', { class: 'cat-name', text: title === OTHER ? t(OTHER) : title }), el('span', { class: 'cat-sub', text: sub })]),
          el('span', { class: 'go', 'aria-hidden': 'true', text: H.i18n.dir() === 'rtl' ? '↖' : '↗' }),
        ]),
      ]);
    }

    function setCard(res) {
      return el('div', { class: 'set' }, [setHead(res, 'button', { type: 'button', onclick: () => go(categoryOf(res), res.id) })]);
    }

    // The grade your cards reach, how far the next one is, and the set's grade ladder: each grade's
    // lowest Item Score and the Gallery Tokens it gives.
    function gradePanel(res) {
      const graded = H.setMatch.GRADES.filter((g) => res.grades[g] != null);
      const next = graded.find((g) => res.score < res.grades[g]);
      const from = res.grade ? res.grades[res.grade] : 0;
      const tokens = setTokens(res);
      const scoreHint = res.bonus ? t('{base} from your matching cards + {bonus} from bonus tags', { base: coins(res.baseScore), bonus: coins(res.bonus) }) : t('From your matching cards');
      const reward = (g) => (tokensIn(res.rewards[g]) ? plural('token', tokensIn(res.rewards[g])) : res.rewards[g] || t('its reward'));
      const steps = graded.map((g) => {
        const reached = res.score >= res.grades[g];
        return el('div', { class: `step g-${g}${reached ? '' : ' none'}${g === res.grade ? ' current' : ''}`, title: `${t('Grade {grade}: from {n} Item Score', { grade: g, n: coins(res.grades[g]) })}${res.rewards[g] ? t(', gives {reward}', { reward: res.rewards[g] }) : ''}` }, [
          el('span', { class: 'dia', text: g }),
          el('span', { class: 'n', text: coins(res.grades[g]) }),
          el('span', { class: 'gives' }, tokensIn(res.rewards[g])
            ? [tokenSrc() ? el('img', { src: tokenSrc(), alt: '' }) : null, String(tokensIn(res.rewards[g]))]
            : [res.rewards[g] ? t('Reward') : '–']),
        ]);
      });
      return el('section', { class: 'grade-panel' }, [
        el('div', { class: 'grade-top' }, [
          el('span', { class: `grade big g-${res.grade || 'D'}${res.grade ? '' : ' none'}`, 'aria-hidden': 'true' }, [el('span', { class: 'dia', text: res.grade || '–' })]),
          el('div', { class: 'grade-text' }, [
            el('span', { class: 'muted', text: [t('{name} · {have} of {cards}', { name: res.name, have: res.have, cards: plural('card', res.total) }), res.unsure ? t('{n} to check', { n: res.unsure }) : null].filter(Boolean).join(' · ') }),
            el('span', { class: 'score', title: scoreHint }, [scoreIcon(), el('strong', { text: coins(res.score) }), el('span', { class: 'muted', text: ` ${t('Item Score')}` })]),
            el('span', { text: res.grade ? `${t('Grade {grade}', { grade: res.grade })}${tokens.earned ? t(' · {tokens} earned', { tokens: plural('token', tokens.earned) }) : ''}` : t(graded.length ? 'No grade yet' : 'This set has no grades listed') }),
          ]),
        ]),
        next ? el('div', { class: 'to-next' }, [
          el('span', { class: 'bar', 'aria-hidden': 'true' }, [el('span', { style: `width:${Math.round((100 * (res.score - from)) / (res.grades[next] - from))}%` })]),
          el('span', { class: 'note', text: t('{n} more Item Score for grade {grade} and {reward}', { n: coins(res.grades[next] - res.score), grade: next, reward: reward(next) }) }),
        ]) : graded.length ? el('p', { class: 'note', text: t('Top grade reached.') }) : null,
        steps.length ? el('div', { class: 'ladder' }, steps) : null,
      ]);
    }

    // A small card as the game draws it: the version's card, the player's face, rating, position and
    // name. A rule slot shows its version's blank card with what it asks for.
    // EA's holographic layers over a foil card's art, under its text.
    function holoLayers(art, bg) {
      if (!art || (!art.sheet && !art.still)) {
        if (!bg) return [];
        const shine = el('span', { class: 'holo css' });
        shine.style.setProperty('--card-art', `url("${bg}")`);
        return [shine];
      }
      const still = art.still ? el('img', { class: `holo-still${art.sheet ? '' : ' only'}`, src: art.still, alt: '', onerror: (e) => e.target.remove() }) : null;
      if (!art.sheet) return [still];
      const sweep = el('span', { class: `holo${still ? ' has-still' : ''}` });
      sweep.style.backgroundImage = `url("${art.sheet}")`;
      return [sweep, still];
    }

    function miniCard({ rarityId, rating, playerId, position, name, label, missing, small, foil, foilArt, badges }) {
      const bg = rarityId != null && H.fut.cardImage ? H.fut.cardImage(rarityId, rating) : null;
      const face = playerId != null && H.fut.playerFace ? H.fut.playerFace(playerId) : null;
      const plain = bg && (rarityId === 0 || rarityId === 1);
      const card = el('span', { class: `card${bg ? '' : ' blank'}${plain ? ' plain' : ''}${missing ? ' missing' : ''}${small ? ' small' : ''}`, 'aria-hidden': 'true' });
      card.append(...[
        bg ? el('img', { class: 'bg', src: bg, alt: '', onerror: (e) => { e.target.remove(); card.classList.add('blank'); } }) : null,
        face ? el('img', { class: 'face', src: face, alt: '', onerror: (e) => e.target.remove() }) : null,
        ...(foil ? holoLayers(foilArt, bg) : []),
        rating != null && !label ? el('span', { class: 'rt', text: String(rating) }) : null,
        position ? el('span', { class: 'ps', text: position }) : null,
        name ? el('span', { class: 'nm', text: name }) : null,
        label ? el('span', { class: 'lbl', text: label }) : null,
        badges && badges.some(Boolean)
          ? el('span', { class: 'bdg' }, badges.filter(Boolean).map((src) => el('img', { src, alt: '', onerror: (e) => e.target.remove() })))
          : null,
      ].filter(Boolean));
      return card;
    }

    // One slot of the set: the card FutFox would use, or what is missing. A missing slot takes the card
    // that is in it in the game ("Pick player"); slots ticked done before picking existed can be undone.
    function slotCell(res, entry, suggestion) {
      const { slot, card } = entry;
      const line = slotLine(slot);
      const version = slot.rarityIds && slot.rarityIds.length ? slot.rarityIds[0] : slot.rarityId;
      const about = el('span', { class: 'sr', text: [line.name, line.meta].join(', ') });
      const link = (text, title, onclick) => el('button', { type: 'button', class: 'link', text, title, onclick });
      const pick = (text) => link(t(text), t('Choose the card that is in this slot in the game, so it counts with its Item Score'), () => openPicker(res, entry));
      if (card) {
        const status = entry.picked ? { cls: 'ok', text: t('✓ Picked'), hint: t('You picked this card as the one in this slot in the game') }
          : entry.unsure ? { cls: 'unknown', text: t('? Check in game'), hint: t("This slot's version has no number yet, so FutFox can't check it: check this card in the game") }
          : card.remembered ? { cls: 'ok', text: t('✓ Seen earlier'), hint: t('FutFox saw this card in your club before; it still counts in the Gallery') }
          : { cls: 'ok', text: t('✓ In your club'), hint: t('In your club') };
        const position = card.positions && card.positions.length ? H.fut.positionName(card.positions[0]) : null;
        return el('div', { class: 'slot', title: `${line.name} · ${line.meta}\n${t('Yours: {card}, {score} Item Score.', { card: `${card.name} ${card.rating}${card.foil ? ` ${t('Holographic')}` : ''}`, score: coins(card.score || 0) })} ${status.hint}` }, [
          about,
          miniCard({ rarityId: card.rarityId, rating: card.rating, playerId: card.playerId, position, name: card.name, foil: card.foil, foilArt: card.foilArt }),
          el('span', { class: `cap ${status.cls}`, text: status.text }),
          entry.picked ? el('span', { class: 'acts' }, [pick('Change'), link(t('Remove'), t('Count this slot as missing again'), () => setPicked(res.id, entry.index, null))]) : null,
        ]);
      }
      if (entry.done) {
        return el('div', { class: 'slot', title: `${line.name} · ${line.meta}\n${t('You marked this slot as done in the game')}` }, [
          about,
          miniCard({ rarityId: version, rating: slot.rating, label: t('✓ Done in game') }),
          el('span', { class: 'acts' }, [pick('Pick'), link(t('Undo'), t('Count this slot as missing again'), () => toggleDone(res.id, entry.index))]),
        ]);
      }
      if (suggestion) {
        const c = suggestion.card;
        const club = c.source === 'club';
        const position = c.positions && c.positions.length ? H.fut.positionName(c.positions[0]) : null;
        return el('div', { class: 'slot suggested', title: t('Suggested for {slot}: {card}, {score} Item Score, {where}', { slot: line.name, card: `${c.name} ${c.rating}${c.foil ? ` ${t('Holographic')}` : ''}`, score: coins(c.score || 0), where: t(club ? 'in your club' : 'from the squad builder list') }) }, [
          about,
          miniCard({ rarityId: c.rarityId, rating: c.rating, playerId: c.playerId, position, name: c.name, foil: c.foil, foilArt: c.foilArt }),
          el('span', { class: 'cap sug', text: `+${coins(suggestion.gain)}` }),
          el('span', { class: `src${club ? ' club' : ''}`, text: t(club ? 'In your club' : 'Squad builder') }),
          pick('Pick player'),
        ]);
      }
      const exact = slot.kind === 'card';
      return el('div', { class: 'slot', title: t('Missing: {slot}', { slot: `${line.name} · ${line.meta}` }) }, [
        about,
        miniCard({ rarityId: version, rating: exact ? slot.rating : slot.minRating, playerId: exact ? slot.playerId : null, name: exact ? line.name : null, label: exact ? null : line.name, missing: true }),
        pick('Pick player'),
      ]);
    }

    // The cards that fit one slot, to pick the one that is in it in the game. A name narrows the list.
    function pickerView(res) {
      const p = state.picker;
      const line = slotLine(p.slot);
      const current = res.slots[p.index] && res.slots[p.index].picked ? res.slots[p.index].card : null;
      const row = (c) => {
        const version = H.fut.versionName ? H.fut.versionName(c.rarityId) : null;
        return el('button', { type: 'button', class: `pick${current && current.defId === c.defId ? ' chosen' : ''}`, onclick: () => { setPicked(p.setId, p.index, c); closePicker(); } }, [
          miniCard({ rarityId: c.rarityId, rating: c.rating, playerId: c.playerId, small: true, foil: c.foil, foilArt: c.foilArt }),
          el('span', { class: 'pick-text' }, [
            el('span', { class: 'name', text: `${c.name} ${c.rating}` }),
            el('span', { class: 'meta', text: [version, c.foil ? t('Holographic') : null, H.fut.leagueName(c.leagueId), H.fut.nationName(c.nationId)].filter(Boolean).join(' · ') }),
          ]),
          el('span', { class: 'pick-score' }, [el('strong', {}, [scoreIcon(), coins(c.score || 0)]), el('span', { class: 'muted', text: t('Item Score') })]),
        ]);
      };
      // Enter searches at once, even a name shorter than 3 letters.
      const submit = (e) => {
        e.preventDefault();
        clearTimeout(p.timer);
        const name = e.target.elements.name.value.trim();
        if (!name) return typePicker('');
        p.query = name;
        searchPicker(false);
      };
      return el('div', { class: 'picker' }, [
        el('div', { class: 'picker-head' }, [
          el('span', { class: 'name', text: t('Slot {n}: {name}', { n: p.index + 1, name: line.name }) }),
          el('span', { class: 'meta', text: line.meta }),
          el('span', { class: 'note', text: t('Pick the card that is in this slot in the game. Its Item Score and bonus tags then count for the set. Same card twice? Pick the one with the Item Score the game shows.') }),
        ]),
        el('form', { class: 'row', role: 'search', onsubmit: submit }, [
          el('input', { type: 'search', name: 'name', value: p.text, placeholder: t('Player name, 3 letters or more'), 'aria-label': t('Player name'), autocomplete: 'off', oninput: (e) => typePicker(e.target.value) }),
        ]),
        p.error ? el('p', { class: 'error', text: p.error }) : null,
        p.cards.length ? el('div', { class: 'picks' }, p.cards.map(row))
          : p.loading ? el('div', { class: 'picks', 'aria-hidden': 'true' }, [0, 1, 2, 3].map((n) => el('div', { class: 'pick-skel' }, [
            el('span', { class: 'slot skel' }, [Object.assign(miniCard({ small: true }), { style: `animation-delay: ${n * 120}ms` })]),
            el('span', { class: 'skel-text' }, [skelBar('45%', n), skelBar('30%', n)]),
          ])))
          : null,
        p.loading ? el('p', { class: 'muted', role: 'status' }, [spinner(), t('Searching EA…')])
          : !p.cards.length ? el('p', { class: 'muted', text: p.query ? t('No card fits this slot for "{query}".', { query: p.query })
            : t(!searchable(p.slot) ? 'Type a name: this slot takes any card, so FutFox needs a name to search.'
              : p.cleared ? 'Type 3 letters or more of a player name.' : 'No card fits this slot.') })
            : p.more ? el('button', { type: 'button', class: 'small', text: t('Show more'), onclick: () => searchPicker(true) }) : null,
        el('div', { class: 'row' }, [el('button', { type: 'button', text: t('Cancel'), onclick: closePicker })]),
      ]);
    }

    // A bonus tag the set's cards reach, or one a card or two short of its first tier.
    function tagCard(tag) {
      return el('div', { class: `tagc${tag.tier ? '' : ' near'}`, title: t(tag.rule) }, [
        tagIcon(tag.name, Boolean(tag.tier)),
        el('span', {}, [
          el('strong', { text: tag.tier ? `${t(tag.name)} +${tag.tier.percent}%` : t(tag.name) }),
          el('span', { class: 'meta', text: tag.tier
            ? [plural('card', tag.count), tag.next ? t('{count} for +{percent}%', tag.next) : t('top tier')].join(' · ')
            : t('{n} of {cards} for +{percent}%', { n: tag.count, cards: plural('card', tag.next.count), percent: tag.next.percent }) }),
        ]),
      ]);
    }

    // Suggest: the set's grades from its current one up, as diamonds (a set only counts as complete
    // with every slot filled, so even its current grade needs the empty slots). Pressing one finds
    // cards for the empty slots (first press only) and shows the plan for that grade in the slots.
    function suggestPlan(res) {
      const s = state.suggest && state.suggest.setId === res.id ? state.suggest : null;
      return s && s.options ? H.setMatch.planGrade(res, s.grade, s.options) : null;
    }

    function suggestBar(res, plan) {
      const from = res.grade ? H.setMatch.GRADES.indexOf(res.grade) : 0;
      const above = H.setMatch.GRADES.filter((g, i) => res.grades[g] != null && i >= from);
      const missing = res.slots.filter((e) => e.slot && !e.card && !e.done).length;
      if (!above.length || !missing) return null;
      const s = state.suggest && state.suggest.setId === res.id ? state.suggest : null;
      const press = (g) => (s && (s.options || s.loading) ? aimFor(res, g) : suggestCards(res, g));
      const best = plan && !plan.reached ? H.setMatch.gradeFor(plan.score, res.grades) : null;
      return el('div', { class: 'suggest' }, [
        el('div', { class: 'aim', role: 'group', 'aria-label': t('Suggest cards for a grade') }, [
          el('span', { class: 'label', text: t('Suggest cards for') }),
          ...above.map((g) => el('button', {
            type: 'button', class: `aimg g-${g}`, 'aria-pressed': String(Boolean(s) && s.grade === g), 'aria-label': t('Grade {grade}', { grade: g }),
            title: t('Grade {grade}: {n} Item Score', { grade: g, n: coins(res.grades[g]) }), onclick: () => press(g),
          }, [el('span', { class: 'dia', text: g })])),
          s ? el('button', { type: 'button', class: 'link', text: t('Clear'), onclick: () => { state.suggest = null; render(); } }) : null,
        ]),
        s && s.loading ? el('p', { class: 'muted', role: 'status' }, [spinner(), s.total ? t('Searching the squad builder list… {done} of {total}', { done: s.done, total: s.total }) : t('Looking in your club…')]) : null,
        s && s.error ? el('p', { class: 'error', text: t('{error} Some slots may have no suggestion.', { error: s.error }) }) : null,
        plan && !plan.adds.length ? el('p', { class: 'note', text: t('No card FutFox can find fits the empty slots.') }) : null,
        plan && plan.adds.length ? el('p', { class: 'sum' }, [
          `${t('{n} of {slots} filled: {from} → {to} Item Score', { n: plan.adds.length, slots: plural('empty slot', missing), from: coins(plan.from), to: coins(plan.score) })}${plan.bonus > res.bonus ? t(' with bonus tags') : ''} · `,
          plan.reached ? el('strong', { class: 'reached', text: t('Grade {grade} ✓', { grade: plan.grade }) }) : el('strong', { text: `${t('Grade {grade} is out of reach', { grade: plan.grade })}${best ? t(': grade {grade} at most', { grade: best }) : ''}` }),
        ]) : null,
        plan && plan.adds.length && plan.unfilled ? el('p', { class: 'note', text: t('No card to suggest for {slots}, and the set is only complete with all {total} filled. Use Pick player there.', { slots: plural('slot', plan.unfilled), total: res.total }) }) : null,
        plan ? el('p', { class: 'note', text: t('Suggestions only: place the cards in the game yourself, then use Pick player on their slots.') }) : null,
      ]);
    }

    function setPage(res) {
      // Your cards first, then suggested cards, then what is missing, then the slots ticked done in the game.
      const plan = suggestPlan(res);
      const suggested = new Map(plan ? plan.adds.map((a) => [a.index, a]) : []);
      const order = (e) => (e.card ? 0 : e.done ? 3 : suggested.has(e.index) ? 1 : 2);
      const entries = res.slots.map((e, index) => ({ ...e, index })).filter((e) => e.slot).sort((a, b) => order(a) - order(b) || a.index - b.index);
      const missing = entries.filter((e) => !e.card && !e.done).length;
      const active = res.tags.filter((t) => t.tier);
      // One card is always "1 copy" of itself, so Multiples! only counts as close from two copies.
      const close = res.tags.filter((t) => !t.tier && t.count > (t.name === 'Multiples!' ? 1 : 0) && t.next.count - t.count <= 2);
      return el('div', { class: 'set-page' }, [
        gradePanel(res),
        el('section', {}, [
          el('h3', { text: `${t('Cards · {have} of {total}', { have: res.have, total: res.total })}${missing ? t(' · {n} missing', { n: missing }) : ''}` }),
          suggestBar(res, plan),
          el('div', { class: 'cards' }, entries.map((e) => slotCell(res, e, suggested.get(e.index)))),
        ]),
        active.length || close.length ? el('section', {}, [
          el('h3', { text: res.bonus ? t('Bonus tags · +{n} Item Score', { n: coins(res.bonus) }) : t('Bonus tags') }),
          el('div', { class: 'tags' }, active.concat(close).map(tagCard)),
        ]) : null,
      ]);
    }

    function renderGallery(known) {
      const { data, loading, error } = state.sets;
      const results = data ? gallerySetResults(data) : [];
      const open = state.openSet != null && results.find((r) => r.id === state.openSet);
      if (open && state.picker && state.picker.setId === open.id) {
        const category = categoryOf(open);
        return [el('section', {}, [
          crumbs([[t('Categories'), () => { state.picker = null; go(null, null); }], [shownCategory(category), () => { state.picker = null; go(category, null); }], [open.name, closePicker], [t('Pick player')]]),
          pickerView(open),
        ])];
      }
      if (open) {
        const category = categoryOf(open);
        return [el('section', {}, [
          crumbs([[t('Categories'), () => go(null, null)], [shownCategory(category), () => go(category, null)], [open.name]]),
          setPage(open),
        ])];
      }
      const inCategory = state.category != null ? results.filter((r) => categoryOf(r) === state.category) : [];
      if (inCategory.length) {
        return [el('section', {}, [
          crumbs([[t('Categories'), () => go(null, null)], [shownCategory(state.category)]]),
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
        known ? null : clubPointer('Load your club in the Club tab so FutFox can check which cards you have.'),
        el('section', {}, [
          el('h2', { text: t('Gallery sets') }),
          el('div', { class: 'row' }, [
            loading ? el('span', { class: 'muted', role: 'status' }, [spinner(), t('Loading sets…')]) : el('span', { class: 'muted', text: data && data.sets.length ? t('{sets} · updated {day}', { sets: plural('set', data.sets.length), day: day(data.publishedAt) }) : t('No sets published yet') }),
            el('button', { class: 'small', type: 'button', text: t('Refresh sets'), disabled: loading, onclick: () => loadSets(true) }),
          ]),
          error ? el('p', { class: 'error', text: error }) : null,
                    results.length ? el('div', { class: 'sets' }, names.map((name) => categoryCard(name, categories.get(name))))
            : loading ? el('div', { class: 'sets', 'aria-hidden': 'true' }, [0, 1, 2, 3].map((n) => el('div', { class: 'cat skel', style: `animation-delay: ${n * 120}ms` }, [skelBar('40%', n), el('span', { class: 'skel-text' }, [skelBar('70%', n), skelBar('45%', n)])])))
            : null,
          results.length ? el('p', { class: 'note', text: t('Cards match on player, rating and version. "?" means FutFox can\'t check the version for that slot, so check it in the game. Cards you sold or used in an SBC still count in the Gallery: FutFox keeps every card it has seen in your club in this browser, and for older ones press Pick player to choose the card that is in the slot in the game. Loan cards never count. Bonus tags are worked out from the cards FutFox would use. Build and submit sets in the game.') }) : null,
        ]),
      ];
    }

    // A note on the SBC and Gallery tabs while the club isn't loaded, with a way to the Club tab.
    function clubPointer(text) {
      return el('div', { class: 'club-pointer' }, [
        el('span', { text: t(text) }),
        el('button', { class: 'small', type: 'button', text: t('Open Club'), onclick: () => setView('club') }),
      ]);
    }

    // The Club tab: loading the club, what FutFox keeps in this browser, and the language.
    function renderClub(known) {
      return [clubSection(known), savedDataSection(), languageSection()];
    }

    const TABS = ['club', 'sbc', 'gallery'];

    function setView(view) {
      setSetting('view', view);
      if (view === 'gallery' && !state.sets.data && !state.sets.loading) loadSets(false);
      else render();
    }

    // Where the panel is: its tab, and how deep in it (the challenge, then its squad; the Gallery's
    // categories, a category, a set, then picking a player).
    function pageNow(view, entry) {
      if (view === 'club') return 0;
      if (view === 'gallery') return state.picker && state.openSet != null ? 3 : state.openSet != null ? 2 : state.category != null ? 1 : 0;
      return state.solving || (state.result && state.showSquad) ? (entry ? 1 : 0) : 0;
    }

    // Moving to another page: the old page slides out and fades as the new one slides in from the
    // side it is reached from (going deeper, or to the tab on the right, comes from the right).
    function slidePages(old, next, dir, oldScroll) {
      Object.assign(old.style, { position: 'absolute', left: '0', right: '0', top: `${next.offsetTop}px`, height: `${next.offsetHeight}px`, pointerEvents: 'none' });
      panel.append(old);
      old.scrollTop = oldScroll;
      const dx = 36 * dir * (H.i18n.dir() === 'rtl' ? -1 : 1);
      old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dx}px)` }],
        { duration: 170, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }).finished.then(() => old.remove(), () => old.remove());
      next.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 280, delay: 70, easing: EASE, fill: 'backwards' });
    }

    // Puts the tab underline under the selected tab, sliding it there from the last one.
    function placeInk() {
      const ink = panel.querySelector('.tabs .ink');
      const tab = panel.querySelector('.tabs [aria-selected="true"]');
      // A folded panel has no layout to measure; it is placed again as it opens.
      if (!ink || !tab || !tab.offsetWidth) return;
      const to = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
      ink.style.transform = to;
      if (state.ink && state.ink !== to && isShown(panel) && !reducedMotion()) {
        ink.animate([{ transform: state.ink }, { transform: to }], { duration: 280, easing: EASE });
      }
      state.ink = to;
    }

    function render() {
      applyLang();
      // Rebuilding the panel keeps the scroll position, unless a set was just opened or closed.
      const before = panel.querySelector('.body');
      const oldScroll = before ? before.scrollTop : 0;
      const scroll = state.scrollTo != null ? state.scrollTo : before ? before.scrollTop : 0;
      state.scrollTo = null;
      // Keep typing in the name box while the panel rebuilds around it.
      const focused = panel.getRootNode().activeElement;
      const typing = focused && focused.matches('.picker input') ? [focused.selectionStart, focused.selectionEnd] : null;
      const entry = selected();
      const streamlined = Boolean(entry) && H.fut.isStreamlined(entry.challenge);
      const known = H.fut.knownClubItems().length;
      const view = TABS.includes(settings.view) && (settings.view !== 'gallery' || H.fut.galleryEnabled) ? settings.view : 'sbc';
      // The Gallery tab shows the Gallery Token until there is an art/gallery.png.
      const tabIcon = (name) => {
        if (name === 'club' && !ART.club) return clubIcon();
        const src = ART[name] || (name === 'gallery' ? ART.token : null);
        return src ? el('img', { src, alt: '' }) : null;
      };
      const tab = (name, label) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === name), onclick: () => setView(name) }, [tabIcon(name), label]);
      const page = { view, depth: pageNow(view, entry) };
      const last = state.page;
      state.page = page;
      panel.replaceChildren(...[
        grip,
        el('header', { title: t('Drag to move. Double-click to put it back.') }, [el('div', { class: 'brand' }, [foxIcon(), el('h1', { text: 'FutFox' })]), el('button', { class: 'close', type: 'button', 'aria-label': t('Minimize FutFox'), title: t('Minimize: fold into the corner'), text: '−', onclick: hidePanel })]),
        el('div', { class: 'tabs', role: 'tablist' }, [tab('club', t('Club')), tab('sbc', t('SBC')), H.fut.galleryEnabled ? tab('gallery', t('Gallery')) : null, el('span', { class: 'ink', 'aria-hidden': 'true' })]),
        view === 'club' ? el('div', { class: 'body' }, renderClub(known))
        : view === 'gallery' ? el('div', { class: 'body' }, renderGallery(known))
        : state.solving && entry ? el('div', { class: 'body' }, solvingPage(entry))
        : state.result && state.showSquad && entry ? el('div', { class: 'body' }, squadPage(entry))
        : el('div', { class: 'body' }, [
          el('section', {}, [
            el('h2', { text: t('Challenge') }),
            state.challenges.length
              ? challengeMenu()
              : el('p', { class: 'muted', text: t('Open an SBC set in the app, then press Refresh.') }),
            el('div', { class: 'row' }, [el('button', { type: 'button', text: t('Refresh'), onclick: refreshChallenges })]),
          ]),
          entry
            ? el('section', {}, [
                el('h2', { text: t('Requirements') }),
                el('ul', { class: 'rules' }, [
                  streamlined
                    ? el('li', { title: t('Points so far, of the points the challenge needs') }, [pointsIcon(), el('span', { text: t('{done} / {total}, up to {cards} a time', { done: coins(entry.challenge.submittedScore || 0), total: coins(entry.challenge.scoreRequirement || 0), cards: plural('card', H.fut.submitLimit()) }) })])
                    : null,
                  ...H.fut.rulesFor(entry.challenge).map((rule) => {
                    // The game's picker only lists cards that meet a Streamlined SBC's requirements.
                    if (streamlined) return el('li', {}, [el('span', { class: 'ok', text: '✓' }), el('span', { text: t('{rule} – the game only offers cards that meet it', { rule: rule.label }) })]);
                    // Match by key and value, since rulesFor() builds fresh objects each time.
                    const resultRule = state.result && state.result.rules.find((r) => r.key === rule.key && r.label === rule.label);
                    const st = ruleStatus(resultRule || rule);
                    return el('li', { title: st.hint }, [el('span', { class: st.cls, text: st.icon }), el('span', { text: rule.label + (st.hint ? ` – ${st.hint}` : '') })]);
                  }),
                ].filter(Boolean)),
              ])
            : null,
          streamlined || state.clubLoadedAt ? null : clubPointer('Load your club in the Club tab so FutFox can use every card you own.'),
          streamlined ? streamlinedOptions(entry) : squadOptions(),
          el('div', { class: 'row' }, [
            el('button', { class: 'primary', type: 'button', disabled: !entry || state.solving, onclick: solve }, state.solving ? [spinner(), t('Solving…')] : [t(streamlined ? 'Find cheapest cards' : 'Find cheapest squad')]),
            state.result ? el('button', { type: 'button', text: t('Show the last squad'), onclick: () => { state.showSquad = true; state.setupScroll = panel.querySelector('.body').scrollTop; state.scrollTo = 0; render(); } }) : null,
          ]),
          state.error ? el('p', { class: 'error', text: state.error }) : null,
        ]),
        el('footer', { text: t('Read-only: FutFox never buys, bids, lists or submits. Not affiliated with EA.') }),
      ].filter(Boolean));
      const body = panel.querySelector('.body');
      if (body) body.scrollTop = scroll;
      placeInk();
      const dir = !last ? 0 : last.view !== view ? Math.sign(TABS.indexOf(view) - TABS.indexOf(last.view)) : Math.sign(page.depth - last.depth);
      if (dir && before && body && isShown(panel) && !reducedMotion()) slidePages(before, body, dir, oldScroll);
      const box = typing && panel.querySelector('.picker input');
      if (box) {
        box.focus({ preventScroll: true });
        box.setSelectionRange(...typing);
      }
    }

    if (H.fut.galleryEnabled && settings.view === 'gallery') loadSets(false);
    else render();
    return { refresh: refreshChallenges };
  }

  H.panel = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
