// Creates a local admin account in the Firebase emulators so the admin page can be tried without the real project.
// Emulator only: these sign-in details exist nowhere else.
// Usage: npm run emulators (in another terminal), then node scripts/seed-emulator.mjs
import { target, setDoc } from './firestore-rest.mjs';

export const LOCAL_ADMIN = { email: 'admin@futfox.test', password: 'futfox-local-only' };

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const api = (method) => `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=emulator`;

async function call(method, body) {
  const res = await fetch(api(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json() };
}

const account = { ...LOCAL_ADMIN, returnSecureToken: true };
let result = await call('signUp', account);
if (!result.ok && result.data.error && result.data.error.message === 'EMAIL_EXISTS') result = await call('signInWithPassword', account);
if (!result.ok) throw new Error(`The auth emulator answered: ${JSON.stringify(result.data.error || result.data)}`);

await setDoc(await target([]), `admins/${result.data.localId}`, { addedAt: Date.now() });
console.log(`Local admin ready: ${LOCAL_ADMIN.email} (password in scripts/seed-emulator.mjs).`);
