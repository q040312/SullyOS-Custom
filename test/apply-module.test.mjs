import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const runFrom = (scriptPath, repo, moduleId, ...extra) => spawnSync(process.execPath, [scriptPath, moduleId, '--target', repo, ...extra], { encoding: 'utf8' });
const run = (repo, moduleId, ...extra) => runFrom(script, repo, moduleId, ...extra);
const makeFixture = () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'sully-modpack-fixture-'));
  const copy = (relative) => {
    const destination = path.join(fixture, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(root, relative), destination);
  };
  copy('scripts/apply-module.mjs');
  copy('modpack/modpack.json');
  const manifest = JSON.parse(readFileSync(path.join(root, 'modpack/modpack.json'), 'utf8'));
  for (const entry of manifest.modules) copy(entry.manifest);
  copy('modules/emotion-safety/patches/4dc992f.patch');
  copy('modules/memory-ombre/patches/8c3f03a.patch');
  copy('modules/anthropic-api-cache/patches/8c3f03a.patch');
  copy('modules/free-activity-mcp/patches/8c3f03a.patch');
  return fixture;
};

test('real clone dry-run and write use the declared cumulative trees', { skip: !source }, () => {
  const repo = makeRepo();
  try {
    const before = readFileSync(path.join(repo, 'utils/context.ts'), 'utf8');
    assert.equal(run(repo, 'core-integration').status, 0);
    assert.equal(existsSync(path.join(repo, 'utils/deploymentUrls.ts')), false);
    assert.equal(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), before);
    assert.equal(run(repo, 'core-integration', '--write').status, 0);
    assert.equal(existsSync(path.join(repo, 'utils/deploymentUrls.ts')), true);
    assert.equal(run(repo, 'emotion-safety').status, 0);
    assert.equal(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), before);
    assert.equal(run(repo, 'emotion-safety', '--write').status, 0);
    assert.match(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), /buildEmotionBuffInjection/);
    const authority = path.join(repo, 'utils/memoryPalace/authority.ts');
    assert.equal(existsSync(authority), false);
    assert.equal(run(repo, 'memory-ombre').status, 0);
    assert.equal(existsSync(authority), false);
    assert.equal(run(repo, 'memory-ombre', '--write').status, 0);
    assert.equal(existsSync(authority), true);
  } finally { rmSync(repo, { recursive: true, force: true, maxRetries: 3 }); }
});

test('real clone rejects wrong order, repeat, wrong HEAD, and dirty trees', { skip: !source }, () => {
  const applied = makeRepo();
  const wrongHead = makeRepo();
  const dirty = makeRepo();
  try {
    assert.equal(run(applied, 'core-integration', '--write').status, 0);
    assert.equal(run(applied, 'emotion-safety', '--write').status, 0);
    assert.equal(run(applied, 'memory-ombre', '--write').status, 0);
    assert.notEqual(run(applied, 'memory-ombre').status, 0, 'repeat must be refused from resultTree');
    assert.notEqual(run(applied, 'core-integration').status, 0, 'root patch cannot be applied after its dependent');
    execFileSync('git', ['-C', wrongHead, 'commit', '--allow-empty', '-m', 'wrong']);
    assert.notEqual(run(wrongHead, 'core-integration').status, 0);
    writeFileSync(path.join(dirty, 'dirty.txt'), 'x');
    assert.notEqual(run(dirty, 'core-integration').status, 0);
  } finally {
    rmSync(applied, { recursive: true, force: true, maxRetries: 3 });
    rmSync(wrongHead, { recursive: true, force: true, maxRetries: 3 });
    rmSync(dirty, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('anthropic branch dry-runs, writes, and rejects wrong order or repeat', { skip: !source }, () => {
  const repo = makeRepo();
  const wrongOrder = makeRepo();
  try {
    const native = path.join(repo, 'utils/anthropicNative.ts');
    assert.notEqual(run(wrongOrder, 'anthropic-api-cache').status, 0);
    assert.equal(run(repo, 'core-integration', '--write').status, 0);
    assert.equal(run(repo, 'anthropic-api-cache').status, 0);
    assert.equal(existsSync(native), false);
    assert.equal(run(repo, 'anthropic-api-cache', '--write').status, 0);
    assert.equal(existsSync(native), true);
    assert.notEqual(run(repo, 'anthropic-api-cache').status, 0, 'repeat must be refused from resultTree');
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 3 });
    rmSync(wrongOrder, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('free-activity direct-core branch dry-runs, writes, and rejects wrong order or repeat', { skip: !source }, () => {
  const repo = makeRepo();
  const wrongOrder = makeRepo();
  try {
    const activity = path.join(repo, 'utils/freeActivityMcp.ts');
    assert.notEqual(run(wrongOrder, 'free-activity-mcp').status, 0);
    assert.equal(run(repo, 'core-integration', '--write').status, 0);
    assert.equal(run(repo, 'free-activity-mcp').status, 0);
    assert.equal(existsSync(activity), false);
    assert.equal(run(repo, 'free-activity-mcp', '--write').status, 0);
    assert.equal(existsSync(activity), true);
    assert.notEqual(run(repo, 'free-activity-mcp').status, 0, 'repeat must be refused from resultTree');
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 3 });
    rmSync(wrongOrder, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('anthropic rejects mismatched base and result trees before writing', { skip: !source }, () => {
  const fixture = makeFixture();
  const fixtureScript = path.join(fixture, 'scripts/apply-module.mjs');
  const manifestPath = path.join(fixture, 'modules/anthropic-api-cache/manifest.json');
  const original = readFileSync(manifestPath, 'utf8');
  const repo = makeRepo();
  const native = path.join(repo, 'utils/anthropicNative.ts');
  try {
    assert.equal(run(repo, 'core-integration', '--write').status, 0);
    const badBase = JSON.parse(original);
    badBase.install.base.tree = '0'.repeat(40);
    writeFileSync(manifestPath, JSON.stringify(badBase));
    assert.notEqual(runFrom(fixtureScript, repo, 'anthropic-api-cache').status, 0);
    assert.notEqual(runFrom(fixtureScript, repo, 'anthropic-api-cache', '--write').status, 0);
    assert.equal(existsSync(native), false, 'bad base must write nothing');
    const badResult = JSON.parse(original);
    badResult.install.resultTree = '0'.repeat(40);
    writeFileSync(manifestPath, JSON.stringify(badResult));
    assert.notEqual(runFrom(fixtureScript, repo, 'anthropic-api-cache').status, 0);
    assert.notEqual(runFrom(fixtureScript, repo, 'anthropic-api-cache', '--write').status, 0);
    assert.equal(existsSync(native), false, 'bad result must write nothing');
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 3 });
    rmSync(fixture, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('mismatched preview result and invalid dependency graphs refuse before writing', { skip: !source }, () => {
  const fixture = makeFixture();
  const fixtureScript = path.join(fixture, 'scripts/apply-module.mjs');
  const rootManifestPath = path.join(fixture, 'modpack/modpack.json');
  const coreManifestPath = path.join(fixture, 'modules/core-integration/manifest.json');
  const emotionManifestPath = path.join(fixture, 'modules/emotion-safety/manifest.json');
  const rootOriginal = readFileSync(rootManifestPath, 'utf8');
  const coreOriginal = readFileSync(coreManifestPath, 'utf8');
  const emotionOriginal = readFileSync(emotionManifestPath, 'utf8');
  const repo = makeRepo();
  try {
    const before = readFileSync(path.join(repo, 'utils/context.ts'), 'utf8');
    const badResult = JSON.parse(emotionOriginal);
    badResult.install.resultTree = '0'.repeat(40);
    writeFileSync(emotionManifestPath, JSON.stringify(badResult));
    assert.notEqual(runFrom(fixtureScript, repo, 'emotion-safety').status, 0);
    assert.notEqual(runFrom(fixtureScript, repo, 'emotion-safety', '--write').status, 0);
    assert.equal(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), before, 'bad preview result must write nothing');

    const fakeChain = JSON.parse(emotionOriginal);
    fakeChain.dependsOn = ['memory-ombre', 'core-integration'];
    writeFileSync(emotionManifestPath, JSON.stringify(fakeChain));
    assert.notEqual(runFrom(fixtureScript, repo, 'emotion-safety').status, 0, 'direct predecessor must cover all dependencies');

    const missingDependency = JSON.parse(emotionOriginal);
    missingDependency.dependsOn = ['missing-module', 'core-integration'];
    writeFileSync(emotionManifestPath, JSON.stringify(missingDependency));
    assert.notEqual(runFrom(fixtureScript, repo, 'emotion-safety').status, 0, 'missing dependency must be refused');

    const cycleRoot = JSON.parse(rootOriginal);
    cycleRoot.modules.find(({ id }) => id === 'core-integration').status = 'ready';
    const cycleCore = JSON.parse(coreOriginal);
    cycleCore.status = 'ready';
    cycleCore.dependsOn = ['emotion-safety'];
    cycleCore.install = {
      mode: 'patch', patch: 'patches/4dc992f.patch',
      base: { kind: 'module-tree', module: 'emotion-safety', tree: JSON.parse(emotionOriginal).install.resultTree },
      resultTree: '1'.repeat(40)
    };
    writeFileSync(rootManifestPath, JSON.stringify(cycleRoot));
    writeFileSync(coreManifestPath, JSON.stringify(cycleCore));
    writeFileSync(emotionManifestPath, emotionOriginal);
    assert.notEqual(runFrom(fixtureScript, repo, 'emotion-safety').status, 0, 'dependency cycle must be refused');
    assert.equal(readFileSync(path.join(repo, 'utils/context.ts'), 'utf8'), before, 'invalid graph must write nothing');
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 3 });
    rmSync(fixture, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('memory rejects mismatched base and result trees before writing', { skip: !source }, () => {
  const fixture = makeFixture();
  const fixtureScript = path.join(fixture, 'scripts/apply-module.mjs');
  const memoryManifestPath = path.join(fixture, 'modules/memory-ombre/manifest.json');
  const memoryOriginal = readFileSync(memoryManifestPath, 'utf8');
  const repo = makeRepo();
  const authority = path.join(repo, 'utils/memoryPalace/authority.ts');
  try {
    assert.equal(run(repo, 'core-integration', '--write').status, 0);
    assert.equal(run(repo, 'emotion-safety', '--write').status, 0);
    const badBase = JSON.parse(memoryOriginal);
    badBase.install.base.tree = '0'.repeat(40);
    writeFileSync(memoryManifestPath, JSON.stringify(badBase));
    assert.notEqual(runFrom(fixtureScript, repo, 'memory-ombre').status, 0);
    assert.notEqual(runFrom(fixtureScript, repo, 'memory-ombre', '--write').status, 0);
    assert.equal(existsSync(authority), false, 'bad base must write nothing');
    const badResult = JSON.parse(memoryOriginal);
    badResult.install.resultTree = '0'.repeat(40);
    writeFileSync(memoryManifestPath, JSON.stringify(badResult));
    assert.notEqual(runFrom(fixtureScript, repo, 'memory-ombre').status, 0);
    assert.notEqual(runFrom(fixtureScript, repo, 'memory-ombre', '--write').status, 0);
    assert.equal(existsSync(authority), false, 'bad result must write nothing');
  } finally {
    rmSync(repo, { recursive: true, force: true, maxRetries: 3 });
    rmSync(fixture, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('emotion patch is restricted to the reviewed file whitelist', () => {
  const patch = readFileSync(path.join(root, 'modules/emotion-safety/patches/4dc992f.patch'), 'utf8');
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map(([, file]) => file).sort();
  assert.deepEqual(paths, ['hooks/useChatAI.ts', 'utils/context.ts', 'utils/contextVolatileSplit.test.ts', 'utils/emotionAmsgRace.test.ts', 'utils/emotionApply.test.ts', 'utils/emotionApply.ts', 'utils/emotionBuff.test.ts', 'utils/emotionBuff.ts'].sort());
});

test('memory patch is restricted to the reviewed file whitelist', () => {
  const patch = readFileSync(path.join(root, 'modules/memory-ombre/patches/8c3f03a.patch'), 'utf8');
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map(([, file]) => file).sort();
  assert.deepEqual(paths, [
    'context/OSContext.tsx',
    'types.ts',
    'utils/chatRequestPayload.ts',
    'utils/memoryPalace/authoritativeCache.test.ts',
    'utils/memoryPalace/authoritativeCache.ts',
    'utils/memoryPalace/authority.ts',
    'utils/memoryPalace/consolidation.ts',
    'utils/memoryPalace/db.ts',
    'utils/memoryPalace/deleteMemory.test.ts',
    'utils/memoryPalace/deleteMemory.ts',
    'utils/memoryPalace/digestion.ts',
    'utils/memoryPalace/eventBox.localOnly.test.ts',
    'utils/memoryPalace/eventBox.ts',
    'utils/memoryPalace/eventBoxCompression.rollingCycle.test.ts',
    'utils/memoryPalace/eventBoxCompression.ts',
    'utils/memoryPalace/formatter.ts',
    'utils/memoryPalace/groupPipeline.ts',
    'utils/memoryPalace/hybridSearch.rollingCycle.test.ts',
    'utils/memoryPalace/hybridSearch.ts',
    'utils/memoryPalace/index.ts',
    'utils/memoryPalace/ombreMemory.ts',
    'utils/memoryPalace/pipeline.ts',
    'utils/memoryPalace/relatedMemories.ts',
    'utils/memoryPalace/remoteVector.ts',
    'utils/memoryPalace/rollingCycle.test.ts',
    'utils/memoryPalace/rollingCycle.ts',
    'utils/memoryPalace/rollingCycleArchive.concurrent.test.ts',
    'utils/memoryPalace/rollingCycleArchive.test.ts',
    'utils/memoryPalace/rollingCycleArchive.ts',
    'utils/memoryPalace/rollingCycleWriteRace.test.ts',
    'utils/memoryPalace/selfNarrative.test.ts',
    'utils/memoryPalace/selfNarrative.ts',
    'utils/memoryPalace/selfNarrativeContext.test.ts',
    'utils/memoryPalace/selfNarrativeContext.ts',
    'utils/memoryPalace/stableCognition.test.ts',
    'utils/memoryPalace/stableCognition.ts',
    'utils/memoryPalace/stableCognitionContext.ts',
    'utils/memoryPalace/types.ts',
    'utils/memoryPalace/vectorSearch.ts',
    'utils/memoryPalace/vectorStore.rollingCycle.test.ts',
    'utils/memoryPalace/vectorStore.ts',
  ].sort());
});

test('anthropic patch is restricted to the reviewed file whitelist', () => {
  const patch = readFileSync(path.join(root, 'modules/anthropic-api-cache/patches/8c3f03a.patch'), 'utf8');
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map(([, file]) => file).sort();
  assert.deepEqual(paths, [
    'apps/Settings.tsx',
    'hooks/useChatAI.ts',
    'types.ts',
    'utils/anthropicNative.image.test.ts',
    'utils/anthropicNative.test.ts',
    'utils/anthropicNative.ts',
    'utils/anthropicPromptCache.chatLoop.wiring.test.ts',
    'utils/anthropicPromptCache.instantNativeTools.test.ts',
    'utils/anthropicPromptCache.test.ts',
    'utils/anthropicPromptCache.ts',
    'utils/apiCallLog.test.ts',
    'utils/apiCallLog.ts',
    'utils/apiConfigNormalize.test.ts',
    'utils/apiConfigNormalize.ts',
    'utils/devDebug.ts',
    'utils/independentTextApi.test.ts',
    'utils/independentTextApi.ts',
    'utils/instantPushClient.anthropicNative.test.ts',
    'utils/instantPushClient.ts',
    'utils/safeApi.apiCallLog.test.ts',
    'utils/safeApi.ts',
    'utils/settingsAnthropicNative.wiring.test.ts',
    'utils/settingsApiConnection.test.ts',
    'utils/settingsApiConnection.ts',
  ].sort());
});

test('core patch is restricted to the shared deployment URL policy and its test', () => {
  const patch = readFileSync(path.join(root, 'modules/core-integration/patches/4dc992f.patch'), 'utf8');
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map(([, file]) => file).sort();
  assert.deepEqual(paths, ['utils/deploymentUrls.core.test.ts', 'utils/deploymentUrls.ts']);
  assert.doesNotMatch(patch, /\.env\.capacitor|vpsSync|OSContext|Settings\.tsx|voiceTone/);
});

test('free-activity patch is restricted to the reviewed run-local MCP whitelist', () => {
  const patch = readFileSync(path.join(root, 'modules/free-activity-mcp/patches/8c3f03a.patch'), 'utf8');
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map(([, file]) => file).sort();
  assert.deepEqual(paths, [
    'apps/XhsFreeRoamApp.tsx',
    'components/xhs/FreeActivityApiSettingsModal.tsx',
    'types.ts',
    'utils/freeActivityApi.test.ts',
    'utils/freeActivityApi.ts',
    'utils/freeActivityAudit.test.ts',
    'utils/freeActivityAudit.ts',
    'utils/freeActivityMcp.test.ts',
    'utils/freeActivityMcp.ts',
    'utils/mcpClient.ts',
    'utils/mcpFireCore.ts',
    'utils/xhsFreeRoam.ts',
  ].sort());
  assert.doesNotMatch(patch, /Stage F|service-worker|\.env|bundle|dist\//);
});
