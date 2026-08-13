import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateSchema } from '../scripts/schema-validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));

test('root manifest pins verified references and mixed state', async () => {
  const manifest = await readJson('modpack/modpack.json');
  const schema = await readJson('modpack/manifest.schema.json');
  assert.deepEqual(validateSchema(manifest, schema), []);
  assert.equal(manifest.kind, 'mixed');
  assert.equal(manifest.upstream.baselineCommit, '4dc992f31e3fc426c91ef55f4d45d08d1ef0839d');
  assert.equal(manifest.upstream.formalReleasePath, '/var/www/sully.release-20260813-nursery-local-tools-v1');
  assert.equal(new Set(manifest.modules.map(({ id }) => id)).size, manifest.modules.length);
});

test('modules have honest metadata and known dependencies', async () => {
  const rootManifest = await readJson('modpack/modpack.json');
  const moduleSchema = await readJson('modpack/module.schema.json');
  for (const entry of rootManifest.modules) {
    assert.ok(['inventory', 'ready'].includes(entry.status));
    const moduleManifest = await readJson(entry.manifest);
    assert.deepEqual(validateSchema(moduleManifest, moduleSchema), []);
    assert.equal(entry.manifest, `modules/${entry.id}/manifest.json`);
    assert.equal(moduleManifest.id, entry.id);
    assert.equal(moduleManifest.status, entry.status);
    assert.equal(moduleManifest.applySupported, entry.id === 'emotion-safety');
    assert.equal(moduleManifest.containsSecrets, false);
    assert.ok(['formal', 'mixed', 'experimental'].includes(moduleManifest.releaseBoundary));
    for (const dependency of moduleManifest.dependsOn) {
      assert.ok(rootManifest.modules.some(({ id }) => id === dependency));
      assert.notEqual(dependency, entry.id);
    }
    await readFile(path.join(root, 'modules', entry.id, 'README.md'), 'utf8');
  }
});

test('emotion-safety is the only ready module with a reviewable patch and bounded evidence', async () => {
  const rootManifest = await readJson('modpack/modpack.json');
  const ready = rootManifest.modules.filter(({ status }) => status === 'ready');
  assert.deepEqual(ready.map(({ id }) => id), ['emotion-safety']);
  await readFile(path.join(root, 'modules/emotion-safety/patches/4dc992f.patch'), 'utf8');
  const evidence = await readJson('modules/emotion-safety/production-evidence.json');
  assert.equal(evidence.formalWebRelease.bundle, 'assets/memory-palace-CAB2KLDe.js');
  assert.match(evidence.limits, /not a complete source snapshot/);
});

test('shadow stays experimental', async () => {
  const shadow = await readJson('modules/shadow/manifest.json');
  assert.equal(shadow.releaseBoundary, 'experimental');
  assert.equal(shadow.applySupported, false);
});
