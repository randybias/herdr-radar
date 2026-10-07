'use strict';

// First-run setup: everything `herdr plugin install` alone does not do.
//
// A freshly installed plugin shows nothing until its managed blocks are in
// Herdr's config. Rather than a README of steps, the daemon's launcher runs
// this once: on the first start it writes the blocks, then leaves a stamp so a
// later start does not redo — or undo — what the user has since changed by
// hand.
//
// It never installs the icon font and never edits a terminal's config: on the
// dev fleet the operator installs the fonts by hand (macOS Font Book) and owns
// the terminal config. The `install-font` action still does both, on request.

const fs = require('node:fs');
const path = require('node:path');

const { stateRoot, ensureDir } = require('./paths');
const identity = require('./identity');

function stamp() {
  return path.join(ensureDir(stateRoot), 'setup.done');
}

function expected() {
  return `${identity.NAME} no-font`;
}

// Returns the notes of what was done; an empty list means nothing was needed.
function ensure({ force = false } = {}) {
  const notes = [];
  const managed = require('./managed-config');
  const { reloadConfig, notify } = require('./herdr');

  let done = null;
  try {
    done = fs.readFileSync(stamp(), 'utf8').trim();
  } catch {
    // First run.
  }
  if (!force && done) return notes;

  const report = managed.inspect();
  if (report.state === 'installable') {
    const result = managed.apply();
    notes.push(result.message);
    if (result.ok) {
      reloadConfig();
      notes.push('herdr: config reloaded');
    }
    if (!result.ok || result.skipped?.length) notify(`${identity.NAME}: configure`, result.message);
  } else if (report.state !== 'installed') {
    const note = `herdr: managed blocks not written (${report.state}); run the configure action once that is fixed`;
    notes.push(note);
    notify(`${identity.NAME}: not configured`, note);
  }

  try {
    fs.writeFileSync(stamp(), `${expected()}\n`, 'utf8');
  } catch {
    // Without a stamp the next start repeats the (idempotent) checks.
  }
  return notes;
}

module.exports = { ensure, stamp, expected };
