#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const index = args.indexOf('--target');
const target = index >= 0 ? args[index + 1] : undefined;
if (!target || target.startsWith('--')) { console.error('Usage: npm run verify:memory -- --target <clean-baseline-repo>'); process.exit(2); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolved = path.resolve(target);
if (!existsSync(path.join(resolved, 'node_modules'))) { console.error('Target must already have its dependencies installed.'); process.exit(2); }
for (const moduleId of ['core-integration', 'emotion-safety', 'memory-ombre']) {
  const applyArgs = [path.join(root, 'scripts/apply-module.mjs'), moduleId, '--target', resolved];
  execFileSync(process.execPath, applyArgs, { stdio: 'inherit' });
  execFileSync(process.execPath, [...applyArgs, '--write'], { stdio: 'inherit' });
}
const testFiles = [
  'utils/memoryPalace/authoritativeCache.test.ts',
  'utils/memoryPalace/deleteMemory.test.ts',
  'utils/memoryPalace/eventBox.localOnly.test.ts',
  'utils/memoryPalace/eventBoxCompression.rollingCycle.test.ts',
  'utils/memoryPalace/hybridSearch.rollingCycle.test.ts',
  'utils/memoryPalace/rollingCycle.test.ts',
  'utils/memoryPalace/rollingCycleArchive.test.ts',
  'utils/memoryPalace/rollingCycleArchive.concurrent.test.ts',
  'utils/memoryPalace/rollingCycleWriteRace.test.ts',
  'utils/memoryPalace/selfNarrative.test.ts',
  'utils/memoryPalace/selfNarrativeContext.test.ts',
  'utils/memoryPalace/stableCognition.test.ts',
  'utils/memoryPalace/vectorStore.rollingCycle.test.ts',
];
const vitestCli = path.join(resolved, 'node_modules', 'vitest', 'vitest.mjs');
if (!existsSync(vitestCli)) { console.error('Target dependencies do not include Vitest.'); process.exit(2); }
execFileSync(process.execPath, [vitestCli, 'run', ...testFiles], { cwd: resolved, stdio: 'inherit' });
execFileSync('git', ['-C', resolved, 'diff', '--check'], { stdio: 'inherit' });
