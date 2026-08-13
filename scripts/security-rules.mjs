import path from 'node:path';

const localDataDirectories = new Set([
  'chat', 'chats', 'conversation', 'conversations', 'memory', 'memories',
  'backup', 'backups', 'logs', 'state', 'local', 'tmp', '.wrangler'
]);

const sensitiveExtensions = new Set([
  '.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.apk', '.aab',
  '.tar', '.tgz', '.zip', '.db', '.sqlite', '.sqlite3', '.sqlitedb', '.log', '.sql', '.bak'
]);

const sensitiveBasenames = new Set([
  'google-services.json', 'googleservice-info.plist', '.npmrc', '.netrc',
  'credentials.json', 'service-account.json', 'serviceaccount.json'
]);

export function forbiddenFilenameReason(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  const parts = normalized.toLowerCase().split('/');
  const base = parts.at(-1);

  if (parts.slice(0, -1).some((part) => localDataDirectories.has(part))) return 'local-data-directory';
  if (base === '.env.example') return null;
  if (base === '.env' || base.startsWith('.env.')) return 'environment-file';
  if (sensitiveBasenames.has(base)) return 'credential-or-platform-configuration';
  if (base.endsWith('.tar.gz') || base.endsWith('.sql.gz')) return 'archive-or-database-export';
  if (sensitiveExtensions.has(path.extname(base))) return 'sensitive-extension';
  return null;
}

const secretPatterns = [
  ['private-key-block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['google-api-key', /AIza[0-9A-Za-z_-]{20,}/],
  ['github-token', /gh[pousr]_[A-Za-z0-9]{20,}/],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/],
  ['jwt', /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['dotenv-secret', /(?:^|\n)\s*(?:[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=\s*["']?[^\s"'\r\n#][^\r\n#]{7,}/i],
  ['json-secret', /["'](?:api[_-]?key|secret|token|password)["']\s*:\s*["'][^"'\r\n]{8,}/i],
  ['code-secret-assignment', /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\r\n]{8,}/i],
  ['bearer-token', /authorization\s*:\s*bearer\s+[A-Za-z0-9._~-]{12,}/i]
];

export function secretPatternNames(buffer) {
  const text = buffer.toString('utf8');
  return secretPatterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function parseNullSeparated(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}
