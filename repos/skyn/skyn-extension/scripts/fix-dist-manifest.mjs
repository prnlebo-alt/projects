import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const distDir = resolve(process.cwd(), 'dist');
const assetsDir = resolve(distDir, 'assets');
const manifestPath = resolve(distDir, 'manifest.json');
const nestedPopupPath = resolve(distDir, 'src/popup/index.html');
const rootPopupPath = resolve(distDir, 'popup.html');
const contentOutputPath = resolve(distDir, 'assets/content.js');

copyFileSync(nestedPopupPath, rootPopupPath);

await build({
  entryPoints: [resolve(process.cwd(), 'src/content/index.ts')],
  outfile: contentOutputPath,
  bundle: true,
  format: 'iife',
  target: 'chrome114',
  platform: 'browser',
  legalComments: 'none',
  logLevel: 'silent',
});

for (const file of readdirSync(assetsDir)) {
  if (/^index\.ts(?:-loader)?-.*\.js$/.test(file)) {
    rmSync(resolve(assetsDir, file));
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.action?.default_popup === 'src/popup/index.html') {
  manifest.action.default_popup = 'popup.html';
}

if (Array.isArray(manifest.content_scripts)) {
  manifest.content_scripts = manifest.content_scripts.map((script) => ({
    ...script,
    js: ['assets/content.js'],
  }));
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
