#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { forbiddenFilenameReason, parseNullSeparated, secretPatternNames } from './security-rules.mjs';

function git(root, args) {
  try {
    return {
      ok: true,
      stdout: execFileSync('git', ['-C', root, ...args], {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    };
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? Buffer.alloc(0) };
  }
}

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const requestedRoot = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();
const asJson = args.includes('--json');
if (!requestedRoot || requestedRoot.startsWith('--')) {
  console.error('Usage: node scripts/repo-safety.mjs [--root <repository>] [--json]');
  process.exit(2);
}

const root = path.resolve(requestedRoot);
const topLevel = git(root, ['rev-parse', '--show-toplevel']);
if (!topLevel.ok) {
  console.error('Repository root is not a Git working tree.');
  process.exit(2);
}
const repoRoot = topLevel.stdout.toString('utf8').trim();
const candidates = git(repoRoot, ['ls-files', '-co', '--exclude-standard', '-z']);
if (!candidates.ok) {
  console.error('Unable to read Git candidates.');
  process.exit(2);
}

const issues = [];
const seen = new Set();
function addIssue(file, type, source) {
  const key = `${file}:${type}:${source}`;
  if (!seen.has(key)) {
    seen.add(key);
    issues.push({ path: file, type, source });
  }
}

const files = parseNullSeparated(candidates.stdout);
const indexedFilesResult = git(repoRoot, ['ls-files', '--cached', '-z']);
if (!indexedFilesResult.ok) {
  console.error('Unable to read Git index.');
  process.exit(2);
}
const indexedFiles = new Set(parseNullSeparated(indexedFilesResult.stdout));
for (const file of files) {
  const forbidden = forbiddenFilenameReason(file);
  if (forbidden) addIssue(file, forbidden, 'filename');

  if (indexedFiles.has(file)) {
    const indexedSize = git(repoRoot, ['cat-file', '-s', `:${file}`]);
    const size = indexedSize.ok ? Number(indexedSize.stdout.toString('utf8').trim()) : Number.NaN;
    if (!Number.isSafeInteger(size) || size < 0) addIssue(file, 'unreadable-index-candidate', 'index');
    else if (size > 2 * 1024 * 1024) addIssue(file, 'oversized-index-candidate', 'index');
    else {
      const indexed = git(repoRoot, ['show', `:${file}`]);
      if (!indexed.ok) addIssue(file, 'unreadable-index-candidate', 'index');
      else for (const type of secretPatternNames(indexed.stdout)) addIssue(file, type, 'index');
    }
  }

  const diskPath = path.join(repoRoot, file);
  try {
    if (existsSync(diskPath) && statSync(diskPath).isFile()) {
      const size = statSync(diskPath).size;
      if (size > 2 * 1024 * 1024) addIssue(file, 'oversized-candidate', 'working-tree');
      else for (const type of secretPatternNames(readFileSync(diskPath))) addIssue(file, type, 'working-tree');
    }
  } catch {
    addIssue(file, 'unreadable-candidate', 'working-tree');
  }
}

const verbosePaths = args.includes('--verbose-paths');
const result = {
  repository: verbosePaths ? repoRoot : path.basename(repoRoot),
  checkedFiles: files.length,
  issueCount: issues.length
};
if (verbosePaths) result.issues = issues;
if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else if (issues.length) {
  console.error(`Repository safety check found ${issues.length} issue(s); secret values are intentionally not displayed.`);
  if (verbosePaths) for (const issue of issues) console.error(`- ${issue.path}: ${issue.type} (${issue.source})`);
} else {
  console.log(`Repository safety check passed (${result.checkedFiles} tracked/index candidate files).`);
}
process.exit(issues.length ? 1 : 0);
