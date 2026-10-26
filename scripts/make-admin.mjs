// Lets one signed-in account edit Gallery sets. The admin page shows the account id to use.
// Usage: node scripts/make-admin.mjs <account id> [--prod]
import { target, setDoc } from './firestore-rest.mjs';

const argv = process.argv.slice(2);
const uid = argv.find((a) => !a.startsWith('--'));
if (!uid || !/^[A-Za-z0-9]{6,128}$/.test(uid)) throw new Error('Pass the account id shown on the admin page.');

const t = await target(argv);
await setDoc(t, `admins/${uid}`, { addedAt: Date.now() });
console.log(`${uid} can now edit Gallery sets in the ${t.prod ? 'real project' : 'emulator'}.`);
