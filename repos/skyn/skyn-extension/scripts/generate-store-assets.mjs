import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const source =
  '/Users/jessicasalgado/Downloads/ChatGPT Image May 6, 2026 at 04_08_59 PM.png';

const iconTargets = [
  ['assets/icon-16.png', 16],
  ['assets/icon-48.png', 48],
  ['assets/icon-128.png', 128],
  ['src/assets/icon-16.png', 16],
  ['src/assets/icon-48.png', 48],
  ['src/assets/icon-128.png', 128],
  ['public/icons/icon-16.png', 16],
  ['public/icons/icon-48.png', 48],
  ['public/icons/icon-128.png', 128],
];

async function ensureDir(file) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
}

async function writeIcon(file, size) {
  await ensureDir(file);
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .removeAlpha()
    .png()
    .toFile(path.join(root, file));
}

function tileSvg(width, height, variant) {
  const isMarquee = variant === 'marquee';
  const titleSize = isMarquee ? 92 : 42;
  const subtitleSize = isMarquee ? 34 : 18;
  const iconSize = isMarquee ? 390 : 156;
  const iconX = isMarquee ? 90 : 28;
  const iconY = (height - iconSize) / 2;
  const textX = isMarquee ? 560 : 215;
  const titleY = isMarquee ? 235 : 118;
  const subtitleY = isMarquee ? 292 : 153;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#06040d"/>
          <stop offset="0.48" stop-color="#130823"/>
          <stop offset="1" stop-color="#2b0d4b"/>
        </linearGradient>
        <radialGradient id="glow" cx="35%" cy="45%" r="70%">
          <stop offset="0" stop-color="#b98cff" stop-opacity="0.34"/>
          <stop offset="0.45" stop-color="#7c3aed" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect width="${width}" height="${height}" fill="url(#glow)"/>
      <circle cx="${width * 0.86}" cy="${height * 0.18}" r="${isMarquee ? 170 : 70}" fill="#a78bfa" opacity="0.12"/>
      <text x="${textX}" y="${titleY}" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff">Skyn</text>
      <text x="${textX}" y="${subtitleY}" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${subtitleSize}" font-weight="500" fill="#d8c7ff">Dress your AI.</text>
      <text x="${textX}" y="${subtitleY + (isMarquee ? 54 : 30)}" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${isMarquee ? 28 : 14}" font-weight="500" fill="#a7a0b8">Custom skins for Claude, ChatGPT, and Gemini</text>
    </svg>
  `;
}

async function writeTile(file, width, height, variant) {
  await ensureDir(file);
  const iconSize = variant === 'marquee' ? 390 : 156;
  const iconX = variant === 'marquee' ? 90 : 28;
  const iconY = Math.round((height - iconSize) / 2);
  const iconBuffer = await sharp(source)
    .resize(iconSize, iconSize, { fit: 'cover' })
    .removeAlpha()
    .png()
    .toBuffer();

  await sharp(Buffer.from(tileSvg(width, height, variant)))
    .composite([{ input: iconBuffer, left: iconX, top: iconY }])
    .removeAlpha()
    .png()
    .toFile(path.join(root, file));
}

for (const [file, size] of iconTargets) {
  await writeIcon(file, size);
}

await writeTile('store-small-promo-tile.png', 440, 280, 'small');
await writeTile('store-marquee-promo-tile.png', 1400, 560, 'marquee');

console.log('Generated Skyn icons and Chrome Web Store promo tiles.');
