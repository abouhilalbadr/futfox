// The extension must never act on the user's account: no bids, buys, listings,
// SBC submissions, squad saves, item moves or discards.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FORBIDDEN = [
  'bid', 'searchTransferMarket', 'list', 'relistExpiredAuctions', 'redeem', 'discard', 'move',
  'saveChallenge', 'submitChallenge', 'initiateOneClickChallenge', 'submitOneClickChallenge', 'save',
  'claimCompensationRewards', 'eSearchSelected',
];

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sources(full) : full.endsWith('.js') ? [full] : [];
  });
}

test('no source file calls an account-changing Web App method', () => {
  for (const file of sources(path.join(__dirname, '..', 'src'))) {
    const code = fs.readFileSync(file, 'utf8');
    for (const name of FORBIDDEN) {
      const call = new RegExp(`\\.${name}\\s*\\(`);
      assert.ok(!call.test(code), `${path.basename(file)} calls .${name}(`);
    }
  }
});
