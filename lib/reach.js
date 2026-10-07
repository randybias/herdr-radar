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

function read(file = config.reachFile ?? defaultFile(), now = Date.now()) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.at !== 'number' || now / 1000 - data.at > MAX_AGE_S) return null;
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

const glyph = (ok) => (ok === true ? UP : ok === false ? DOWN : NONE);

// The cell a row shows: one text, one tone. Any down lamp makes the whole cell
// `bad`; no answer at all is `none`.
function lamps(answer) {
  if (!answer || (answer.mail === null && answer.model === null)) return { tone: 'none', text: NONE + NONE };
  const tone = answer.mail === false || answer.model === false ? 'bad' : 'ok';
  return { tone, text: glyph(answer.mail) + glyph(answer.model) };
}

module.exports = { MAX_AGE_S, read, lamps };
