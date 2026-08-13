import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preflight = path.join(root, 'scripts', 'preflight.mjs');

function makeRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), 'sully-preflight-'));
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Preflight Test']);
  writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['-C', repo, 'add', 'README.md']);
  execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'fixture']);
  const head = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { repo, head };
}

test('preflight accepts a clean explicitly expected baseline', () => {
  const { repo, head } = makeRepo();
  const result = spawnSync(process.execPath, [preflight, '--target', repo, '--expected-head', head], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('preflight rejects dirty and mismatched baselines', () => {
  const { repo, head } = makeRepo();
  writeFileSync(path.join(repo, 'dirty.txt'), 'dirty\n');
  const dirty = spawnSync(process.execPath, [preflight, '--target', repo, '--expected-head', head], { encoding: 'utf8' });
  assert.equal(dirty.status, 8);
  execFileSync('git', ['-C', repo, 'clean', '-f']);
  const wrong = spawnSync(process.execPath, [preflight, '--target', repo, '--expected-head', '0'.repeat(40)], { encoding: 'utf8' });
  assert.equal(wrong.status, 9);
});
