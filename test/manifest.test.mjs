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
  assert.equal(manifest.schemaVersion, '1.1');
  assert.equal(manifest.upstream.baselineCommit, '4dc992f31e3fc426c91ef55f4d45d08d1ef0839d');
  assert.equal(manifest.upstream.formalReleasePath, '/var/www/sully.release-20260813-nursery-local-tools-v1');
  assert.equal(new Set(manifest.modules.map(({ id }) => id)).size, manifest.modules.length);
});

test('modules have honest metadata and known dependencies', async () => {
  const rootManifest = await readJson('modpack/modpack.json');
  const moduleSchema = await readJson('modpack/module.schema.json');
  for (const entry of rootManifest.modules) {
    assert.ok(['inventory', 'ready', 'baseline-provided'].includes(entry.status));
    const moduleManifest = await readJson(entry.manifest);
    assert.deepEqual(validateSchema(moduleManifest, moduleSchema), []);
    assert.equal(entry.manifest, `modules/${entry.id}/manifest.json`);
    assert.equal(moduleManifest.id, entry.id);
    assert.equal(moduleManifest.status, entry.status);
    assert.equal(moduleManifest.applySupported, ['core-integration', 'emotion-safety', 'memory-ombre', 'anthropic-api-cache', 'free-activity-mcp'].includes(entry.id));
    assert.equal(moduleManifest.containsSecrets, false);
    assert.ok(['formal', 'mixed', 'experimental'].includes(moduleManifest.releaseBoundary));
    for (const dependency of moduleManifest.dependsOn) {
      assert.ok(rootManifest.modules.some(({ id }) => id === dependency));
      assert.notEqual(dependency, entry.id);
    }
    await readFile(path.join(root, 'modules', entry.id, 'README.md'), 'utf8');
  }
});

test('module schema conditions reject contradictory install states', async () => {
  const schema = await readJson('modpack/module.schema.json');
  const inventory = await readJson('modules/push-runtime/manifest.json');
  const badInventory = { ...inventory, applySupported: true };
  assert.notDeepEqual(validateSchema(badInventory, schema), []);
  const ready = await readJson('modules/emotion-safety/manifest.json');
  const badReady = { ...ready, install: { ...ready.install, mode: 'baseline-provided' } };
  assert.notDeepEqual(validateSchema(badReady, schema), []);
  const core = await readJson('modules/core-integration/manifest.json');
  const badCore = { ...core, install: { ...core.install, base: { kind: 'module-tree', tree: core.install.base.tree } } };
  assert.notDeepEqual(validateSchema(badCore, schema), []);
});

test('ready patches declare the reviewed memory chain and direct-core branches', async () => {
  const rootManifest = await readJson('modpack/modpack.json');
  const ready = rootManifest.modules.filter(({ status }) => status === 'ready');
  assert.deepEqual(ready.map(({ id }) => id), ['core-integration', 'emotion-safety', 'memory-ombre', 'anthropic-api-cache', 'free-activity-mcp']);
  const core = await readJson('modules/core-integration/manifest.json');
  assert.equal(core.status, 'ready');
  assert.equal(core.install.mode, 'patch');
  assert.equal(core.install.patch, 'patches/4dc992f.patch');
  assert.equal(core.install.base.tree, '8acf736e5b1bd59a15fc446b99315685b5524bc8');
  assert.equal(core.install.resultTree, '8c3f03a2f1ad26b0b84bb614368cc0d8d453ba03');
  const coreEvidence = await readJson('modules/core-integration/production-evidence.json');
  assert.deepEqual(coreEvidence.formalWebRelease.markers, ['sully-app-memory', 'sullyos_apk_access_token_v1']);
  assert.match(coreEvidence.limits, /does not establish formal route execution/);
  const emotion = await readJson('modules/emotion-safety/manifest.json');
  assert.equal(emotion.install.base.kind, 'module-tree');
  assert.equal(emotion.install.base.module, 'core-integration');
  assert.equal(emotion.install.base.tree, core.install.resultTree);
  assert.equal(emotion.install.resultTree, '3a81d3442f5786f6a2c9dd2549a4fd1746a6b8b0');
  await readFile(path.join(root, 'modules/emotion-safety/patches/4dc992f.patch'), 'utf8');
  const memory = await readJson('modules/memory-ombre/manifest.json');
  assert.deepEqual(memory.dependsOn, ['core-integration', 'emotion-safety']);
  assert.equal(memory.install.mode, 'patch');
  assert.equal(memory.install.base.kind, 'module-tree');
  assert.equal(memory.install.base.module, 'emotion-safety');
  assert.equal(memory.install.base.tree, emotion.install.resultTree);
  assert.equal(memory.install.resultTree, 'e471f180c670888bf07184f653482db2c3a25d6b');
  await readFile(path.join(root, 'modules/memory-ombre/patches/8c3f03a.patch'), 'utf8');
  const anthropic = await readJson('modules/anthropic-api-cache/manifest.json');
  assert.deepEqual(anthropic.dependsOn, ['core-integration']);
  assert.equal(anthropic.install.mode, 'patch');
  assert.equal(anthropic.install.base.kind, 'module-tree');
  assert.equal(anthropic.install.base.module, 'core-integration');
  assert.equal(anthropic.install.base.tree, core.install.resultTree);
  assert.equal(anthropic.install.resultTree, 'e8be4591025ec2ea8e85169ef750128675f518ce');
  await readFile(path.join(root, 'modules/anthropic-api-cache/patches/8c3f03a.patch'), 'utf8');
  const anthropicEvidence = await readJson('modules/anthropic-api-cache/review-evidence.json');
  assert.equal(anthropicEvidence.verification.tests, 68);
  assert.match(anthropicEvidence.limits, /does not prove formal Web/);
  const freeActivity = await readJson('modules/free-activity-mcp/manifest.json');
  assert.deepEqual(freeActivity.dependsOn, ['core-integration']);
  assert.equal(freeActivity.install.mode, 'patch');
  assert.equal(freeActivity.install.base.kind, 'module-tree');
  assert.equal(freeActivity.install.base.module, 'core-integration');
  assert.equal(freeActivity.install.base.tree, core.install.resultTree);
  assert.equal(freeActivity.install.resultTree, 'eea3cc83e2daa1898459b8b5045ee2a70af963f7');
  await readFile(path.join(root, 'modules/free-activity-mcp/patches/8c3f03a.patch'), 'utf8');
  const freeActivityEvidence = await readJson('modules/free-activity-mcp/review-evidence.json');
  assert.equal(freeActivityEvidence.verification.specializedTests, 21);
  assert.equal(freeActivityEvidence.verification.mcpCallChainAssertions, 59);
  const evidence = await readJson('modules/emotion-safety/production-evidence.json');
  assert.equal(evidence.formalWebRelease.bundle, 'assets/memory-palace-CAB2KLDe.js');
  assert.match(evidence.limits, /not a complete source snapshot/);
});

test('shadow stays experimental', async () => {
  const shadow = await readJson('modules/shadow/manifest.json');
  assert.equal(shadow.releaseBoundary, 'experimental');
  assert.equal(shadow.applySupported, false);
});
