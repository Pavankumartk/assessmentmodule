#!/usr/bin/env node
/*
 * Surgical rollback of only the Details-component edits introduced by
 * Assessment_Type_Fixed_Header_Logout_Removal_Only.zip.
 * Does not replace entire TSX files or touch routing, Header, Sidebar or Dashboard.
 * Run --check first; use --apply only after inspecting output.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const data = require('./assessment-last-patch-reverse-pairs.json');
const arg = process.argv.slice(2);
const apply = arg.includes('--apply');
if (arg.some(x => x !== '--check' && x !== '--apply')) {
  console.error('Usage: node scripts/restore-assessment-flow.cjs [--check|--apply]');
  process.exit(2);
}
const root = process.cwd();
const targets = [];
let error = false;
for (const [relative, operations] of Object.entries(data)) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename)) {
    console.error('[STOP] Missing expected component: ' + relative);
    error = true; continue;
  }
  const current = fs.readFileSync(filename, 'utf8');
  let updated = current;
  let changed = 0;
  let invalid = false;
  for (const operation of operations) {
    const hits = updated.split(operation.from).length - 1;
    if (hits === 1) {
      updated = updated.replace(operation.from, operation.to);
      changed++;
    } else if (hits !== 0) {
      console.error('[STOP] Ambiguous match: ' + relative + ': ' + operation.name);
      invalid = true;
    }
  }
  // An unmodified prior file is fine. A partially matched file might contain
  // newer user changes, so never overwrite it automatically.
  if (!invalid && changed !== 0 && changed !== operations.length) {
    console.error('[STOP] Partial match; preserving newer code: ' + relative + ' (' + changed + '/' + operations.length + ')');
    invalid = true;
  }
  if (invalid) { error = true; continue; }
  const state = changed === operations.length ? 'RESTORE' : 'UNCHANGED';
  console.log(`[${state}] ${relative}`);
  if (changed === operations.length) targets.push({filename, relative, current, updated});
}
if (error) {
  console.error('No files were modified. Your code differs from the supplied patch; do not force a restore.');
  process.exit(1);
}
if (!apply) {
  console.log(`\nPreview only: ${targets.length} assessment Details files would be restored; no changes made.`);
  console.log('Use --apply to restore after checking the list. Header, Sidebar, Dashboard and other assessments are NOT touched.');
  process.exit(0);
}
if (!targets.length) {
  console.log('Nothing to restore. No changes made.');
  process.exit(0);
}
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const backupDir = path.resolve(root, '..', 'assessment-flow-backups', stamp);
try {
  for (const {relative, current} of targets) {
    const dest = path.join(backupDir, relative);
    fs.mkdirSync(path.dirname(dest), {recursive:true});
    fs.writeFileSync(dest, current, {flag:'wx'});
  }
  for (const {filename, updated} of targets) fs.writeFileSync(filename, updated);
  console.log(`\nRestored ${targets.length} assessment Details component(s).`);
  console.log('Backup folder (outside web Git repository): '+backupDir);
  console.log('Run npm run build and test assessment type clicks before pushing.');
} catch (e) {
  console.error('Unable to complete safely: '+String(e?.message || e));
  // Files should remain restorable from the printed backup folder.
  process.exit(1);
}
