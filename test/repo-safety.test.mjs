import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const safety = path.join(root, 'scripts', 'repo-safety.mjs');

test('repo safety fails closed for a staged oversized blob deleted from disk', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'sully-safety-'));
  execFileSync('git', ['init', '-q', repo]);
  const candidate = path.join(repo, 'ordinary.txt');
  writeFileSync(candidate, Buffer.alloc(2 * 1024 * 1024 + 1, 65));
  execFileSync('git', ['-C', repo, 'add', 'ordinary.txt']);
  rmSync(candidate);
  const result = spawnSync(process.execPath, [safety, '--root', repo, '--json', '--verbose-paths'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.issues.some(({ type, source }) => type === 'oversized-index-candidate' && source === 'index'));
});
