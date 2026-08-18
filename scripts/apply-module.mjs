#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const git = (directory, args, env = {}) => execFileSync('git', ['-C', directory, ...args], {
  encoding: 'utf8',
  env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env },
  stdio: ['ignore', 'pipe', 'pipe']
}).trim();
const gitSucceeds = (directory, args) => {
  try { git(directory, args); return true; } catch { return false; }
};

function targetTree(directory) {
  const indexDirectory = mkdtempSync(path.join(tmpdir(), 'sully-modpack-index-'));
  const indexFile = path.join(indexDirectory, 'index');
  try {
    const env = { GIT_INDEX_FILE: indexFile };
    git(directory, ['read-tree', 'HEAD'], env);
    git(directory, ['add', '--all'], env);
    return git(directory, ['write-tree'], env);
  } finally {
    rmSync(indexDirectory, { recursive: true, force: true, maxRetries: 3 });
  }
}

function previewPatchTree(directory, baseTree, patch) {
  const indexDirectory = mkdtempSync(path.join(tmpdir(), 'sully-modpack-preview-'));
  const indexFile = path.join(indexDirectory, 'index');
  try {
    const env = { GIT_INDEX_FILE: indexFile };
    git(directory, ['read-tree', baseTree], env);
    // --cached changes only this disposable index. It cannot write the target
    // worktree; its resulting Git tree is the exact dry-run installation state.
    execFileSync('git', ['-C', directory, 'apply', '--cached', '--ignore-space-change', patch], {
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe']
    });
    return git(directory, ['write-tree'], env);
  } finally {
    rmSync(indexDirectory, { recursive: true, force: true, maxRetries: 3 });
  }
}

function readModule(entry) {
  return JSON.parse(readFileSync(path.join(root, entry.manifest), 'utf8'));
}

function validateModuleShape(entry, manifest, baselineTree) {
  const install = manifest.install;
  if (entry.status !== manifest.status) fail('Root and module manifest statuses disagree.');
  if (entry.status === 'inventory') {
    if (manifest.applySupported || install) fail('Inventory modules cannot declare an install.');
    return;
  }
  if (!install || !install.base || !/^[0-9a-f]{40}$/.test(install.resultTree || '') || !manifest.applySupported) {
    fail('Applicable module has no reviewable install tree declaration.');
  }
  if (entry.status === 'baseline-provided') {
    if (install.mode !== 'baseline-provided' || install.patch || install.base.kind !== 'upstream-tree' ||
        install.base.tree !== baselineTree || install.resultTree !== install.base.tree || manifest.dependsOn.length) {
      fail('Baseline-provided module declaration is invalid.');
    }
    return;
  }
  if (entry.status !== 'ready' || install.mode !== 'patch' || !/^patches\/[0-9a-f]{7,40}\.patch$/.test(install.patch || '')) {
    fail('Ready module declaration is invalid.');
  }
  if (install.base.kind === 'upstream-tree') {
    if (install.base.tree !== baselineTree || manifest.dependsOn.length) fail('Root patch module must start at the pinned upstream tree.');
  } else if (install.base.kind !== 'module-tree' || !install.base.module) {
    fail('Ready module patch base is invalid.');
  }
}

function validateDependencyChain(moduleId, entries, manifests, baselineTree) {
  const visiting = new Set();
  const validated = new Set();
  const ancestorCache = new Map();
  const ancestors = (id) => {
    if (ancestorCache.has(id)) return ancestorCache.get(id);
    const manifest = manifests.get(id);
    const result = new Set();
    for (const dependency of manifest.dependsOn) {
      result.add(dependency);
      for (const ancestor of ancestors(dependency)) result.add(ancestor);
    }
    ancestorCache.set(id, result);
    return result;
  };
  const visit = (id) => {
    if (validated.has(id)) return;
    if (visiting.has(id)) fail('Module dependency cycle detected.');
    const entry = entries.get(id);
    const manifest = manifests.get(id);
    if (!entry || !manifest) fail('Module dependency does not exist.');
    visiting.add(id);
    validateModuleShape(entry, manifest, baselineTree);
    for (const dependency of manifest.dependsOn) visit(dependency);
    if (manifest.install?.base?.kind === 'module-tree') {
      const direct = manifest.install.base.module;
      if (manifest.dependsOn.at(-1) !== direct) fail('Patch base module must be the direct predecessor.');
      const predecessor = manifests.get(direct);
      if (!predecessor || predecessor.install?.resultTree !== manifest.install.base.tree) {
        fail('Patch base does not match the direct predecessor result tree.');
      }
      const predecessorAncestors = ancestors(direct);
      for (const dependency of manifest.dependsOn) {
        if (dependency !== direct && !predecessorAncestors.has(dependency)) {
          fail('Direct predecessor does not cover every declared dependency.');
        }
      }
    }
    visiting.delete(id);
    validated.add(id);
  };
  visit(moduleId);
}

function patchPath(entry, manifest) {
  if (manifest.install.mode === 'baseline-provided') return null;
  const moduleDirectory = path.join(root, 'modules', entry.id);
  const patch = path.resolve(moduleDirectory, manifest.install.patch);
  if (!patch.startsWith(`${moduleDirectory}${path.sep}`) || !existsSync(patch)) fail('Module patch does not exist.');
  return patch;
}

if (!moduleId || !target || target.startsWith('--')) fail('Usage: node scripts/apply-module.mjs <ready-module> --target <directory> [--write]');
const entry = modpack.modules.find(({ id }) => id === moduleId);
if (!entry) fail('Requested module does not exist.');
const entries = new Map(modpack.modules.map((candidate) => [candidate.id, candidate]));
const manifests = new Map(modpack.modules.map((candidate) => [candidate.id, readModule(candidate)]));
const manifest = manifests.get(moduleId);
const resolved = path.resolve(target);
if (!existsSync(resolved) || !statSync(resolved).isDirectory()) fail('Target does not exist.');

try {
  if (git(resolved, ['rev-parse', '--is-inside-work-tree']) !== 'true') fail('Target is not a Git working tree.');
  if (git(resolved, ['rev-parse', 'HEAD']) !== modpack.upstream.baselineCommit) fail('Target HEAD does not match the pinned baseline.');
  if (git(resolved, ['ls-files', '-u', '-z'])) fail('Target index has unresolved entries.');
  if (!gitSucceeds(resolved, ['diff', '--cached', '--quiet'])) fail('Target index has staged changes.');

  const baselineTree = git(resolved, ['rev-parse', `${modpack.upstream.baselineCommit}^{tree}`]);
  validateDependencyChain(moduleId, entries, manifests, baselineTree);
  if (!['ready', 'baseline-provided'].includes(entry.status) || !manifest.applySupported) fail('Requested module is not ready to apply.');
  const patch = patchPath(entry, manifest);
  const actualTree = targetTree(resolved);
  if (actualTree === manifest.install.resultTree && manifest.install.mode === 'patch') {
    fail('Module apply refused: this module is already represented by the target tree.');
  }
  if (actualTree !== manifest.install.base.tree) {
    fail('Module apply refused: target tree does not match this module\'s exact patch base.');
  }
  if (!patch) {
    console.log(`Verified ${moduleId}: provided by the pinned baseline. No files were written.`);
    process.exit(0);
  }

  const previewTree = previewPatchTree(resolved, actualTree, patch);
  if (previewTree !== manifest.install.resultTree) fail('Module apply refused: dry-run result tree does not match the reviewed declaration.');
  if (!write) {
    console.log(`Dry run passed for ${moduleId}. No files were written.`);
    process.exit(0);
  }
  // git apply without --reject is atomic: it writes no partial hunk on failure.
  // Any error after a successful write (including post-tree inspection) reverses
  // only this reviewed patch and proves restoration of the supplied base tree.
  let patchApplied = false;
  try {
    execFileSync('git', ['-C', resolved, 'apply', '--ignore-space-change', patch], {
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    patchApplied = true;
    if (targetTree(resolved) !== manifest.install.resultTree) throw new Error('post-apply tree mismatch');
  } catch (error) {
    if (!patchApplied) throw error;
    try {
      execFileSync('git', ['-C', resolved, 'apply', '--reverse', '--ignore-space-change', patch], {
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, stdio: ['ignore', 'pipe', 'pipe']
      });
      if (targetTree(resolved) !== actualTree) throw new Error('rollback did not restore the exact base tree');
    } catch {
      fail('Module apply produced an unexpected tree and automatic rollback failed; manual recovery is required.', 1);
    }
    fail('Module apply failed after writing and was rolled back to the exact base tree.', 1);
  }
  console.log(`Applied ${moduleId}.`);
} catch (error) {
  fail('Module apply refused: target could not be validated or patch could not be applied.', 1);
}
