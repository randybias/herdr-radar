'use strict';

// Whether codev mail can wake a lane and whether its model answers, read from
// the file the fleet writes. A stale or missing file is "no data", never "up":
// a lamp shown with nothing behind it is a lie.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const reach = require('../lib/reach');

const NOW = 1_000_000_000;

function fixture(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-reach-'));
  const file = path.join(dir, 'reach.json');
  if (body !== undefined) fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  return file;
}

const FRESH = {
  at: NOW / 1000 - 10,
  lanes: { a: { mail: true, model: true }, b: { mail: false, model: true }, c: { mail: true, model: null } },
};

test('a fresh file gives each lane its mail and model answers', () => {
  const r = reach.read(fixture(FRESH), NOW);
  assert.deepEqual(r.lane('a'), { mail: true, model: true });
  assert.deepEqual(r.lane('b'), { mail: false, model: true });
  assert.deepEqual(r.lane('c'), { mail: true, model: null });
});

test('a lane the file does not list has no answer', () => {
  assert.equal(reach.read(fixture(FRESH), NOW).lane('zzz'), null);
});

test('a stale file is no data at all', () => {
  const stale = { ...FRESH, at: NOW / 1000 - reach.MAX_AGE_S - 1 };
  assert.equal(reach.read(fixture(stale), NOW), null);
});

test('a missing or unreadable file is no data', () => {
  assert.equal(reach.read(path.join(os.tmpdir(), 'radar-no-such', 'reach.json'), NOW), null);
  assert.equal(reach.read(fixture('{oops'), NOW), null);
  assert.equal(reach.read(fixture({ lanes: {} }), NOW), null, 'no timestamp, no trust');
});

test('lamps: up is a green circle, down a cross, no answer a hollow circle', () => {
  assert.deepEqual(reach.lamps({ mail: true, model: true }), { tone: 'ok', text: '●●' });
  assert.deepEqual(reach.lamps({ mail: false, model: true }), { tone: 'bad', text: '✗●' });
  assert.deepEqual(reach.lamps({ mail: true, model: false }), { tone: 'bad', text: '●✗' });
  assert.deepEqual(reach.lamps({ mail: true, model: null }), { tone: 'ok', text: '●○' });
  assert.deepEqual(reach.lamps(null), { tone: 'none', text: '○○' });
});

test('a lane row publishes exactly one lamp token and clears the others', async (t) => {
  const herdr = require('../lib/herdr');
  const { Frame } = require('../lib/frame');
  const sent = [];
  t.mock.method(herdr, 'reportMetadataAsync', async (_pane, _source, tokens) => {
    if ('reach_ok' in tokens) sent.push(tokens);
    return true;
  });
  t.mock.method(herdr, 'reportMetadata', () => true);
  const frame = new Frame();
  const entry = { pane: 'w:p1', workspace: 'w', tab: 't', name: 'claude', title: 'x' };
  const keys = { minuteKey: () => '1', wsKeys: new Map(), tabKeys: new Map() };
  const jobs = [];
  const lamps = reach.lamps({ mail: false, model: true });
  frame.paneJobs(entry, 'idle', { tabs: new Map(), keys, indent: '', spinStep: 0, lamps }, 0, [], jobs);
  await Promise.all(jobs);
  assert.deepEqual(sent[0], { reach_ok: null, reach_bad: '✗●', reach_none: null });
});

test('a stamp in the future, or not a number, is no data', () => {
  const future = { ...FRESH, at: NOW / 1000 + reach.MAX_AGE_S + 1 };
  assert.equal(reach.read(fixture(future), NOW), null);
  assert.equal(reach.read(fixture('{"at":1e999,"lanes":{}}'), NOW), null);
  assert.equal(reach.read(fixture({ ...FRESH, at: '1' }), NOW), null);
});

test('an empty answer is hollow, not green', () => {
  assert.deepEqual(reach.lamps({}), { tone: 'none', text: '\u25cb\u25cb' });
});

test('the writer’s max_age sets the freshness window', () => {
  const old = { ...FRESH, at: NOW / 1000 - 200 };
  assert.equal(reach.read(fixture(old), NOW), null, 'older than the default window');
  assert.ok(reach.read(fixture({ ...old, max_age: 300 }), NOW), 'inside the writer’s own window');
  assert.equal(reach.read(fixture({ ...FRESH, max_age: 5 }), NOW), null, 'outside a short window');
});
