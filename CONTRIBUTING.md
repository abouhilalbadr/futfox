# Contributing to FutFox

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and asking for features

Open an [issue](https://github.com/abouhilalbadr/futfox/issues). For a bug, include what you
did, what you expected, what happened, the FutFox version (from `manifest.json`) and your Chrome
version. A screenshot of the panel helps.

Security problems go through private reporting instead of an issue; see [SECURITY.md](SECURITY.md).

## Making a change

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests for any new or changed behaviour in `src/core`.
3. Run the tests:

   ```bash
   npm install
   npm test
   ```

4. Load the folder unpacked in `chrome://extensions` and check the change in the
   [Web App](https://www.ea.com/ea-sports-fc/ultimate-team/web-app/).
5. Open a pull request against `main` describing what changed and how you tested it.

[docs/DEVELOPING.md](docs/DEVELOPING.md) explains how the code fits together.

## Requirements for a pull request

A pull request is merged only when it meets all of these:

- **It stays read-only.** FutFox never buys, bids, lists, moves players, saves squads or submits
  an SBC. `test/read-only.test.js` fails on any call to an account-changing Web App method, and
  changes that try to get around it are not accepted.
- **The checks pass.** The Tests and CodeQL workflows run on every pull request and must be green.
- **It sends nothing about the user.** No analytics, tracking or new network requests that carry
  user data. Any new request must be described in the pull request and in the privacy policy
  (`store/futfox-site/privacy.html`).
- **No new runtime dependencies.** The extension runs as plain scripts with no build step. Dev
  dependencies for tests need a reason in the pull request.
- **It follows the coding style** below.

## Coding style

- Plain JavaScript (ES2020+), no build step or transpiler.
- Match the surrounding code: 2-space indentation, single quotes, semicolons, `const` and `let`
  (no `var`), and `'use strict'` inside each module.
- Core files in `src/core` wrap their code in an immediately invoked function that exports to
  `module.exports` in Node and to `window.FutFox` in the page; keep them free of DOM and Web App
  access so they can be tested in Node.
- Everything that touches the Web App goes in `src/page/fut-adapter.js`.
- Comments explain why, not what, and stay short.
- Commit messages: a short summary line in the imperative ("Add …", "Fix …"), then a blank line
  and a few lines on what changed and why.

## License

By contributing, you agree that your contributions are released under the
[MIT license](LICENSE).
