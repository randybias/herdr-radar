'use strict';

// The fleet's lane definitions drive the grouped view: lanes.json says which
// group a lane belongs to, groups.json says in what order the groups run.
// Nothing here writes anything, and no file means no groups, so the panel
// falls back to the workspace grouping.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const fleet = require('../lib/fleet');

function fixture(lanes, groups) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-fleet-'));
  const lanesFile = path.join(dir, 'lanes.json');
  fs.writeFileSync(lanesFile, JSON.stringify(lanes));
  if (groups) fs.writeFileSync(path.join(dir, 'groups.json'), JSON.stringify(groups));
  return lanesFile;
}

const GROUPS = ['managers', 'researchers', 'spikes', 'developers', 'reviewers', 'misc'];
const LANES = [
  { name: 'coord', group: 'managers', model: 'opus' },
  { name: 'builder', group: 'developers', model: 'sonnet' },
  { name: 'lost', group: 'nonsense', model: 'opus' },
  { name: 'nogroup', model: 'opus' },
];

test('a lane groups under its group, ranked by groups.json', () => {
  const f = fleet.load(fixture(LANES, GROUPS));
  const g = f.forLabel('w1', 'builder');
  assert.equal(g.label, 'developers');
  assert.equal(g.key, 'grp:developers');
  assert.equal(g.rank, 3);
  assert.equal(g.lane, 'builder');
  assert.equal(g.model, 'sonnet');
});

test('a lane with an unknown or missing group lands in misc', () => {
  const f = fleet.load(fixture(LANES, GROUPS));
  assert.equal(f.forLabel('w', 'lost').label, 'misc');
  assert.equal(f.forLabel('w', 'nogroup').label, 'misc');
});

test('a workspace that is not a lane heads a group of its own, after every group', () => {
  const f = fleet.load(fixture(LANES, GROUPS));
  const g = f.forLabel('w9', 'my shell');
  assert.equal(g.key, 'w9');
  assert.equal(g.rank, GROUPS.length);
});

test('without groups.json the default order applies', () => {
  const f = fleet.load(fixture(LANES, null));
  assert.equal(f.forLabel('w', 'coord').rank, 0);
  assert.equal(f.forLabel('w', 'builder').label, 'developers');
});

test('a missing or unreadable file is no fleet at all', () => {
  assert.equal(fleet.load(path.join(os.tmpdir(), 'radar-no-such', 'lanes.json')), null);
  assert.equal(fleet.load(fixture('not a list', GROUPS)), null);
});

test('sort keys order by group, then lane name, then pane', () => {
  const f = fleet.load(fixture(LANES, GROUPS));
  const a = fleet.sortKey(f.forLabel('w', 'coord'), 'w:1');
  const b = fleet.sortKey(f.forLabel('w', 'builder'), 'w:2');
  assert.ok(a < b, 'managers sort before developers');
});

test('the fleet view orders panes by group, then lane, unknown workspaces last', () => {
  const { Frame } = require('../lib/frame');
  const f = fleet.load(fixture(LANES, GROUPS));
  const names = { w1: 'builder', w2: 'coord', w3: 'my shell' };
  const entries = ['w1', 'w2', 'w3'].map((w) => ({ pane: `${w}:p`, workspace: w }));
  const groupOf = new Map(entries.map((e) => [e.pane, f.forLabel(e.workspace, names[e.workspace])]));
  const order = Frame.prototype.displayOrder.call({}, entries, 'category', {}, groupOf).map((e) => e.workspace);
  assert.deepEqual(order, ['w2', 'w1', 'w3']);
});

test('pane 10 sorts after pane 2 inside a lane', () => {
  const f = fleet.load(fixture(LANES, GROUPS));
  const g = f.forLabel('w', 'builder');
  assert.ok(fleet.sortKey(g, 'w:2') < fleet.sortKey(g, 'w:10'));
});

test('a cat_key that moves on its own is republished', async (t) => {
  const herdr = require('../lib/herdr');
  const { Frame } = require('../lib/frame');
  const sent = [];
  t.mock.method(herdr, 'reportMetadataAsync', async (_pane, _source, tokens) => {
    if ('cat_key' in tokens) sent.push(tokens.cat_key);
    return true;
  });
  t.mock.method(herdr, 'reportMetadata', () => true);
  const frame = new Frame();
  const entry = { pane: 'w:p1', workspace: 'w', tab: 't', name: 'claude', title: 'x' };
  const keys = { minuteKey: () => '1', wsKeys: new Map(), tabKeys: new Map() };
  for (const catKey of [null, '00|a|w:p00000001']) {
    const jobs = [];
    frame.paneJobs(entry, 'idle', { tabs: new Map(), keys, indent: '', spinStep: 0, catKey }, 0, [], jobs);
    await Promise.all(jobs);
  }
  assert.deepEqual(sent, [null, '00|a|w:p00000001']);
});

test('stopping keeps cat_key so the fleet view holds its order', () => {
  const state = require('../lib/state');
  const stop = state.stopNames();
  assert.ok(!stop.includes('cat_key'), 'cat_key was cleared on stop');
  assert.ok(stop.includes('reach_ok'), 'the lamps go on stop');
  assert.ok(state.stopNames({ purge: true }).includes('cat_key'), 'purge takes everything');
});
