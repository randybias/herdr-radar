'use strict';

// Per-lane reachability: can codev mail wake the lane, and does its model
// answer. The fleet writes one small file; this reads it and decides nothing
// itself (no judgment, no inference from other state):
//
//   { "at": <epoch seconds>,
//     "lanes": { "<lane>": { "mail": true|false, "model": true|false|null } } }
//
// model is null where the lane has no endpoint to probe. A file older than
// MAX_AGE_S means the WRITER stopped, so it is no data, not "up" and not
// "down": the lamp goes neutral. Nothing here writes anything.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readJson } = require('./cache');
const config = require('./config');

const MAX_AGE_S = 90;

// The state's glyphs from the operator visual language: up ●, down ✗,
// neutral ○. Shape carries the meaning; colour is the palette's own.
const UP = '●';
const DOWN = '✗';
const NONE = '○';

function defaultFile() {
  return path.join(os.homedir(), '.local', 'state', 'thaos-dev-fleet', 'reach.json');
}

// Parsed once per change of the file: the daemon asks every frame, the file
// changes every few seconds at most. Freshness is judged per call against
// `now`, never cached.
let cache = { file: null, mtimeMs: -1, data: null };

function load(file) {
  let mtimeMs;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
  if (cache.file !== file || cache.mtimeMs !== mtimeMs) cache = { file, mtimeMs, data: readJson(file) };
  return cache.data;
}

function read(file = config.reachFile ?? defaultFile(), now = Date.now()) {
  const data = load(file);
  // A stamp that is not a number, or is more than MAX_AGE_S away from now in
  // either direction (a writer with a skewed clock), is no data.
  if (!data || !Number.isFinite(data.at) || Math.abs(now / 1000 - data.at) > MAX_AGE_S) return null;
  const lanes = data.lanes && typeof data.lanes === 'object' ? data.lanes : {};
  return {
    // The moment this answer expires, in ms: the frame re-renders then.
    expiresAt: (data.at + MAX_AGE_S) * 1000,
    lane(name) {
      if (!Object.hasOwn(lanes, name)) return null;
      const l = lanes[name] ?? {};
      return {
        mail: typeof l.mail === 'boolean' ? l.mail : null,
        model: typeof l.model === 'boolean' ? l.model : null,
      };
    },
  };
}

function glyph(ok) {
  if (ok === true) return UP;
  if (ok === false) return DOWN;
  return NONE;
}

// The cell a row shows: one text, one tone. Any down lamp makes the whole cell
// `bad`; no answer at all is `none`.
function lamps(answer) {
  const mail = answer?.mail ?? null;
  const model = answer?.model ?? null;
  if (mail === null && model === null) return { tone: 'none', text: NONE + NONE };
  const tone = mail === false || model === false ? 'bad' : 'ok';
  return { tone, text: glyph(mail) + glyph(model) };
}

module.exports = { MAX_AGE_S, read, lamps };
