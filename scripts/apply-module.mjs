#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modpack = JSON.parse(readFileSync(path.join(root, 'modpack/modpack.json'), 'utf8'));
const [moduleId] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const targetIndex = process.argv.indexOf('--target');
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
const write = process.argv.includes('--write');
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
if (!moduleId || !target || target.startsWith('--')) fail('Usage: node scripts/apply-module.mjs <ready-module> --target <directory> [--write]');
const entry = modpack.modules.find(({ id }) => id === moduleId);
if (!entry || entry.status !== 'ready') fail('Requested module is not ready to apply.');
const manifest = JSON.parse(readFileSync(path.join(root, entry.manifest), 'utf8'));
if (!manifest.applySupported) fail('Requested module does not support apply.');
const patch = path.join(root, 'modules', moduleId, 'patches', `${modpack.upstream.baselineCommit.slice(0, 7)}.patch`);
const resolved = path.resolve(target);
if (!existsSync(resolved) || !statSync(resolved).isDirectory() || !existsSync(patch)) fail('Target or module patch does not exist.');
const git = (args) => execFileSync('git', ['-C', resolved, ...args], { encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') fail('Target is not a Git working tree.');
  if (git(['rev-parse', 'HEAD']) !== modpack.upstream.baselineCommit) fail('Target HEAD does not match module baseline.');
  if (git(['status', '--porcelain=v1', '--untracked-files=all'])) fail('Target working tree is not clean.');
  execFileSync('git', ['-C', resolved, 'apply', '--check', patch], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  if (!write) { console.log(`Dry run passed for ${moduleId}. No files were written.`); process.exit(0); }
  execFileSync('git', ['-C', resolved, 'apply', patch], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(`Applied ${moduleId}.`);
} catch (error) { fail('Module apply refused: target could not be validated or patch could not be applied.', 1); }
