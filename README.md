<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo/futfox-horizontal.svg">
    <img src="brand/logo/futfox-horizontal-light.svg" alt="FutFox" width="280">
  </picture>
</p>

<p align="center">
  Finish SBCs with the players you already own.<br>
  A free, read-only Chrome extension for the EA SPORTS FC 27 Web App.
</p>

<p align="center">
  <a href="https://github.com/abouhilalbadr/futfox/actions/workflows/tests.yml"><img src="https://github.com/abouhilalbadr/futfox/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://github.com/abouhilalbadr/futfox/actions/workflows/codeql.yml"><img src="https://github.com/abouhilalbadr/futfox/actions/workflows/codeql.yml/badge.svg" alt="CodeQL"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/abouhilalbadr/futfox"><img src="https://api.scorecard.dev/projects/github.com/abouhilalbadr/futfox/badge" alt="OpenSSF Scorecard"></a>
  <a href="https://www.bestpractices.dev/projects/15955"><img src="https://www.bestpractices.dev/projects/15955/badge" alt="OpenSSF Best Practices"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/abouhilalbadr/futfox" alt="License: MIT"></a>
  <a href="manifest.json"><img src="https://img.shields.io/badge/Chrome-Manifest_V3-8b5cf6" alt="Manifest V3"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/runtime_dependencies-0-brightgreen" alt="No runtime dependencies"></a>
</p>

<p align="center">
  <a href="https://futfox-site.vercel.app">Website</a> ·
  <a href="#install">Install</a> ·
  <a href="https://futfox-site.vercel.app/privacy">Privacy</a>
</p>

## What it does

- **SBC solver:** reads a challenge's rules, searches your club and suggests the cheapest
  squad that meets every one.
- **Gallery:** shows the grade and tokens your cards would reach in a Gallery set before you
  place a card.
- **Market search, filled in:** for any card your club is missing, opens the Transfer Market
  with quality, position, league and nation already set.

## Safe by design

FutFox only reads and suggests. It never buys, bids, lists, moves players, saves squads or
submits an SBC; every coin you spend is your own click.

- It reads your club only when you press **Load my club**, one page every few seconds.
- It downloads the public list of Gallery sets once a day, sending nothing about you.
- It searches the squad builder list only when you press **Pick player** or **Suggest cards**.

`test/read-only.test.js` fails if any source file calls an account-changing Web App method, and
the Tests badge runs it on every push. CodeQL scans the code for known security issues and
Scorecard rates how the repository is run. The Best Practices badge is the OpenSSF passing
level, self-certified with a public justification for each criterion. A passing scan means nothing known was found, not a
guarantee.

Not affiliated with or endorsed by EA. Third-party tools are against EA's user agreement, so
use it at your own risk.

## Install

1. [Download futfox.zip](https://github.com/abouhilalbadr/futfox/releases/latest/download/futfox.zip) from the latest
   [release](https://github.com/abouhilalbadr/futfox/releases/latest) and unzip it.
2. Open `chrome://extensions`, switch on **Developer mode** and click **Load unpacked**.
3. Pick the unzipped `futfox` folder, then open the
   [Web App](https://www.ea.com/ea-sports-fc/ultimate-team/web-app/). The **FutFox** button
   appears at the bottom right.

Each release zip is signed; [docs/DEVELOPING.md](docs/DEVELOPING.md#releases) shows how to
check it.

The Chrome Web Store listing is coming soon.

## Use

1. Open an SBC set so its requirements load, then press **FutFox**.
2. Press **Load my club** once per session.
3. Pick the challenge and press **Find cheapest squad**.
4. For each card to buy, **Search market** opens the filled-in search. Look for the rating the
   panel shows, then buy, place and submit yourself.

Options let you keep your active squad, protect players rated 87 and above (you choose the
number), use untradeables only, and turn off buy suggestions.

## Develop

```bash
npm install
npm test
```

No runtime dependencies or build step; `npm install` only fetches
[fast-check](https://fast-check.dev) for the property tests. How the code fits together, the Gallery admin and the website
are covered in [docs/DEVELOPING.md](docs/DEVELOPING.md). To contribute, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Credits and license

[Inter](https://github.com/rsms/inter) (SIL Open Font License 1.1, see `brand/fonts/OFL.txt`)
for the logo wordmark and the website. FutFox is released under the [MIT license](LICENSE).
