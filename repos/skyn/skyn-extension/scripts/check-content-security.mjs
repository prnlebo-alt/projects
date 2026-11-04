import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const contentDir = join(root, 'src/content');

const forbidden = [
  { pattern: /\bdocument\.cookie\b/, reason: 'must not access cookies on target domains' },
  { pattern: /\b(?:window\.)?localStorage\b/, reason: 'must not access localStorage on target domains' },
  { pattern: /\b(?:window\.)?sessionStorage\b/, reason: 'must not access sessionStorage on target domains' },
  { pattern: /\baddEventListener\(\s*['"]key(?:down|up|press)['"]/, reason: 'must not listen for keyboard events' },
  { pattern: /\bon(?:key(?:down|up|press))\s*=/, reason: 'must not attach keyboard handlers' },
  { pattern: /\.innerText\b/, reason: 'must not read page text' },
  { pattern: /\.innerHTML\b/, reason: 'must not read or mutate page HTML' },
  { pattern: /\.outerHTML\b/, reason: 'must not read page HTML' },
  { pattern: /\.value\b/, reason: 'must not access input values' },
  { pattern: /\bgetSelection\(/, reason: 'must not inspect user-selected page content' },
  { pattern: /\bSelection\b/, reason: 'must not inspect user-selected page content' },
  { pattern: /\bClipboardEvent\b/, reason: 'must not inspect clipboard/input events' },
  { pattern: /\bInputEvent\b/, reason: 'must not inspect input events' },
];

const files = listTsFiles(contentDir);
const violations = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');

  for (const { pattern, reason } of forbidden) {
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith('//')) return;
      // Per-line opt-out: trailing comment of the form
      //   // security-allow: <reason>
      // marks a known false positive (e.g., reading an Attr.value rather than
      // an input element value). The reason is required so reviewers can audit.
      if (/\/\/\s*security-allow:\s*\S+/.test(line)) return;
      if (pattern.test(line)) {
        violations.push(`${relative(root, file)}:${index + 1} ${reason}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Content-script security constraint failed:\n');
  console.error(violations.join('\n'));
  process.exit(1);
}

function listTsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return listTsFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}
