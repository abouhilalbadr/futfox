# Developing FutFox

## Tests

```bash
npm test
```

No dependencies or build step. The core files run in Node for tests and in the page as
plain scripts (they attach to `window.FutFox`). `test/read-only.test.js` fails if any source
file calls an account-changing Web App method.

## How it works

| File | Role |
| --- | --- |
| `src/core/requirements.js` | Reads SBC rules from the app's `UTSBCEligibilityDTO` data and measures how far a squad is from each one. |
| `src/core/rating.js` | Squad rating, ported from the app's `UTSquadEntity._calculateRating`. |
| `src/core/chemistry.js` | Fast chemistry estimate using the live thresholds and chemistry profiles. |
| `src/core/solver.js` | Simulated annealing over the 11 slots to find the cheapest squad that meets every rule. |
| `src/page/fut-adapter.js` | Everything that touches the Web App: SBCs, club, names, EA's own chemistry check, market pre-fill. |
| `src/page/panel.js` | The side panel, in a shadow root. |
| `src/page/main.js` | Waits for the app to load, then adds the panel. |

Cost model: an untradeable card costs 15% of its rating's price estimate (it could never be
sold). A tradeable card costs the app's market average when known, otherwise the estimate.
The estimates in `DEFAULT_PRICES` (`src/core/solver.js`) are rough and only rank options.

When every card in the answer is from your club, the panel shows EA's own chemistry
calculation. With cards to buy, chemistry is an estimate.

Not supported yet (shown with a "?" so you check them yourself): rarity groups such as TOTW,
first-owner and tradability rules, combined requirements, and SBCs with pre-filled slots.

## Gallery sets

The **Gallery** tab lists the Gallery sets published from the admin page and, for each set,
which slots your club covers and which cards are missing. FutFox downloads the published sets
once a day from FutFox's Firestore document, sending nothing with the request, and keeps a copy
in the page's local storage (`futfox.gallerySets`). Exact-card slots match on EA's player id and
the card's rating; rule slots match on league, nation and lowest rating, and are marked "?" when
they name a version FutFox can't check.

To test against the emulators, set `futfox.dev.setsUrl` in the page's local storage to
`http://127.0.0.1:8080/v1/projects/futfox-gallery/databases/(default)/documents/public/gallery`.

## Gallery sets admin

Gallery sets are kept in Firebase (project `futfox-gallery`, Firestore in `eur3`) and edited at
`/admin` on the website. `firebase/firestore.rules` lets anyone read the published sets
(`public/gallery`, the document FutFox downloads) and only admins (`admins/{uid}`) edit sets,
publish, or read the player list. Admins sign in with email and password; accounts are added in
the Firebase console and there is no sign-up form.

The player search uses EA's own player list (`players.json`, loaded by the Web App), copied into
`players/*` by `scripts/sync-players.mjs`. The address of that file contains a content folder id
that can change when EA updates the Web App; pass the new one with `--content <id>`.

Try it locally (the admin page talks to the emulators whenever it runs on localhost):

```bash
npm run emulators
```

Then, in a second terminal:

```bash
npm run sync-players && node scripts/seed-emulator.mjs
```

Serve `store/futfox-site` on localhost and open `/admin/`. The local admin account is in
`scripts/seed-emulator.mjs`. The emulators need Java 21 or newer (`JAVA_HOME`). Open
`/admin/?live` instead to edit the real project from localhost.

For the real project, `scripts/sync-players.mjs --prod` and `scripts/make-admin.mjs <uid> --prod`
write with an owner's access token in `GOOGLE_ACCESS_TOKEN`.

## Website

The site lives in `store/futfox-site` (home page and privacy policy, plain HTML and CSS) and is
live at https://futfox-site.vercel.app. Vercel deploys it from GitHub with `store/futfox-site`
as the project's root directory: every push to `main` goes live, and pull requests get preview
links. `vercel.json` turns on clean URLs so `/privacy` serves `privacy.html`.

`scripts/build-site.sh` copies the icons, a Latin subset of the Inter font, the share image and
the step screenshots (made from the real panel by `scripts/capture-screens.sh`) into
`store/futfox-site/assets`. The copies are committed; rerun the script and commit the result
when any of them change. Bump the `?v=` on `site.css` and `site.js` in the HTML when you change
them, so browsers fetch the new files.

## Checks on GitHub

- **Tests** (`.github/workflows/tests.yml`) runs `npm test` on every push to `main` and every
  pull request.
- **CodeQL** (`.github/workflows/codeql.yml`) scans the JavaScript on pushes, pull requests and
  once a week; findings appear under the repository's Security tab.
- **Scorecard** (`.github/workflows/scorecard.yml`) publishes the OpenSSF Scorecard score shown
  in the README.
