'use strict';

// `appearance = "dark"` pins the palette and Herdr's theme, whatever the
// desktop says. A light Mac desktop with a dark terminal wrote light colours.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-fixed-'));
process.env.HERDR_RADAR_STATE = path.join(sandbox, 'state');
process.env.XDG_CONFIG_HOME = path.join(sandbox, 'config');

const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../lib/config');
const herdr = require('../lib/herdr');
const appearance = require('../lib/appearance');
const managed = require('../lib/managed-config');

const file = path.join(sandbox, 'config', 'herdr', 'config.toml');
const BEFORE = '[ui]\n\n[theme]\nname = "catppuccin-latte"\ndark_name = "catppuccin"\n';

test.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

test('appearance defaults to auto', () => {
  assert.equal(config.fixedAppearance, null);
});

test('a fixed dark appearance wins over a light desktop', (t) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, BEFORE);
  t.mock.method(herdr, 'configCheck', () => ({ parses: true, ok: true, output: 'config: ok' }));
  t.mock.method(appearance, 'current', () => 'light');
  t.mock.property(config, 'fixedAppearance', 'dark');
  t.mock.property(config, 'followAppearance', false);
  const result = managed.apply();
  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /theme \(dark\)/);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /name = "catppuccin"/);
  assert.doesNotMatch(text, /name = "catppuccin-latte"/);
});
