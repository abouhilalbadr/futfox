// Minimal Firestore REST client for the Gallery scripts.
// Local by default: talks to the Firestore emulator, where "Bearer owner" skips the security rules.
// With --prod it talks to the real project, either with GOOGLE_ACCESS_TOKEN (for example from
// `gcloud auth print-access-token`, which a project owner's token is allowed past the rules) or,
// without one, by asking for an admin's email and password and writing as that admin.
import { createInterface } from 'node:readline';

export const PROJECT = 'futfox-gallery';
// The web app's public key, the same one the admin page uses.
const API_KEY = 'AIzaSyAV8AU5AHTW0v4wJ2gZICgWc3HNFSEz7PQ';

function ask(question, hidden) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    if (hidden) process.stdout.write('\n');
    resolve(answer);
  }));
}

async function signIn() {
  const email = (await ask('Admin email: ')).trim();
  const password = await ask('Password (not shown): ', true);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sign-in failed: ${data.error ? data.error.message : res.status}`);
  return data.idToken;
}

export async function target(argv) {
  if (!argv.includes('--prod')) {
    const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    return { prod: false, base: `http://${host}`, token: 'owner' };
  }
  const token = process.env.GOOGLE_ACCESS_TOKEN || (await signIn());
  return { prod: true, base: 'https://firestore.googleapis.com', token };
}

const toValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  throw new Error(`Unsupported value: ${typeof v}`);
};

// Replaces the whole document at path (for example "players/meta") with flat fields.
export async function setDoc(t, path, fields) {
  const url = `${t.base}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 403 && t.prod) throw new Error(`Writing ${path} was refused: this account isn't an admin yet (see the admin page).`);
  if (!res.ok) throw new Error(`Writing ${path} failed: ${res.status} ${await res.text()}`);
}
