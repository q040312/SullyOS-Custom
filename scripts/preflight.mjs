#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { forbiddenFilenameReason, parseNullSeparated } from './security-rules.mjs';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modpack = JSON.parse(readFileSync(path.join(scriptRoot, 'modpack', 'modpack.json'), 'utf8'));

function usage() {
  return 'Usage: node scripts/preflight.mjs --target <directory> [--expected-head <commit>] [--json] [--verbose-paths]';
}

function git(target, args) {
  try {
    return {
      ok: true,
      stdout: execFileSync('git', ['-C', target, ...args], {
        encoding: 'buffer',
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
        stdio: ['ignore', 'pipe', 'pipe']
      })
    };
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? Buffer.alloc(0), stderr: error.stderr ?? Buffer.alloc(0) };
  }
}

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = valueAfter('--target');
const expectedHead = valueAfter('--expected-head') ?? modpack.upstream.baselineCommit;
const asJson = args.includes('--json');
const verbosePaths = args.includes('--verbose-paths');

if (!target || target.startsWith('--') || !/^[0-9a-f]{40}$/i.test(expectedHead)) {
  console.error(usage());
  process.exit(2);
}

const resolvedTarget = path.resolve(target);
if (!existsSync(resolvedTarget) || !statSync(resolvedTarget).isDirectory()) {
  console.error('Target directory does not exist.');
  process.exit(2);
}

const repoCheck = git(resolvedTarget, ['rev-parse', '--is-inside-work-tree']);
if (!repoCheck.ok || repoCheck.stdout.toString('utf8').trim() !== 'true') {
  console.error('Target is not a Git working tree.');
  process.exit(3);
}

const headCheck = git(resolvedTarget, ['rev-parse', 'HEAD']);
const statusCheck = git(resolvedTarget, ['status', '--porcelain=v1', '--untracked-files=all']);
const candidateCheck = git(resolvedTarget, ['ls-files', '-co', '--exclude-standard', '-z']);
const unmergedCheck = git(resolvedTarget, ['ls-files', '-u', '-z']);
if (![headCheck, statusCheck, candidateCheck, unmergedCheck].every(({ ok }) => ok)) {
  console.error('Unable to inspect target Git working tree.');
  process.exit(4);
}

const head = headCheck.stdout.toString('utf8').trim();
const dirtyEntries = statusCheck.stdout.toString('utf8').split(/\r?\n/).filter(Boolean);
const candidates = parseNullSeparated(candidateCheck.stdout);
const sensitiveNames = candidates
  .map((relative) => ({ path: relative, reason: forbiddenFilenameReason(relative) }))
  .filter(({ reason }) => reason);
const unmergedEntries = parseNullSeparated(unmergedCheck.stdout);
const result = {
  target: verbosePaths ? resolvedTarget : path.basename(resolvedTarget),
  head,
  expectedHead,
  baselineMatches: head.toLowerCase() === expectedHead.toLowerCase(),
  workingTree: { clean: dirtyEntries.length === 0, count: dirtyEntries.length },
  unmergedCount: unmergedEntries.length,
  sensitiveNameCount: sensitiveNames.length,
  policy: 'git-inspection-with-optional-locks-disabled'
};
if (verbosePaths) {
  result.workingTree.entries = dirtyEntries;
  result.unmergedEntries = unmergedEntries;
  result.sensitiveNames = sensitiveNames;
}

if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`HEAD matches expected baseline: ${result.baselineMatches ? 'yes' : 'no'}`);
  console.log(`Working tree: ${result.workingTree.clean ? 'clean' : `dirty (${result.workingTree.count})`}`);
  console.log(`Unmerged index entries: ${result.unmergedCount}`);
  console.log(`Sensitive filenames: ${result.sensitiveNameCount}`);
}

if (unmergedEntries.length && sensitiveNames.length) process.exit(7);
if (unmergedEntries.length) process.exit(5);
if (sensitiveNames.length) process.exit(6);
if (dirtyEntries.length) process.exit(8);
if (!result.baselineMatches) process.exit(9);
process.exit(0);
