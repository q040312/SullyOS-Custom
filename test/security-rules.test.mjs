import assert from 'node:assert/strict';
import test from 'node:test';
import { forbiddenFilenameReason, secretPatternNames } from '../scripts/security-rules.mjs';

test('forbidden filenames reject secrets, artifacts and private data', () => {
  assert.equal(forbiddenFilenameReason('.env.example'), null);
  assert.equal(forbiddenFilenameReason('.env.capacitor'), 'environment-file');
  assert.equal(forbiddenFilenameReason('android/app/google-services.json'), 'credential-or-platform-configuration');
  assert.equal(forbiddenFilenameReason('release/app.apk'), 'sensitive-extension');
  assert.equal(forbiddenFilenameReason('release/site.tar.gz'), 'archive-or-database-export');
  assert.equal(forbiddenFilenameReason('backups/snapshot.json'), 'local-data-directory');
});

test('secret scanner reports names without echoing values', () => {
  const fixture = ['api', 'key'].join('_') + '="this-is-a-placeholder-secret"';
  const names = secretPatternNames(Buffer.from(fixture));
  assert.ok(names.includes('dotenv-secret'));
  assert.ok(names.includes('code-secret-assignment'));
  assert.ok(!JSON.stringify(names).includes('placeholder-secret'));
});

test('secret scanner detects common unquoted and JSON credential shapes', () => {
  const dotenv = ['SERVICE', 'TOKEN'].join('_') + '=realistic-value-12345';
  const json = `{"${['api', 'key'].join('_')}":"realistic-value-12345"}`;
  assert.ok(secretPatternNames(Buffer.from(dotenv)).includes('dotenv-secret'));
  assert.ok(secretPatternNames(Buffer.from(json)).includes('json-secret'));
  assert.equal(forbiddenFilenameReason('.npmrc'), 'credential-or-platform-configuration');
  assert.equal(forbiddenFilenameReason('dump.sql.gz'), 'archive-or-database-export');
});
