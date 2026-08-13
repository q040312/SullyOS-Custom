import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateSchema } from '../scripts/schema-validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'));

test('root manifest pins verified references and inventory-only state', async () => {
  const manifest = await readJson('modpack/modpack.json');
  const schema = await readJson('modpack/manifest.schema.json');
  assert.deepEqual(validateSchema(manifest, schema), []);
  assert.equal(manifest.kind, 'inventory-only');
  assert.equal(manifest.upstream.baselineCommit, '4dc992f31e3fc426c91ef55f4d45d08d1ef0839d');
  assert.equal(manifest.upstream.formalReleasePath, '/var/www/sully.release-20260813-nursery-local-tools-v1');
  assert.equal(new Set(manifest.modules.map(({ id }) => id)).size, manifest.modules.length);
});

test('every module has honest inventory metadata and known dependencies', async () => {
  const rootManifest = await readJson('modpack/modpack.json');
  const moduleSchema = await readJson('modpack/module.schema.json');
  for (const entry of rootManifest.modules) {
    assert.equal(entry.status, 'inventory');
    const moduleManifest = await readJson(entry.manifest);
    assert.deepEqual(validateSchema(moduleManifest, moduleSchema), []);
    assert.equal(entry.manifest, `modules/${entry.id}/manifest.json`);
    assert.equal(moduleManifest.id, entry.id);
    assert.equal(moduleManifest.status, 'inventory');
    assert.equal(moduleManifest.applySupported, false);
    assert.equal(moduleManifest.containsSecrets, false);
    assert.ok(['formal', 'mixed', 'experimental'].includes(moduleManifest.releaseBoundary));
    for (const dependency of moduleManifest.dependsOn) {
      assert.ok(rootManifest.modules.some(({ id }) => id === dependency));
      assert.notEqual(dependency, entry.id);
    }
    await readFile(path.join(root, 'modules', entry.id, 'README.md'), 'utf8');
  }
});

test('shadow stays experimental', async () => {
  const shadow = await readJson('modules/shadow/manifest.json');
  assert.equal(shadow.releaseBoundary, 'experimental');
  assert.equal(shadow.applySupported, false);
});
