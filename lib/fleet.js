'use strict';

// Group the Agents panel by what each lane is FOR, from the dev fleet's own
// definition, instead of by workspace.
//
// The fleet runs one lane per workspace and labels the workspace with the lane
// name, so upstream's grouping (a header per workspace) gives every lane a
// header of its own. The fleet writes two files:
//
//   lanes.json   one object per lane: name, group, model, branch, ...
//   groups.json  the group names, in the order they are shown
//
// A lane whose group is missing from groups.json, or absent, is `misc`. A
// workspace that is not a lane keeps upstream's behaviour and heads a group of
// its own after the fleet's groups. No readable file means no fleet: the panel
// falls back to the workspace grouping. Nothing here writes anything.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readJson } = require('./cache');
const config = require('./config');

const DEFAULT_ORDER = ['managers', 'researchers', 'spikes', 'developers', 'reviewers', 'misc'];
const FALLBACK = 'misc';

function defaultLanesFile() {
  return path.join(os.homedir(), 'code', 'thaos', 'fleet', 'lanes.json');
}

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return -1;
  }
}

// The groups in display order. Anything that is not a list of names is the
// default order, so a half-written file cannot reorder the panel.
function orderFrom(file) {
  const list = readJson(file);
  const names = Array.isArray(list) ? list.filter((g) => typeof g === 'string' && g) : [];
  if (names.length === 0) return DEFAULT_ORDER;
  return names.includes(FALLBACK) ? names : [...names, FALLBACK];
}

// Parse the two files into a lookup, or null when lanes.json cannot be read.
function load(lanesFile = config.fleetLanes ?? defaultLanesFile()) {
  const list = readJson(lanesFile);
  if (!Array.isArray(list)) return null;
  const order = orderFrom(path.join(path.dirname(lanesFile), 'groups.json'));
  const lanes = new Map();
  for (const lane of list) {
    if (lane && typeof lane.name === 'string' && lane.name) lanes.set(lane.name, lane);
  }

  // What one workspace groups under:
  //   key    the group identity the panel groups by
  //   label  the header text
  //   rank   the group's place in the fixed order
  //   lane   the lane name
  //   title  the lane name (the row adds the model: rowTitle)
  function forLabel(workspaceId, label) {
    const text = (label ?? '').trim();
    const entry = lanes.get(text);
    if (entry) {
      const name = order.includes(entry.group) ? entry.group : FALLBACK;
      return {
        key: `grp:${name}`,
        label: name,
        rank: order.indexOf(name),
        lane: text,
        title: text,
        runtime: typeof entry.runtime === 'string' ? entry.runtime : null,
        isLane: true,
        model: typeof entry.model === 'string' && entry.model ? entry.model : null,
        branch: typeof entry.branch === 'string' && entry.branch ? entry.branch : null,
      };
    }
    return {
      key: workspaceId,
      label: text,
      rank: order.length,
      lane: text,
      title: text,
      isLane: false,
      model: null,
      branch: null,
    };
  }

  return { order, forLabel };
}

// Cached on the mtimes of both files: the daemon asks every frame and the
// files change rarely.
let cache = { file: null, stamp: '', fleet: null };

function current() {
  const file = config.fleetLanes ?? defaultLanesFile();
  const stamp = `${mtime(file)}|${mtime(path.join(path.dirname(file), 'groups.json'))}`;
  if (cache.file === file && cache.stamp === stamp) return cache.fleet;
  cache = { file, stamp, fleet: load(file) };
  return cache.fleet;
}

// The sort key Herdr orders the panel by in `category` mode, ascending: group,
// then lane name, then pane (splits stay together, in pane order).
// The key is compared as one opaque string, so digit runs in the pane id are
// zero-padded: pane 10 must sort after pane 2.
function sortKey(group, pane) {
  const padded = String(pane).replace(/\d+/g, (digits) => digits.padStart(8, '0'));
  // The separator is a space, below every character a lane name holds, so a
  // name that is a prefix of another sorts first (`dev` before `developers`).
  return `${String(group.rank).padStart(4, '0')} ${group.lane.toLowerCase()} ${padded}`;
}

// A model id as one short word for a row: no provider, no `claude-`, no
// quantisation or build suffix, and a trailing version pair joined with a dot
// (claude-opus-5-5 -> opus-5.5, tokenfactory/glm-5.3-flash-uncensored-fp8 ->
// glm-5.3-flash).
function shortModel(id) {
  if (typeof id !== 'string' || !id) return null;
  const short = id
    .replace(/^.*\//, '')
    .replace(/^claude-/, '')
    .replace(/-(?:uncensored|abliterated|fp\d+|int\d+|awq|gguf)\b/g, '')
    .replace(/-(\d+)-(\d+)$/, '-$1.$2');
  return short || null;
}

// The model a row shows: the one the lane is running (reach.json model_id),
// else the fleet file's own, but never the file's for a Pi lane (its model is
// only resolved at start, so the file's value would be a guess).
function rowModel(lane, modelId) {
  const running = shortModel(modelId);
  if (running) return running;
  if (lane?.runtime === 'pi') return null;
  return typeof lane?.model === 'string' && lane.model ? lane.model : null;
}

function rowTitle(name, model) {
  return model ? `${name} (${model})` : name;
}

module.exports = { load, current, sortKey, shortModel, rowModel, rowTitle };
