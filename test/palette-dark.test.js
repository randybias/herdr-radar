'use strict';

// The dark set is the operator's Ghostty theme (Dracula) copied as hex, and a
// pinned `appearance` outranks the desktop. Both are the dev fleet's rulings.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appearance = require('../lib/appearance');
const config = require('../lib/config');
const managed = require('../lib/managed-config');
const palette = require('../lib/palette');

const THEME = '/Applications/Ghostty.app/Contents/Resources/ghostty/themes/Dracula';

test('the dark state colours are the theme’s ANSI role colours', (t) => {
  if (!fs.existsSync(THEME)) return t.skip('Ghostty theme not installed here');
  const ansi = {};
  for (const m of fs.readFileSync(THEME, 'utf8').matchAll(/palette = (\d+)=(#[0-9a-f]{6})/g)) ansi[m[1]] = m[2];
  const dark = palette.stateFor('dark');
  assert.equal(dark.done, ansi[2]);
  assert.equal(dark.blocked, ansi[1]);
  assert.equal(dark.unknown, ansi[4]);
  assert.equal(dark.idleNormal, ansi[7]);
  assert.equal(dark.idleStale, ansi[8]);
  assert.equal(dark.idleFresh, ansi[15]);
});

test('a pinned appearance outranks the desktop', (t) => {
  const was = config.appearance;
  t.after(() => (config.appearance = was));
  config.appearance = 'dark';
  assert.equal(appearance.current(), 'dark');
  assert.equal(managed.chromeVariant(''), 'dark');
  config.appearance = 'light';
  assert.equal(appearance.current(), 'light');
});

test('the dark block carries no blink tokens', () => {
  assert.ok(!managed.sidebarBlock('dark').includes('_dim'));
});
