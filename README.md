# FutFox

A Chrome extension for the EA SPORTS FC 27 Ultimate Team Web App. It suggests the
cheapest way to complete a Squad Building Challenge using your own club first. Where your
club falls short, it opens the Transfer Market search with the filters already filled in.

It is read-only. It never bids, buys, lists, moves, saves a squad or submits an SBC. The
only request it makes is the paged club list when you press **Load my club**, the same
request the Club screen makes, spaced a few seconds apart. `test/read-only.test.js` fails if
any source file calls an account-changing Web App method.

Not affiliated with or endorsed by EA. Third-party tools are against EA's user agreement,
so use it at your own risk.

## Install (unpacked)

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Open the [Web App](https://www.ea.com/ea-sports-fc/ultimate-team/web-app/) and sign in.
   A **FutFox** button appears at the bottom right once the app has loaded.

## Use

1. Open an SBC set in the Web App so its requirements load, then open the panel.
2. Press **Load my club** once per session.
3. Pick the challenge and press **Find cheapest squad**.
4. For each card to buy, **Search market** opens the market search with quality, position,
   league and nation set. The market screen has no rating filter, so look for the rating
   the panel shows. You press Search and Buy yourself.

The **Gallery** tab lists the Gallery sets published from the admin page (see "Gallery sets
admin") and, for each set, which slots your club covers and which cards are missing. FutFox
downloads the published sets once a day from FutFox's Firestore document, sending nothing with
the request, and keeps a copy in the page's local storage (`futfox.gallerySets`). Exact-card
slots match on EA's player id and the card's rating; rule slots match on league, nation and
lowest rating, and are marked "?" when they name a version FutFox can't check.

To test against the emulators, set `futfox.dev.setsUrl` in the page's local storage to
`http://127.0.0.1:8080/v1/projects/futfox-gallery/databases/(default)/documents/public/gallery`.

Options:

- **Keep my active squad players**: leaves out the players the app loaded at login
  (your active squad).
- **Keep players rated … and above**: protects your best cards (default 87).
- **Use untradeables only** and **Suggest cards to buy when the club falls short**.

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

## Develop

```bash
npm test
```

No dependencies or build step. The core files run in Node for tests and in the page as
plain scripts (they attach to `window.FutFox`).

## Website

The site lives in `store/futfox-site` (home page and privacy policy, plain HTML and CSS) and is
live at https://futfox-site.vercel.app. Vercel deploys it from GitHub with `store/futfox-site`
as the project's root directory: every push to `main` goes live, and pull requests get preview
links. `vercel.json` turns on clean URLs so `/privacy` serves `privacy.html`.

`scripts/build-site.sh` copies the icons, a Latin subset of the Inter font, the share image and
the step screenshots (made from the real panel by `scripts/capture-screens.sh`) into
`store/futfox-site/assets`. The copies are committed; rerun the script and commit the result
when any of them change.

## Gallery sets admin

Gallery sets are kept in Firebase (project `futfox-gallery`, Firestore in `eur3`) and edited at
`/admin` on the website. `firebase/firestore.rules` lets anyone read the published sets
(`public/gallery`, the document FutFox will download) and only admins (`admins/{uid}`) edit sets,
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

## Credits

- [Inter](https://github.com/rsms/inter) (SIL Open Font License 1.1, see `brand/fonts/OFL.txt`)
  for the logo wordmark and the website.

## License

[MIT](LICENSE)
