// Copies EA's player list (the players.json the Web App loads) into Firestore for the admin's player search,
// and EA's card version names (from the Web App's text file) for its version list.
// Usage: node scripts/sync-players.mjs [--prod] [--content <folder id>]
// The admin page can do the same from the browser (Player list → Update).
// The folder id is part of the Web App's content address and can change when EA updates the Web App;
// find the current one in the Web App's network requests (…/web-app/content/<id>/2027/fut/items/web/players.json).
import { createRequire } from 'node:module';
import { target, setDoc } from './firestore-rest.mjs';

const require = createRequire(import.meta.url);
const { parseEaPlayers, parseEaVersions, parseEaClubs, parseEaLeagues, parseEaTeams, chunk, EA_CONTENT_ID, EA_VERSIONS_URL, PLAYER_CHUNK } = require('../store/futfox-site/admin/gallery-sets.js');

const argv = process.argv.slice(2);
const contentAt = argv.indexOf('--content');
const content = contentAt >= 0 ? argv[contentAt + 1] : EA_CONTENT_ID;
const source = `https://www.ea.com/ea-sports-fc/ultimate-team/web-app/content/${content}/2027/fut/items/web/players.json`;

const t = await target(argv);
const res = await fetch(source);
if (!res.ok) throw new Error(`EA's player list answered ${res.status}. Check the content folder id.`);
const rows = parseEaPlayers(await res.json());
if (rows.length < 1000) throw new Error(`Only ${rows.length} players came back; keeping the old list.`);

const chunks = chunk(rows, PLAYER_CHUNK);
for (const [i, part] of chunks.entries()) {
  await setDoc(t, `players/chunk-${i}`, { rows: JSON.stringify(part) });
}
await setDoc(t, 'players/meta', { count: rows.length, chunks: chunks.length, syncedAt: Date.now(), source });
console.log(`Copied ${rows.length} players in ${chunks.length} parts to the ${t.prod ? 'real project' : 'emulator'}.`);

const locRes = await fetch(EA_VERSIONS_URL);
if (!locRes.ok) throw new Error(`EA's text file answered ${locRes.status}; the version list was not updated.`);
const loc = JSON.parse((await locRes.text()).replace(/^\uFEFF/, ''));
const versions = parseEaVersions(loc);
if (versions.length < 20) throw new Error(`Only ${versions.length} versions came back; keeping the old list.`);
await setDoc(t, 'players/versions', { rows: JSON.stringify(versions), syncedAt: Date.now() });
// Club and league names, for club and league sets.
const clubs = parseEaClubs(loc);
const leagues = parseEaLeagues(loc);
await setDoc(t, 'players/clubs', { rows: JSON.stringify(clubs), syncedAt: Date.now() });
await setDoc(t, 'players/leagues', { rows: JSON.stringify(leagues), syncedAt: Date.now() });
console.log(`Copied ${versions.length} card versions, ${clubs.length} clubs and ${leagues.length} leagues.`);

// Which league each FC 27 club plays in, so club sets leave out clubs from older games.
const teamsSource = `https://www.ea.com/ea-sports-fc/ultimate-team/web-app/content/${content}/2027/fut/config/companion/teamconfig.json`;
const teamsRes = await fetch(teamsSource);
if (!teamsRes.ok) throw new Error(`EA's team list answered ${teamsRes.status}; the club leagues were not updated.`);
const teams = parseEaTeams(await teamsRes.json());
if (teams.length < 300) throw new Error(`Only ${teams.length} teams came back; keeping the old list.`);
await setDoc(t, 'players/teams', { rows: JSON.stringify(teams), syncedAt: Date.now() });
console.log(`Copied the leagues of ${teams.length} FC 27 teams.`);
