import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/apply-module.mjs');
const source = process.env.SULLY_BASELINE_REPO;
const makeRepo = () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'sully-apply-'));
  rmSync(repo, { recursive: true, force: true });
  execFileSync('git', ['clone', '--no-hardlinks', source, repo], { stdio: 'ignore' });
  execFileSync('git', ['-C', repo, 'checkout', '--detach', '4dc992f'], { stdio: 'ignore' });
  return repo;
};
const run = (repo, ...extra) => spawnSync(process.execPath, [script, 'emotion-safety', '--target', repo, ...extra], { encoding: 'utf8' });

test('dry run does not write and write applies to a clean baseline clone', { skip: !source }, () => {
  const repo = makeRepo();
  try {
    const before = readFileSync(path.join(repo, 'utils/context.ts'), 'utf8');
    assert.equal(run(repo).status, 0); assert.equal(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), before);
    assert.equal(run(repo, '--write').status, 0); assert.match(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), /buildEmotionBuffInjection/);
  } finally { rmSync(repo, { recursive: true, force: true, maxRetries: 3 }); }
});
test('refuses a wrong HEAD and a dirty target', { skip: !source }, () => {
  const repo = makeRepo(); const clean = makeRepo();
  try {
    execFileSync('git', ['-C', repo, 'commit', '--allow-empty', '-m', 'wrong']); assert.notEqual(run(repo).status, 0);
    writeFileSync(path.join(clean, 'dirty.txt'), 'x'); assert.notEqual(run(clean).status, 0);
  } finally { rmSync(repo, { recursive: true, force: true, maxRetries: 3 }); rmSync(clean, { recursive: true, force: true, maxRetries: 3 }); }
});

test('emotion patch is restricted to the reviewed file whitelist', () => {
  const patch = readFileSync(path.join(root, 'modules/emotion-safety/patches/4dc992f.patch'), 'utf8');
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map(([, file]) => file).sort();
  assert.deepEqual(paths, ['hooks/useChatAI.ts', 'utils/context.ts', 'utils/contextVolatileSplit.test.ts', 'utils/emotionAmsgRace.test.ts', 'utils/emotionApply.test.ts', 'utils/emotionApply.ts', 'utils/emotionBuff.test.ts', 'utils/emotionBuff.ts'].sort());
});
