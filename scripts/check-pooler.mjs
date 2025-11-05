import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.turbo',
  '.next',
  'out',
  '.vercel',
  '.pnpm-store',
]);

const portDigits = ['54', '32'].join('');

const bannedPatterns = [
  {
    pattern: new RegExp('db\\.gywjhlqmqucjkneucjbp\\.supabase\\.co'),
    description: 'direct Supabase host (db.<project>.supabase.co) detected',
  },
  {
    pattern: new RegExp(`:${portDigits}\\b`),
    description: `direct PostgreSQL port ${portDigits} detected`,
  },
];

const isTestFile = (filePath) => {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/__tests__/')) return true;
  if (/\.spec\.|\.test\./.test(normalized)) return true;
  return false;
};

const violations = [];

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const relativePath = path.relative(projectRoot, entryPath);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      walk(entryPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isTestFile(relativePath)) continue;

    // Skip obvious binary files by extension
    if (/\.(png|jpg|jpeg|gif|webp|ico|lock|zip|gz|tar|tgz|exe|dll)$/i.test(entry.name)) {
      continue;
    }

    const contents = readFileSync(entryPath, 'utf8');

    for (const rule of bannedPatterns) {
      if (rule.pattern.test(contents)) {
        violations.push({
          file: relativePath,
          description: rule.description,
        });
      }
    }
  }
}

walk(projectRoot);

if (violations.length > 0) {
  console.error('Pooler compliance check failed. Remove direct connection references:');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.description}`);
  }
  process.exit(1);
}

console.log('Pooler compliance check passed.');

