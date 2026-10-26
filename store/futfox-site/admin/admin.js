// Gallery admin: add, edit and publish the Gallery sets FutFox downloads.
// On localhost it talks to the Firebase emulators (npm run emulators), unless the address ends in ?live.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const S = window.FutFox.sets;

// Web app config. These values identify the project; access is controlled by firebase/firestore.rules.
const app = initializeApp({
  apiKey: 'AIzaSyAV8AU5AHTW0v4wJ2gZICgWc3HNFSEz7PQ',
  authDomain: 'futfox-gallery.firebaseapp.com',
  projectId: 'futfox-gallery',
  appId: '1:930615968695:web:155f5c57a5e1b8fb005e32',
});
const auth = getAuth(app);
const db = getFirestore(app);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('live');
if (LOCAL) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const state = {
  user: null,
  sets: [], // saved sets, each with its document id
  category: null, // the open category; null shows the category overview
  find: '', // text in the top bar's set search
  panel: null, // 'import' or 'ea' while that top bar panel is open
  selectedId: null,
  draft: null, // the set being edited
  isNew: false,
  dirty: false,
  pendingId: undefined, // set to open once unsaved changes are saved or discarded
  slotIndex: null,
  query: '',
  players: null, // [id, name, rating] rows from EA's player list
  playersMeta: null,
  versions: [], // [number, name] rows: EA's card versions, sorted by name
  places: { clubs: [], leagues: [], clubLeagues: [] }, // [id, name] rows: EA's club and league names; clubLeagues: [teamId, leagueId] for FC 27 teams
  publishedAt: 0,
  published: [], // the sets FutFox users get now, from the last publish
  notice: null, // { kind, text, list }
  confirmDelete: false,
  importOpen: false,
  importMessage: null, // { kind, text }
  setsImport: null, // { kind, text, list } after importing a sets file
};

const root = document.getElementById('app');

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children || [])) if (child) node.append(child);
  return node;
}

const fox = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#fox');
  svg.append(use);
  return svg;
};
const brand = () => el('div', { class: 'brand' }, [fox(), 'FutFox']);
const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const say = (kind, text, list) => { state.notice = { kind, text, list }; };
const HOME = Symbol('home'); // pendingId for going back to the overview
const BACK = Symbol('back'); // pendingId for going back to the open category's sets
const NO_CATEGORY = 'No category';
const categoryOf = (s) => s.group || NO_CATEGORY;

// What still looks unfinished in a set, shown as "Check" in the lists and counted on the category cards.
function checks(s) {
  const list = [];
  const empty = s.slotCount - S.filledCount(s);
  if (empty) list.push(`${empty} empty ${empty === 1 ? 'slot' : 'slots'}`);
  if (s.slots.some((x) => x && x.kind === 'rule' && x.version && x.rarityId == null && !(x.rarityIds || []).length)) list.push('unknown card version');
  if (S.GRADES.some((g) => (s.grades || {})[g] == null)) list.push('missing grades');
  return list;
}

// ---------- Sign-in ----------

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (!user) return renderGate();
  root.replaceChildren(el('p', { class: 'adm-loading', text: 'Checking your access…' }));
  const admin = await getDoc(doc(db, 'admins', user.uid)).then((d) => d.exists(), () => false);
  if (!admin) return renderNotAdmin(user);
  await loadAll();
  render();
});

// Accounts are added in Firebase (or by scripts/seed-emulator.mjs locally); there is no sign-up form.
function renderGate() {
  const message = el('p', { class: 'notice', hidden: true, role: 'status' });
  const show = (kind, text) => { message.className = `notice ${kind}`; message.textContent = text; message.hidden = false; };
  const email = el('input', { id: 'email', type: 'email', autocomplete: 'username', required: true });
  const password = el('input', { id: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const submit = el('button', { class: 'primary', type: 'submit', text: 'Sign in' });
  const form = el('form', {
    class: 'adm-form',
    onsubmit: async (e) => {
      e.preventDefault();
      submit.disabled = true;
      try {
        await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
      } catch (error) {
        show('bad', signInError(error));
        submit.disabled = false;
      }
    },
  }, [
    el('label', { for: 'email' }, [el('span', { text: 'Email' }), email]),
    el('label', { for: 'password' }, [el('span', { text: 'Password' }), password]),
    submit,
    el('button', {
      class: 'quiet', type: 'button', text: 'Forgot password',
      onclick: () => {
        if (!email.value.trim()) return show('warn', 'Enter your email first.');
        sendPasswordResetEmail(auth, email.value.trim())
          .then(() => show('ok', 'If that email has an account, a reset link is on its way.'))
          .catch((error) => show('bad', signInError(error)));
      },
    }),
  ]);
  root.replaceChildren(el('div', { class: 'adm-gate' }, [
    brand(),
    el('h1', { text: 'Gallery admin' }),
    LOCAL ? el('p', { text: 'Local mode: this signs in to the Firebase emulator, not the real project.' }) : null,
    form,
    message,
  ]));
  email.focus();
}

function signInError(error) {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return "That email and password don't match an account.";
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes, or reset your password.';
    case 'auth/network-request-failed':
      return LOCAL ? "Can't reach the emulator. Start it with npm run emulators." : "Can't reach Firebase. Check your connection.";
    default:
      return `Sign-in didn't work (${error.code || error.message}).`;
  }
}

// Nobody can make an account an admin from a browser, so the first admin is added in the
// Firebase console (or, locally, with scripts/make-admin.mjs).
function renderNotAdmin(user) {
  const steps = LOCAL
    ? [el('p', { text: 'To allow it, run this in the FutFox folder, then reload:' }), el('code', { text: `node scripts/make-admin.mjs ${user.uid}` })]
    : [
        el('ol', { class: 'steps' }, [
          el('li', {}, ['Open ', el('a', { href: 'https://console.firebase.google.com/project/futfox-gallery/firestore/databases/-default-/data', target: '_blank', rel: 'noopener', text: 'Firestore in the Firebase console' }), '.']),
          el('li', { text: 'Choose Start collection (or open "admins") and name it admins.' }),
          el('li', {}, ['Use this as the Document ID: ', el('code', { text: user.uid })]),
          el('li', { text: 'Add one field: addedAt, type number, any value. Save.' }),
          el('li', { text: 'Reload this page.' }),
        ]),
      ];
  root.replaceChildren(el('div', { class: 'adm-gate' }, [
    brand(),
    el('h1', { text: "This account can't edit sets yet" }),
    el('p', { text: `Signed in as ${user.email || user.uid}.` }),
    ...steps,
    el('button', { type: 'button', text: 'Sign out', onclick: () => signOut(auth) }),
  ]));
}

// ---------- Data ----------

async function loadAll() {
  const [setsSnap, gallery] = await Promise.all([getDocs(collection(db, 'sets')), getDoc(doc(db, 'public', 'gallery'))]);
  state.sets = setsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(bySetName);
  state.publishedAt = gallery.exists() ? gallery.data().publishedAt || 0 : 0;
  state.published = gallery.exists() ? gallery.data().sets || [] : [];
  if (state.selectedId && !state.sets.some((s) => s.id === state.selectedId)) state.selectedId = null;
  loadPlayers();
}

const bySetName = (a, b) => a.name.localeCompare(b.name);

async function loadPlayers() {
  const versions = await getDoc(doc(db, 'players', 'versions')).catch(() => null);
  state.versions = versions && versions.exists() ? JSON.parse(versions.data().rows).sort((a, b) => a[1].localeCompare(b[1])) : [];
  const rowsOf = async (name) => {
    const snap = await getDoc(doc(db, 'players', name)).catch(() => null);
    return snap && snap.exists() ? JSON.parse(snap.data().rows) : [];
  };
  state.places = { clubs: await rowsOf('clubs'), leagues: await rowsOf('leagues'), clubLeagues: await rowsOf('teams') };
  const meta = await getDoc(doc(db, 'players', 'meta')).catch(() => null);
  if (!meta || !meta.exists()) { state.playersMeta = null; state.players = []; refreshPlayerList(); return renderSlotEditor(); }
  state.playersMeta = meta.data();
  const parts = await Promise.all(Array.from({ length: state.playersMeta.chunks }, (_, i) => getDoc(doc(db, 'players', `chunk-${i}`))));
  state.players = parts.flatMap((p) => (p.exists() ? JSON.parse(p.data().rows) : []));
  refreshPlayerList();
  renderSlotEditor();
}

function openSet(id) {
  if (state.dirty) { state.pendingId = id; say('warn', 'This set has unsaved changes.'); return render(); }
  const saved = state.sets.find((s) => s.id === id);
  state.selectedId = id;
  state.draft = saved ? structuredClone(saved) : null;
  state.isNew = false;
  state.slotIndex = null;
  state.notice = null;
  state.confirmDelete = false;
  render();
}

// Opens a category from the overview, or a set found with the top bar search.
function openCategory(category, id) {
  state.category = category;
  if (id) return openSet(id);
  state.selectedId = null;
  state.draft = null;
  state.notice = null;
  render();
}

function goHome() {
  if (state.dirty) { state.pendingId = HOME; say('warn', 'This set has unsaved changes.'); return render(); }
  state.category = null;
  state.selectedId = null;
  state.draft = null;
  state.notice = null;
  render();
}

// From the set page back to its category's cards.
function closeSet() {
  if (state.dirty) { state.pendingId = BACK; say('warn', 'This set has unsaved changes.'); return render(); }
  state.selectedId = null;
  state.draft = null;
  state.slotIndex = null;
  state.notice = null;
  render();
}

function newSet() {
  if (state.dirty) { state.pendingId = null; say('warn', 'This set has unsaved changes.'); return render(); }
  state.selectedId = doc(collection(db, 'sets')).id;
  state.draft = { id: state.selectedId, ...S.emptySet('New set') };
  if (state.category && state.category !== NO_CATEGORY) state.draft.group = state.category;
  state.isNew = true;
  state.dirty = true;
  state.slotIndex = null;
  state.notice = null;
  render();
}

async function save() {
  const { set, errors } = S.normalizeSet(state.draft);
  if (errors.length) { say('bad', "This set can't be saved yet:", errors); return renderNotice(); }
  set.updatedAt = Date.now();
  try {
    await setDoc(doc(db, 'sets', state.selectedId), set);
  } catch (e) {
    say('bad', `Saving failed: ${e.code || e.message}`);
    return renderNotice();
  }
  const saved = { id: state.selectedId, ...set };
  state.sets = state.sets.filter((s) => s.id !== saved.id).concat(saved).sort(bySetName);
  state.draft = structuredClone(saved);
  state.category = categoryOf(saved); // follows the set when its category was changed
  state.isNew = false;
  state.dirty = false;
  say('ok', saved.status === 'live' ? 'Saved. Send it to FutFox from the bar at the top when you are ready.' : "Saved as a draft. FutFox users won't see it until it's Live and sent.");
  continuePending();
}

function discard() {
  state.dirty = false;
  if (state.isNew) { state.selectedId = null; state.draft = null; state.isNew = false; }
  else state.draft = structuredClone(state.sets.find((s) => s.id === state.selectedId));
  state.notice = null;
  continuePending();
}

function continuePending() {
  const next = state.pendingId;
  state.pendingId = undefined;
  if (next === undefined) return render();
  if (next === HOME) return goHome();
  if (next === BACK) return closeSet();
  if (next === null) return newSet();
  openSet(next);
}

async function removeSet() {
  if (!state.confirmDelete) {
    state.confirmDelete = true;
    render();
    setTimeout(() => { if (state.confirmDelete) { state.confirmDelete = false; render(); } }, 4000);
    return;
  }
  if (!state.isNew) {
    try { await deleteDoc(doc(db, 'sets', state.selectedId)); } catch (e) { say('bad', `Deleting failed: ${e.code || e.message}`); return renderNotice(); }
  }
  const id = state.selectedId;
  state.sets = state.sets.filter((s) => s.id !== id);
  state.selectedId = null;
  state.draft = null;
  state.dirty = false;
  state.isNew = false;
  state.confirmDelete = false;
  say('ok', state.published.some((p) => p.id === id) ? 'Set deleted. Send to FutFox to remove it there too.' : 'Set deleted.');
  render();
}

async function publish() {
  if (state.dirty) { say('warn', 'Save or discard your changes before sending to FutFox.'); return renderNotice(); }
  const bundle = S.publicBundle(state.sets, Date.now());
  try {
    await setDoc(doc(db, 'public', 'gallery'), bundle);
  } catch (e) {
    say('bad', `Sending to FutFox failed: ${e.code || e.message}`);
    return renderNotice();
  }
  state.publishedAt = bundle.publishedAt;
  state.published = bundle.sets;
  say('ok', `Sent to FutFox: ${bundle.sets.length} live ${bundle.sets.length === 1 ? 'set' : 'sets'}. Users get them within a day.`);
  render();
}

function change(mutate) {
  mutate(state.draft);
  state.dirty = true;
  state.confirmDelete = false;
  renderDirty();
}

// ---------- Layout ----------

function render() {
  const searching = document.activeElement && document.activeElement.id === 'find';
  root.replaceChildren(topBar(), topPanel(), publishBar(), state.draft ? setPage() : state.category != null ? categoryPage() : overview());
  if (searching) { const find = document.getElementById('find'); find.focus(); find.setSelectionRange(find.value.length, find.value.length); }
  // These parts redraw on their own while editing, without rebuilding the inputs around them.
  if (state.draft) { renderSlots(); renderSlotEditor(); }
  showPanel();
}

function renderNotice() {
  document.getElementById('notice')?.replaceWith(noticeBox());
}

function renderDirty() {
  const saveBtn = document.getElementById('save');
  if (saveBtn) saveBtn.textContent = state.dirty ? 'Save' : 'Saved';
  document.getElementById('publish-bar')?.replaceWith(publishBar());
  const crumb = document.getElementById('crumb-set');
  if (crumb) crumb.textContent = state.draft.name || 'New set';
}

// Redraws what the search box filters, without touching the box itself.
// On a set page, searching goes back to the cards (unless the set has unsaved changes).
function renderFound() {
  if (state.draft) {
    if (state.dirty) return;
    state.selectedId = null;
    state.draft = null;
    state.notice = null;
    return render();
  }
  document.querySelector('main')?.replaceWith(state.category != null ? categoryPage() : overview());
}

function togglePanel(name) {
  state.panel = state.panel === name ? null : name;
  for (const n of ['import', 'ea']) document.getElementById(`open-${n}`)?.replaceWith(panelButton(n));
  document.getElementById('top-panel')?.replaceWith(topPanel());
  showPanel();
}

function showPanel() {
  const dialog = document.getElementById('top-panel');
  if (dialog && state.panel && !dialog.open) dialog.showModal();
}

function panelButton(name) {
  const eaMissing = name === 'ea' && (!state.playersMeta || !state.places.clubs.length);
  return el('button', {
    type: 'button', id: `open-${name}`, class: eaMissing ? 'warn' : null, 'aria-expanded': String(state.panel === name), 'aria-controls': 'top-panel',
    text: name === 'import' ? 'Import sets' : eaMissing ? 'EA data · missing' : 'EA data', onclick: () => togglePanel(name),
  });
}

// Left: home and search. Right: data tools and the account menu. Publishing has its own bar below.
function topBar() {
  const who = state.user.email || state.user.uid;
  return el('header', { class: 'adm-top' }, [
    el('button', { type: 'button', class: 'home', title: 'All categories', onclick: goHome }, [brand()]),
    LOCAL ? el('span', { class: 'chip local', text: 'Local' }) : null,
    el('input', {
      type: 'search', class: 'find', id: 'find', placeholder: 'Search sets', 'aria-label': 'Search sets', autocomplete: 'off', value: state.find,
      oninput: (e) => { state.find = e.target.value; renderFound(); },
      onkeydown: (e) => { if (e.key === 'Escape' && state.find) { e.target.value = ''; state.find = ''; renderFound(); } },
    }),
    el('span', { class: 'spacer' }),
    el('div', { class: 'group', role: 'group', 'aria-label': 'Data' }, [panelButton('import'), panelButton('ea')]),
    el('details', { class: 'account' }, [
      el('summary', { 'aria-label': `Account: ${who}`, text: who.slice(0, 1).toUpperCase() }),
      el('div', { class: 'menu' }, [el('span', { class: 'who', text: who }), el('button', { class: 'quiet', type: 'button', text: 'Sign out', onclick: () => signOut(auth) })]),
    ]),
  ]);
}

// Import sets and EA data open in a modal; Escape, Close or a click outside it closes it.
function topPanel() {
  if (!state.panel) return el('div', { id: 'top-panel', hidden: true });
  return el('dialog', {
    id: 'top-panel', class: 'top-panel', 'aria-label': { import: 'Import sets', ea: 'EA data', category: 'New category' }[state.panel],
    onclick: (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); },
    onclose: (e) => { if (state.panel && e.currentTarget.isConnected) togglePanel(state.panel); }, // a replaced dialog's late close event is ignored
  }, [state.panel === 'import' ? setsImportBox() : state.panel === 'category' ? newCategoryBox() : playerListBox()]);
}

// What FutFox users have, and what sending would change. Only Live sets reach FutFox.
function publishBar() {
  const c = S.publishChanges(state.sets, state.published);
  const total = c.added.length + c.changed.length + c.removed.length;
  const live = state.published.length;
  if (!total) {
    return el('div', { id: 'publish-bar', class: 'publish-bar' }, [
      el('span', { text: state.publishedAt ? `FutFox is up to date: ${live} live ${live === 1 ? 'set' : 'sets'}, sent ${when(state.publishedAt)}.` : 'Nothing sent to FutFox yet.' }),
      el('span', { class: 'hint', text: 'Drafts stay here. Set a set to Live and save it to get it ready for FutFox.' }),
    ]);
  }
  const parts = [[c.added, 'new'], [c.changed, 'changed'], [c.removed, 'removed']].filter(([list]) => list.length);
  return el('div', { id: 'publish-bar', class: 'publish-bar ready' }, [
    el('details', {}, [
      el('summary', {}, [el('b', { text: 'Ready for FutFox: ' }), parts.map(([list, word]) => `${list.length} ${word}`).join(', ')]),
      el('ul', {}, parts.flatMap(([list, word]) => list.map((n) => el('li', { text: `${n} · ${word}` })))),
    ]),
    el('span', { class: 'spacer' }),
    state.dirty ? el('span', { class: 'hint', text: 'Save the open set first.' }) : null,
    el('button', { class: 'primary', type: 'button', text: 'Send to FutFox', disabled: state.dirty, onclick: publish }),
  ]);
}

const matches = (s) => !state.find.trim() || `${s.name} ${s.group || ''}`.toLowerCase().includes(state.find.trim().toLowerCase());

// The categories (the game's Gallery tabs) as cards, or every set the search finds.
function overview() {
  const categories = new Map();
  for (const s of state.sets) {
    const key = categoryOf(s);
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key).push(s);
  }
  const names = [...categories.keys()].sort((a, b) => (a === NO_CATEGORY) - (b === NO_CATEGORY) || a.localeCompare(b));
  const found = state.find.trim() ? [...state.sets].filter(matches).sort((a, b) => a.name.localeCompare(b.name) || categoryOf(a).localeCompare(categoryOf(b))) : null;
  const body = found
    ? [
        el('p', { class: 'count', text: `${found.length} ${found.length === 1 ? 'set matches' : 'sets match'} "${state.find.trim()}"` }),
        el('div', { class: 'found' }, found.map((s) => setRow(s, () => { state.find = ''; openCategory(categoryOf(s), s.id); }, true))),
      ]
    : names.length
      ? [el('div', { class: 'cards' }, names.map((name) => categoryCard(name, categories.get(name))))]
      : [el('p', { class: 'placeholder', text: 'No sets yet. Import a sets file, or add the first one with New set.' })];
  return el('main', { class: 'adm-home' }, [
    noticeBox(),
    el('div', { class: 'home-head' }, [
      el('h1', { text: found ? 'Search' : 'Categories' }),
      el('button', { type: 'button', text: '+ New category', onclick: () => togglePanel('category') }),
    ]),
    ...body,
  ]);
}

function categoryCard(name, sets) {
  const live = sets.filter((s) => s.status === 'live').length;
  const toCheck = sets.filter((s) => checks(s).length).length;
  return el('button', { type: 'button', class: 'cat-card', onclick: () => openCategory(name) }, [
    el('span', { class: 'name', text: name }),
    el('span', { class: 'meta' }, [`${live} of ${sets.length} live`, toCheck ? el('span', { class: 'check', text: ` · ${toCheck} to check` }) : null]),
    el('span', { class: 'bar', 'aria-hidden': 'true' }, [el('span', { style: `width: ${Math.round((live / sets.length) * 100)}%` })]),
  ]);
}

function setRow(s, onclick, withCategory) {
  const problems = checks(s);
  return el('button', { type: 'button', class: 'set-row', 'aria-current': String(s.id === state.selectedId), onclick }, [
    el('span', { class: 'name', text: s.name }),
    el('span', { class: 'chips' }, [
      problems.length ? el('span', { class: 'chip check', title: problems.join(', '), text: 'Check' }) : null,
      el('span', { class: `chip ${s.status}`, text: s.status === 'live' ? 'Live' : 'Draft' }),
    ]),
    el('span', { class: 'meta', text: [withCategory && categoryOf(s), `${S.filledCount(s)} of ${s.slotCount} slots`, ...problems.filter((p) => !p.includes('empty'))].filter(Boolean).join(' · ') }),
  ]);
}

function crumbs(parts) {
  const items = [];
  parts.forEach(([text, onclick, id], i) => {
    if (i) items.push(el('span', { class: 'sep', 'aria-hidden': 'true', text: '›' }));
    items.push(onclick ? el('button', { type: 'button', class: 'crumb', text, onclick }) : el('span', { class: 'crumb current', id, 'aria-current': 'page', text }));
  });
  return el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, items);
}

// The open category's sets as cards, filtered by the search.
function categoryPage() {
  const all = state.sets.filter((s) => categoryOf(s) === state.category);
  const shown = all.filter(matches);
  const live = all.filter((s) => s.status === 'live').length;
  return el('main', { class: 'adm-home' }, [
    crumbs([['Categories', goHome], [state.category]]),
    noticeBox(),
    el('div', { class: 'home-head' }, [
      el('div', {}, [
        el('h1', { text: state.category }),
        el('p', { class: 'count', text: state.find.trim() ? `${shown.length} of ${all.length} sets match "${state.find.trim()}"` : `${all.length} ${all.length === 1 ? 'set' : 'sets'} · ${live} live` }),
      ]),
      el('button', { type: 'button', text: '+ New set', onclick: newSet }),
    ]),
    shown.length
      ? el('div', { class: 'cards' }, shown.map(setCard))
      : el('p', { class: 'placeholder', text: all.length ? 'No set here matches the search.' : 'No sets in this category yet. Add one with New set.' }),
  ]);
}

function setCard(s) {
  const problems = checks(s);
  return el('button', { type: 'button', class: 'cat-card set-card', onclick: () => openSet(s.id) }, [
    el('span', { class: 'name', text: s.name }),
    el('span', { class: 'meta' }, [`${S.filledCount(s)} of ${s.slotCount} slots`, problems.length ? el('span', { class: 'check', text: ` · ${problems.filter((p) => !p.includes('empty')).join(', ') || 'check'}` }) : null]),
    el('span', { class: 'chips' }, [
      el('span', { class: `chip ${s.status}`, text: s.status === 'live' ? 'Live' : 'Draft' }),
      problems.length ? el('span', { class: 'chip check', title: problems.join(', '), text: 'Check' }) : null,
    ]),
  ]);
}

function setPage() {
  return el('main', { class: 'adm-page' }, [
    crumbs([['Categories', goHome], [state.category ?? categoryOf(state.draft), closeSet], [state.draft.name || 'New set', null, 'crumb-set']]),
    el('section', { class: 'adm-edit', id: 'editor', 'aria-label': 'Set editor' }, editor()),
  ]);
}

// ---------- Importing sets ----------
// A sets file (see importSets in gallery-sets.js) becomes draft sets; a set whose name is already in
// the same category is skipped.

function setsImportBox() {
  const r = state.setsImport;
  return el('div', { class: 'import', id: 'sets-import' }, [
    panelHead('Import sets'),
    el('p', { class: 'hint', text: 'A sets file made from your game screenshots. New sets arrive as drafts, so you can check them before you set them Live. A set already in the same category is skipped.' }),
    filePicker('sets-file', 'Choose a sets file', false, (files) => importSetsFile(files[0])),
    r ? el('div', { class: `notice ${r.kind}`, role: 'status' }, [
      el('span', { text: r.text }),
      r.list && r.list.length ? el('ul', {}, r.list.map((t) => el('li', { text: t }))) : null,
    ]) : null,
  ]);
}

// Shared parts of the top bar panels.
function panelHead(title) {
  return el('div', { class: 'head' }, [
    el('h2', { text: title }),
    el('button', { type: 'button', class: 'quiet', 'aria-label': `Close ${title}`, text: 'Close', onclick: () => togglePanel(state.panel) }),
  ]);
}

function filePicker(id, text, multiple, onfiles) {
  return el('label', { class: 'file-pick' }, [
    el('input', { type: 'file', id, accept: '.json,application/json', multiple, onchange: (e) => { if (e.target.files.length) onfiles(e.target.files); } }),
    el('span', { text }),
  ]);
}

// A category is only the name on its sets, so a new one starts with its first set.
function newCategoryBox() {
  const input = el('input', { id: 'category-name', autocomplete: 'off', maxlength: '80', placeholder: 'e.g. Eredivisie / Vrouwen Eredivisie', required: true });
  const message = el('p', { class: 'notice warn', role: 'status', hidden: true });
  return el('form', {
    class: 'import',
    onsubmit: (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      const existing = categoryNames().find((c) => c.toLowerCase() === name.toLowerCase());
      if (existing) { message.textContent = `${existing} already exists. Open it from the list to add a set there.`; message.hidden = false; return; }
      togglePanel('category');
      state.category = name;
      newSet();
    },
  }, [
    panelHead('New category'),
    el('p', { class: 'hint', text: "Use the category's name as the game shows it. It appears in the list once you save its first set." }),
    el('label', { for: 'category-name' }, [el('span', { text: 'Category name' }), input]),
    message,
    el('div', { class: 'row' }, [el('button', { type: 'submit', class: 'primary', text: 'Create and add its first set' })]),
  ]);
}

const categoryNames = () => [...new Set(state.sets.map((s) => s.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));

// Pick an existing category, so a typo can't start a second one by accident; "New category…" allows a new name.
function categoryField(d) {
  const names = categoryNames();
  const isNew = Boolean(d.group) && !names.includes(d.group);
  const input = el('input', { id: 'set-group-new', 'aria-label': 'New category name', value: isNew ? d.group : '', maxlength: '80', placeholder: 'New category name', hidden: !isNew, oninput: (e) => change((x) => { x.group = e.target.value.trim(); }) });
  const select = el('select', {
    id: 'set-group',
    onchange: (e) => {
      const value = e.target.value;
      input.hidden = value !== NEW_CATEGORY;
      if (value === NEW_CATEGORY) { input.focus(); change((x) => { x.group = input.value.trim(); }); }
      else change((x) => { x.group = value; });
    },
  }, [
    el('option', { value: '', text: NO_CATEGORY }),
    ...names.map((n) => el('option', { value: n, text: n })),
    el('option', { value: NEW_CATEGORY, text: 'New category…' }),
  ]);
  select.value = isNew ? NEW_CATEGORY : d.group || '';
  return el('label', { for: 'set-group', class: 'category-field' }, [el('span', { text: 'Category' }), select, input]);
}
const NEW_CATEGORY = '\u0000new';

async function importSetsFile(file) {
  const report = (kind, text, list) => { state.setsImport = { kind, text, list }; document.getElementById('sets-import')?.replaceWith(setsImportBox()); };
  if (!file) return;
  if (!state.players || !state.players.length) return report('bad', "Copy EA's player list first (Player list → Update).");
  if (state.dirty) return report('warn', 'Save or discard the open set first.');
  let json;
  try {
    json = JSON.parse((await file.text()).replace(/^﻿/, ''));
  } catch (e) {
    return report('bad', `${file.name} isn't a sets file (it isn't JSON).`);
  }
  if (!state.places.clubs.length) return report('bad', "Copy EA's text file again first (Player list, Update): club sets need its club names.");
  const results = S.importSets(json, state.players, state.versions, state.places);
  if (!results.length) return report('bad', `${file.name} has no sets in it.`);
  const key = (s) => `${(s.group || '').toLowerCase()}\n${s.name.toLowerCase()}`;
  const taken = new Set(state.sets.map(key));
  const notes = [];
  let added = 0;
  report('warn', 'Importing…');
  for (const { set, problems } of results) {
    if (!set.name) { notes.push('A set without a name was skipped.'); continue; }
    if (taken.has(key(set))) { notes.push(`${set.name}: already in ${set.group || 'the list'}, skipped.`); continue; }
    const id = doc(collection(db, 'sets')).id;
    set.updatedAt = Date.now();
    try {
      await setDoc(doc(db, 'sets', id), set);
    } catch (e) {
      notes.push(`${set.name}: saving failed (${e.code || e.message}).`);
      continue;
    }
    state.sets.push({ id, ...set });
    taken.add(key(set));
    added += 1;
    for (const p of problems) notes.push(`${set.name} · ${p}`);
  }
  state.sets.sort(bySetName);
  render();
  report(notes.length ? 'warn' : 'ok', `Imported ${added} ${added === 1 ? 'set as a draft' : 'sets as drafts'}.${notes.length ? ' Check these:' : ''}`, notes);
}

// ---------- EA's player list ----------
// EA doesn't let other sites read its files, so you open them, save them, and drop them here.

function playerListBox() {
  const meta = state.playersMeta;
  const count = (n, one, many) => el('li', { class: n ? null : 'missing' }, n ? [el('b', { text: n.toLocaleString() }), ` ${n === 1 ? one : many}`] : [`No ${many}`]);
  const msg = state.importMessage;
  return el('div', { class: 'import', id: 'player-list' }, [
    panelHead('EA data'),
    el('p', { class: 'hint', text: "Your copy of EA's player list, team list and text file. The admin uses it to find players for a slot, and to turn the card versions, clubs and leagues in a sets file into the ones FutFox checks." }),
    el('ul', { class: 'facts' }, [
      count(meta ? meta.count : 0, 'player', 'players'),
      count(state.versions.length, 'version', 'versions'),
      count(state.places.clubs.length, 'club', 'clubs'),
      count(state.places.leagues.length, 'league', 'leagues'),
      count(state.places.clubLeagues.length, 'FC 27 team', 'FC 27 teams'),
      el('li', { class: 'when', text: meta ? `Copied ${when(meta.syncedAt)}` : 'Never copied' }),
    ]),
    state.importOpen
      ? el('div', { class: 'update' }, [
          el('ol', { class: 'steps' }, [
            el('li', {}, ['Open ', el('a', { href: S.EA_PLAYERS_URL, target: '_blank', rel: 'noopener', text: "EA's player list" }), ', ', el('a', { href: S.EA_TEAMS_URL, target: '_blank', rel: 'noopener', text: "team list" }), ' and ', el('a', { href: S.EA_VERSIONS_URL, target: '_blank', rel: 'noopener', text: "text file" }), '.']),
            el('li', { text: 'Save each one with Cmd+S (Ctrl+S on Windows).' }),
            el('li', {}, ['Pick the saved files: ', filePicker('ea-files', 'Choose files', true, importFiles)]),
          ]),
          el('p', { class: 'hint', text: "If the player list link shows an error, EA moved it: in the Web App, find players.json in the browser's network requests and save that one." }),
          el('button', { type: 'button', class: 'quiet', text: 'Cancel', onclick: () => { state.importOpen = false; state.importMessage = null; refreshPlayerList(); } }),
        ])
      : el('div', { class: 'row' }, [
          el('button', { type: 'button', text: 'Update from EA', onclick: () => { state.importOpen = true; state.importMessage = null; refreshPlayerList(); } }),
          el('span', { class: 'hint', text: 'Only needed when EA adds new players or card versions.' }),
        ]),
    msg ? el('p', { class: `notice ${msg.kind}`, role: 'status', text: msg.text }) : null,
  ]);
}

function refreshPlayerList() {
  document.getElementById('player-list')?.replaceWith(playerListBox());
  document.getElementById('open-ea')?.replaceWith(panelButton('ea')); // it says when the data is missing
}

async function importFiles(files) {
  const report = (kind, text) => { state.importMessage = { kind, text }; refreshPlayerList(); };
  let players = null;
  let versions = null;
  let places = null;
  let teams = null;
  for (const file of Array.from(files || [])) {
    let json;
    try {
      json = JSON.parse((await file.text()).replace(/^﻿/, ''));
    } catch (e) {
      return report('bad', `${file.name} isn't one of EA's files (it isn't JSON).`);
    }
    const kind = S.eaFileKind(json);
    if (kind === 'players') players = S.parseEaPlayers(json);
    else if (kind === 'teams') teams = S.parseEaTeams(json);
    else if (kind === 'versions') {
      versions = S.parseEaVersions(json);
      places = { clubs: S.parseEaClubs(json), leagues: S.parseEaLeagues(json) };
    }
    else return report('bad', `${file.name} isn't EA's player list, team list or text file.`);
  }
  if (players && players.length < 1000) return report('bad', `The player list only has ${players.length} players; nothing was changed.`);
  if (versions && versions.length < 20) return report('bad', `The text file only names ${versions.length} versions; nothing was changed.`);
  if (teams && teams.length < 300) return report('bad', `The team list only has ${teams.length} teams; nothing was changed.`);
  if (!players && !versions && !teams) return report('warn', 'Pick the saved files first.');
  report('warn', 'Copying…');
  try {
    if (players) {
      const parts = S.chunk(players, S.PLAYER_CHUNK);
      for (const [i, part] of parts.entries()) await setDoc(doc(db, 'players', `chunk-${i}`), { rows: JSON.stringify(part) });
      const meta = { count: players.length, chunks: parts.length, syncedAt: Date.now(), source: S.EA_PLAYERS_URL };
      await setDoc(doc(db, 'players', 'meta'), meta);
      state.players = players;
      state.playersMeta = meta;
    }
    if (versions) {
      await setDoc(doc(db, 'players', 'versions'), { rows: JSON.stringify(versions), syncedAt: Date.now() });
      state.versions = versions.slice().sort((a, b) => a[1].localeCompare(b[1]));
      await setDoc(doc(db, 'players', 'clubs'), { rows: JSON.stringify(places.clubs), syncedAt: Date.now() });
      await setDoc(doc(db, 'players', 'leagues'), { rows: JSON.stringify(places.leagues), syncedAt: Date.now() });
      state.places = { ...state.places, ...places };
    }
    if (teams) {
      await setDoc(doc(db, 'players', 'teams'), { rows: JSON.stringify(teams), syncedAt: Date.now() });
      state.places = { ...state.places, clubLeagues: teams };
    }
  } catch (e) {
    return report('bad', `Copying failed: ${e.code || e.message}`);
  }
  state.importOpen = false;
  report('ok', [players && `${players.length.toLocaleString()} players`, versions && `${versions.length} versions, ${places.clubs.length.toLocaleString()} clubs and ${places.leagues.length} leagues`, teams && `the leagues of ${teams.length} FC 27 teams`].filter(Boolean).join(', ') + ' copied.');
  renderSlotEditor();
}

function noticeBox() {
  const n = state.notice;
  if (!n) return el('div', { id: 'notice', hidden: true });
  const actions = state.pendingId !== undefined && state.dirty ? [
    el('button', { type: 'button', class: 'primary', text: 'Save', onclick: save }),
    el('button', { type: 'button', text: 'Discard changes', onclick: discard }),
  ] : [];
  return el('div', { id: 'notice', class: `notice ${n.kind}`, role: 'status' }, [
    el('span', { text: n.text }),
    n.list ? el('ul', {}, n.list.map((t) => el('li', { text: t }))) : null,
    ...actions,
  ]);
}

// ---------- Editor ----------

function editor() {
  const d = state.draft;
  if (!d) return [noticeBox(), el('p', { class: 'placeholder', text: state.sets.length ? 'Pick a set on the left, or add a new one.' : 'No sets here yet. Add one with New set.' })];
  return [
    el('div', { class: 'edit-head' }, [
      el('input', { class: 'title', id: 'set-name', 'aria-label': 'Set name', value: d.name, maxlength: '80', oninput: (e) => change((x) => { x.name = e.target.value; }) }),
      statusToggle(d),
      el('button', { id: 'save', class: 'primary', type: 'button', text: state.dirty ? 'Save' : 'Saved', onclick: save }),
      el('button', { class: 'danger', type: 'button', text: state.confirmDelete ? 'Confirm delete' : 'Delete', onclick: removeSet }),
    ]),
    noticeBox(),
    el('div', { class: 'fields' }, [
      categoryField(d),
      field('Slots', 'set-slots', d.slotCount, '20', (v) => { change((x) => resizeSlots(x, v)); renderSlots(); }, 'number'),
      field('Gallery Tokens', 'set-tokens', d.tokens, '0', (v) => change((x) => { x.tokens = Number(v) || 0; }), 'number'),
    ]),
    el('section', { 'aria-labelledby': 'slots-title' }, [
      el('div', { class: 'section-head' }, [el('h2', { id: 'slots-title', text: 'Slots' }), el('span', { class: 'count', id: 'slot-count' })]),
      el('div', { class: 'slots', id: 'slots' }),
    ]),
    el('div', { id: 'slot-editor' }),
    el('section', { 'aria-labelledby': 'grades-title' }, [
      el('div', { class: 'section-head' }, [el('h2', { id: 'grades-title', text: 'Grades' }), el('span', { class: 'count', text: 'Lowest total Item Score for each grade, and what it gives' })]),
      el('div', { class: 'grades' }, S.GRADES.map((g) => el('div', { class: 'grade' }, [
        field(`Grade ${g}`, `grade-${g}`, d.grades[g] ?? '', '', (v) => change((x) => { x.grades[g] = v === '' ? null : Number(v); }), 'number'),
        field(`${g} reward`, `reward-${g}`, (d.rewards || {})[g] ?? '', 'e.g. 2 tokens', (v) => change((x) => { x.rewards = { ...x.rewards, [g]: v }; })),
      ]))),
    ]),
    el('section', { 'aria-labelledby': 'tags-title' }, [
      el('div', { class: 'section-head' }, [el('h2', { id: 'tags-title', text: 'Bonus tags' })]),
      el('p', { class: 'hint', text: "Nothing to fill in: every set uses the game's same 21 bonus tags, and FutFox works out which ones a player's cards reach." }),
    ]),
  ];
}

function statusToggle(d) {
  const opt = (value, label) => el('button', {
    type: 'button', 'aria-pressed': String(d.status === value), text: label,
    onclick: (e) => { change((x) => { x.status = value; }); for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target)); },
  });
  return el('div', { class: 'seg', role: 'group', 'aria-label': 'Status' }, [opt('draft', 'Draft'), opt('live', 'Live')]);
}

function field(label, id, value, placeholder, onValue, type) {
  return el('label', { for: id }, [
    el('span', { text: label }),
    el('input', { id, type: type || 'text', value: value ?? '', placeholder, inputmode: type === 'number' ? 'numeric' : null, min: type === 'number' ? '0' : null, oninput: (e) => onValue(e.target.value) }),
  ]);
}

function resizeSlots(d, value) {
  const count = Math.min(S.MAX_SLOTS, Math.max(1, Math.round(Number(value)) || 1));
  d.slotCount = count;
  d.slots = Array.from({ length: count }, (_, i) => d.slots[i] || null);
  if (state.slotIndex != null && state.slotIndex >= count) state.slotIndex = null;
}

function renderSlots() {
  const grid = document.getElementById('slots');
  if (!grid) return;
  const d = state.draft;
  document.getElementById('slot-count').textContent = `${S.filledCount(d)} of ${d.slotCount} filled`;
  grid.replaceChildren(...d.slots.map((slot, i) => {
    const kind = !slot ? 'empty' : slot.kind;
    const body = !slot
      ? [el('span', { class: 'no', text: `Slot ${i + 1}` }), el('span', { text: '+ Add' })]
      : slot.kind === 'card'
        ? [el('span', { class: 'no', text: `Slot ${i + 1}` }), el('span', { class: 'rt', text: slot.rating ?? '–' }), el('span', { class: 'nm', text: slot.name }), el('span', { class: 'vr', text: slot.version || 'Any version' })]
        : [el('span', { class: 'no', text: `Slot ${i + 1} · rule` }), el('span', { class: 'nm', text: slot.label }), el('span', { class: 'vr', text: ruleSummary(slot) })];
    return el('button', { type: 'button', class: `slot ${kind}`, 'aria-pressed': String(state.slotIndex === i), onclick: () => { state.slotIndex = state.slotIndex === i ? null : i; state.query = ''; renderSlots(); renderSlotEditor(); } }, body);
  }));
}

function ruleSummary(slot) {
  const leagues = (slot.leagueIds || []).map((id) => (state.places.leagues.find((r) => r[0] === id) || [id, `League ${id}`])[1]);
  const parts = [slot.foil && 'Holographic finish', slot.version, leagues.length && Array.from(new Set(leagues)).join(' or '), slot.leagueId && `League ${slot.leagueId}`, slot.nationId && `Nation ${slot.nationId}`, slot.minRating && `${slot.minRating}+`];
  return parts.filter(Boolean).join(' · ') || 'Any card';
}

function setSlot(value) {
  change((x) => { x.slots[state.slotIndex] = value; });
  renderSlots();
}

function renderSlotEditor() {
  const box = document.getElementById('slot-editor');
  if (!box) return;
  const i = state.slotIndex;
  if (i == null || !state.draft) return box.replaceChildren();
  const slot = state.draft.slots[i];
  const kind = slot && slot.kind === 'rule' ? 'rule' : 'card';
  const pick = (k) => el('button', {
    type: 'button', 'aria-pressed': String(kind === k), text: k === 'card' ? 'Exact card' : 'Rule',
    onclick: () => { if (kind !== k) setSlot(k === 'rule' ? { kind: 'rule', label: 'Any card', rarityId: null, version: '', leagueId: null, nationId: null, minRating: null } : null); renderSlotEditor(); },
  });
  box.replaceChildren(el('div', { class: 'slot-editor' }, [
    el('div', { class: 'row' }, [
      el('h2', { class: 'grow', text: `Slot ${i + 1}` }),
      el('div', { class: 'seg', role: 'group', 'aria-label': 'Slot type' }, [pick('card'), pick('rule')]),
      el('button', { type: 'button', class: 'quiet', text: 'Clear slot', onclick: () => { setSlot(null); renderSlotEditor(); } }),
      el('button', { type: 'button', text: 'Done', onclick: () => { state.slotIndex = null; renderSlots(); renderSlotEditor(); } }),
    ]),
    ...(kind === 'card' ? cardFields(slot) : ruleFields(slot)),
  ]));
}

function cardFields(slot) {
  const results = el('div', { class: 'results', id: 'player-results' });
  const showResults = () => {
    if (!state.players) return results.replaceChildren(el('p', { class: 'hint', text: "Loading EA's player list…" }));
    if (!state.players.length) return results.replaceChildren(el('p', { class: 'hint', text: "EA's player list isn't copied yet. Run npm run sync-players, then reload." }));
    const hits = S.searchPlayers(state.players, state.query, 8);
    results.replaceChildren(...(state.query.trim() && !hits.length ? [el('p', { class: 'hint', text: 'No player matches that name.' })] : hits.map(([id, name, rating]) => el('button', {
      type: 'button',
      onclick: () => { setSlot({ kind: 'card', playerId: id, name, rating, rarityId: slot ? slot.rarityId : null, version: slot ? slot.version : '' }); state.query = ''; renderSlotEditor(); },
    }, [el('span', { class: 'rt', text: rating }), el('span', { text: name }), el('span', { class: 'id', text: `id ${id}` })]))));
  };
  showResults();
  const source = state.playersMeta ? `${state.playersMeta.count.toLocaleString()} players, copied ${when(state.playersMeta.syncedAt)}` : '';
  return [
    el('label', { for: 'player-search' }, [
      el('span', { text: slot ? 'Change player' : 'Find the player' }),
      el('input', { id: 'player-search', type: 'search', placeholder: 'Saka, or a player id', autocomplete: 'off', value: state.query, oninput: (e) => { state.query = e.target.value; showResults(); } }),
    ]),
    source ? el('p', { class: 'hint', text: `From EA's player list: ${source}. Ratings there are base ratings.` }) : null,
    results,
    slot ? el('p', { class: 'picked', text: `Picked: ${slot.name} (id ${slot.playerId})` }) : null,
    slot ? el('div', { class: 'fields' }, [
      versionField('slot-version', slot),
      field('Rating of this version', 'slot-rating', slot.rating, '89', (v) => setSlot({ ...state.draft.slots[state.slotIndex], rating: v === '' ? null : Number(v) }), 'number'),
    ]) : null,
  ];
}

// EA's card versions (copied by scripts/sync-players.mjs). The slot keeps the number FutFox
// matches on (rarityId) and the name for display.
function versionField(id, slot) {
  // An imported rule can accept several versions; it stays that way until one version is picked.
  const many = slot.rarityIds || [];
  const options = [
    many.length ? el('option', { value: 'many', text: `${slot.version || 'Several'}: ${many.length} versions` }) : null,
    el('option', { value: '', text: 'Any version' }),
  ].concat(state.versions.map(([number, name]) => el('option', { value: String(number), text: `${name} (${number})` })));
  const select = el('select', {
    id,
    onchange: (e) => {
      if (e.target.value === 'many') return;
      const number = e.target.value === '' ? null : Number(e.target.value);
      const match = state.versions.find((v) => v[0] === number);
      setSlot({ ...state.draft.slots[state.slotIndex], rarityId: number, rarityIds: [], version: match ? match[1] : '' });
    },
  }, options);
  select.value = many.length ? 'many' : slot.rarityId == null ? '' : String(slot.rarityId);
  const stale = !many.length && slot.rarityId == null && slot.version;
  const names = many.map((n) => (state.versions.find((v) => v[0] === n) || [n, `Version ${n}`])[1]);
  return el('label', { for: id }, [
    el('span', { text: 'Version' }),
    select,
    !state.versions.length ? el('span', { class: 'hint', text: "EA's version list isn't copied yet. Run npm run sync-players." }) : null,
    many.length ? el('span', { class: 'hint', text: `Any of: ${names.join(', ')}` }) : null,
    stale ? el('span', { class: 'hint', text: `"${slot.version}" has no number in EA's list, so FutFox asks to check it in the game.` }) : null,
  ]);
}

function ruleFields(slot) {
  const update = (key, number) => (v) => setSlot({ ...state.draft.slots[state.slotIndex], [key]: number ? (v === '' ? null : Number(v)) : v });
  return [
    el('div', { class: 'fields' }, [
      field('Label', 'rule-label', slot.label, 'Any TOTW from LALIGA', update('label')),
      versionField('rule-version', slot),
      field('League id', 'rule-league', slot.leagueId, '53', update('leagueId', true), 'number'),
      field('Nation id', 'rule-nation', slot.nationId, '', update('nationId', true), 'number'),
      field('Lowest rating', 'rule-rating', slot.minRating, '', update('minRating', true), 'number'),
      el('label', { class: 'check-field', for: 'rule-foil' }, [
        el('input', { type: 'checkbox', id: 'rule-foil', checked: slot.foil === true, onchange: (e) => { const next = { ...state.draft.slots[state.slotIndex] }; if (e.target.checked) next.foil = true; else delete next.foil; setSlot(next); } }),
        el('span', { text: 'Holographic only' }),
      ]),
    ]),
    placesHint(slot),
    el('p', { class: 'hint', text: 'Any card that matches every filled field fills this slot.' }),
  ];
}

// Clubs and leagues an imported club or league set accepts (kept until the slot is cleared).
function placesHint(slot) {
  const named = (ids, rows) => ids.map((id) => (rows.find((r) => r[0] === id) || [id, `#${id}`])[1]);
  const clubs = slot.clubIds || [];
  const leagues = slot.leagueIds || [];
  if (!clubs.length && !leagues.length) return null;
  return el('p', { class: 'hint', text: [
    clubs.length && `Clubs: ${Array.from(new Set(named(clubs, state.places.clubs))).join(', ')}`,
    leagues.length && `Leagues: ${Array.from(new Set(named(leagues, state.places.leagues))).join(', ')}`,
  ].filter(Boolean).join(' · ') });
}
