'use strict';

// First-run setup writes the managed blocks and nothing else: the operator
// installs the icon font by hand and owns the terminal config, so setup must
// never install a font or write a terminal mapping, with or without a stamp.

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const font = require('../lib/font');
const herdr = require('../lib/herdr');
const managed = require('../lib/managed-config');
const setup = require('../lib/setup');

test('setup never installs the font or maps a terminal', (t) => {
  const calls = [];
  t.mock.method(font, 'install', () => (calls.push('install'), []));
  t.mock.method(font, 'configureTerminals', () => (calls.push('configureTerminals'), []));
  t.mock.method(font, 'isInstalled', () => false);
  t.mock.method(managed, 'inspect', () => ({ state: 'installed' }));
  t.mock.method(herdr, 'reloadConfig', () => true);
  // The stamp lives in the real plugin state directory; do not write it.
  t.mock.method(fs, 'writeFileSync', () => {});
  setup.ensure({ force: true });
  assert.deepEqual(calls, []);
});
