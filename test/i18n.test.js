const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../src/core/i18n');

// Every quoted string inside the calls that translate (t, and the panel helpers that call t on
// their text), from the page scripts. Identifiers (settings keys, plural words) are skipped.
function translatedStrings(source) {
  const found = new Set();
  const start = /\b(t|switchRow|field|pick|clubPointer)\(/g;
  while (start.exec(source)) {
    let i = start.lastIndex;
    let depth = 1;
    const args = [];
    while (i < source.length && depth) {
      const ch = source[i];
      if (ch === "'" || ch === '"' || ch === '`') {
        let j = i + 1;
        let text = '';
        while (source[j] !== ch) {
          if (source[j] === '\\') { text += source[j + 1]; j += 2; } else { text += source[j]; j += 1; }
        }
        if (ch !== '`') args.push(text);
        i = j + 1;
        continue;
      }
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      i += 1;
    }
    for (const text of args) {
      if (I.PLURALS[text] || /^[a-z0-9][A-Za-z0-9-]*$/.test(text) || !/[A-Za-z]/.test(text)) continue;
      found.add(text);
    }
  }
  return found;
}

test('every phrase the page scripts translate has an Arabic version', () => {
  const dir = path.join(__dirname, '../src/page');
  const missing = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    for (const text of translatedStrings(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      if (I.AR[text] == null) missing.push(`${file}: ${text}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the placing steps and the bonus tags have Arabic versions', () => {
  const panel = fs.readFileSync(path.join(__dirname, '../src/page/panel.js'), 'utf8');
  const steps = panel.match(/const steps = streamlined\s*\?\s*\[([\s\S]*?)\]/)[1].match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g).map((s) => s.slice(1, -1).replace(/\\'/g, "'"));
  for (const text of steps) assert.ok(I.AR[text], text);
  for (const tag of require('../src/core/bonus-tags').TAGS) {
    assert.ok(I.AR[tag.name] != null, tag.name);
    assert.ok(I.AR[tag.rule] != null, tag.rule);
  }
});

test('Arabic keeps every {value} of the English', () => {
  const marks = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const [en, ar] of Object.entries(I.AR)) assert.equal(marks(ar), marks(en), en);
});

test('counted words follow Arabic plural forms', () => {
  I.setLang('ar');
  assert.equal(I.plural('card', 1), 'بطاقة واحدة');
  assert.equal(I.plural('card', 2), 'بطاقتان');
  assert.equal(I.plural('card', 3), '3 بطاقات');
  assert.equal(I.plural('card', 11), '11 بطاقة');
  assert.equal(I.plural('player', 180), '180 لاعبًا');
  assert.equal(I.t('{players} so far', { players: I.plural('player', 43) }), '43 لاعبًا حتى الآن');
  I.setLang('en');
  assert.equal(I.plural('card', 1), '1 card');
  assert.equal(I.plural('card', 0), '0 cards');
  assert.equal(I.t('{players} so far', { players: I.plural('player', 43) }), '43 players so far');
});

test('English stays the default, and unknown phrases show as they are', () => {
  I.setLang('fr');
  assert.equal(I.lang(), 'en');
  assert.equal(I.dir(), 'ltr');
  I.setLang('ar');
  assert.equal(I.dir(), 'rtl');
  assert.equal(I.t('Not a phrase FutFox has'), 'Not a phrase FutFox has');
  I.setLang('en');
});

test('parts puts elements where the phrase marks them', () => {
  const bold = { tag: 'strong' };
  I.setLang('en');
  assert.deepEqual(I.parts('{n} rating', { n: bold }), [bold, ' rating']);
  I.setLang('ar');
  assert.deepEqual(I.parts('{n} rating', { n: bold }), ['تقييم ', bold]);
  assert.deepEqual(I.parts('Short by {n}', { n: ['icon', '120'] }), ['ينقص ', 'icon', '120']);
  I.setLang('en');
});
