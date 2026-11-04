import sharp from 'sharp';

const width = 1280;
const height = 800;

const skins = [
  ['Midnight', '#0e0e11', '#a78bfa', 'Free'],
  ['Snow', '#ffffff', '#228be6', 'Free'],
  ['Glass Day', '#daeeff', '#586eff', 'Free'],
  ['Galaxy', '#020010', '#9d4edd', '$2.99'],
  ['Cyber', '#040608', '#00ffcc', '$2.99'],
  ['Retro', '#1a1008', '#ff9900', '$2.99'],
  ['Cloud Nine', '#f0f8ff', '#8899dd', '$1.99'],
  ['Holo', '#04001a', '#88ffff', '$2.99'],
  ['Sakura', '#1a0a10', '#ff7096', '$2.99'],
];

await Promise.all([
  render('screenshot-1.png', popupMockup()),
  render('screenshot-2.png', claudeSkinMockup()),
  render('screenshot-3.png', marketplaceMockup()),
]);

async function render(filename, svg) {
  await sharp(Buffer.from(svg)).png().toFile(filename);
}

function shell(title, subtitle, body) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="20%" r="70%">
      <stop offset="0%" stop-color="#5b21b6"/>
      <stop offset="45%" stop-color="#171126"/>
      <stop offset="100%" stop-color="#050509"/>
    </radialGradient>
    <linearGradient id="purple" x1="0" x2="1">
      <stop offset="0%" stop-color="#f5d0fe"/>
      <stop offset="45%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="1280" height="800" fill="url(#bgGlow)"/>
  <circle cx="1070" cy="80" r="190" fill="#a855f7" opacity="0.16"/>
  <circle cx="160" cy="720" r="220" fill="#7c3aed" opacity="0.14"/>
  <text x="72" y="86" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800">${escapeXml(title)}</text>
  <text x="74" y="124" fill="#d8b4fe" font-family="Inter, Arial, sans-serif" font-size="19">${escapeXml(subtitle)}</text>
  ${body}
</svg>`;
}

function popupMockup() {
  const cards = skins.map((skin, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 696 + col * 128;
    const y = 258 + row * 118;
    return skinCard(x, y, 112, 98, skin);
  }).join('');

  return shell(
    'Skyn popup',
    'Choose a skin, preview it, and apply it to supported AI chat sites.',
    `
  <g filter="url(#shadow)">
    <rect x="90" y="170" width="420" height="540" rx="28" fill="#ffffff"/>
    <rect x="90" y="170" width="420" height="540" rx="28" fill="none" stroke="#e9d5ff" stroke-width="2"/>
    <text x="122" y="222" fill="#18181b" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800">Skyn</text>
    <text x="122" y="248" fill="#71717a" font-family="Inter, Arial, sans-serif" font-size="15">Dress your AI.</text>
    <rect x="398" y="207" width="72" height="30" rx="15" fill="#18181b"/>
    <circle cx="418" cy="222" r="9" fill="#22c55e"/>
    <text x="436" y="227" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800">ON</text>
    <rect x="122" y="276" width="108" height="38" rx="10" fill="#18181b"/>
    <text x="148" y="300" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700">My Skins</text>
    <rect x="240" y="276" width="92" height="38" rx="10" fill="#f4f4f5"/>
    <text x="260" y="300" fill="#52525b" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700">Market</text>
    <rect x="342" y="276" width="94" height="38" rx="10" fill="#f4f4f5"/>
    <text x="359" y="300" fill="#52525b" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700">Settings</text>
    <rect x="122" y="338" width="356" height="158" rx="14" fill="#0e0e11" stroke="#2a2a35"/>
    <rect x="142" y="358" width="52" height="118" rx="10" fill="#14141a"/>
    <rect x="154" y="372" width="28" height="8" rx="4" fill="#a78bfa" opacity="0.45"/>
    <rect x="154" y="394" width="26" height="8" rx="4" fill="#ffffff" opacity="0.24"/>
    <rect x="154" y="416" width="30" height="8" rx="4" fill="#ffffff" opacity="0.24"/>
    <rect x="222" y="366" width="210" height="42" rx="16" fill="#252530"/>
    <text x="244" y="392" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="15">Make it feel like me.</text>
    <rect x="214" y="424" width="238" height="48" rx="16" fill="#1e1e28"/>
    <text x="236" y="454" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="15">Done. Midnight is active.</text>
    <text x="122" y="536" fill="#18181b" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="800">Your skins</text>
    ${skinCard(122, 556, 104, 92, skins[0])}
    ${skinCard(238, 556, 104, 92, skins[1])}
    ${skinCard(354, 556, 104, 92, skins[2])}
  </g>
  <g filter="url(#shadow)">
    <rect x="650" y="170" width="460" height="540" rx="28" fill="#ffffff"/>
    <text x="696" y="222" fill="#18181b" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800">Skin grid</text>
    <text x="696" y="248" fill="#71717a" font-family="Inter, Arial, sans-serif" font-size="15">Free skins and premium styles in one popup.</text>
    ${cards}
  </g>`
  );
}

function claudeSkinMockup() {
  const messages = `
    <rect x="380" y="192" width="620" height="72" rx="22" fill="#252530"/>
    <text x="414" y="224" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">You</text>
    <text x="414" y="248" fill="#d8d5e8" font-family="Inter, Arial, sans-serif" font-size="18">Can you make my assistant match my workflow?</text>
    <rect x="310" y="304" width="690" height="112" rx="22" fill="#1e1e28"/>
    <text x="344" y="338" fill="#a78bfa" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800">Assistant</text>
    <text x="344" y="366" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="18">Absolutely. Midnight keeps the page calm, high-contrast,</text>
    <text x="344" y="394" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="18">and readable without touching conversation content.</text>
    <rect x="380" y="460" width="620" height="72" rx="22" fill="#252530"/>
    <text x="414" y="492" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">You</text>
    <text x="414" y="516" fill="#d8d5e8" font-family="Inter, Arial, sans-serif" font-size="18">Perfect. Ship it.</text>`;

  return shell(
    'Skin applied on claude.ai',
    'A CSS-only Midnight skin on a familiar AI chat layout.',
    `
  <g filter="url(#shadow)">
    <rect x="120" y="164" width="1040" height="560" rx="30" fill="#0e0e11" stroke="#2a2a35" stroke-width="2"/>
    <rect x="120" y="164" width="230" height="560" rx="30" fill="#14141a"/>
    <rect x="120" y="164" width="230" height="560" rx="30" fill="none" stroke="#2a2a35" stroke-width="2"/>
    <text x="154" y="218" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800">Skyn</text>
    <text x="154" y="248" fill="#7a7890" font-family="Inter, Arial, sans-serif" font-size="15">Midnight active</text>
    ${sidebarRow(154, 294, 'Product plan')}
    ${sidebarRow(154, 338, 'Design ideas')}
    ${sidebarRow(154, 382, 'Launch checklist')}
    ${sidebarRow(154, 426, 'Support draft')}
    <rect x="390" y="164" width="770" height="72" rx="0" fill="#14141a"/>
    <text x="424" y="210" fill="#f0eff8" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">New conversation</text>
    ${messages}
    <rect x="310" y="606" width="730" height="62" rx="22" fill="#1e1e28" stroke="#2a2a35"/>
    <text x="346" y="644" fill="#7a7890" font-family="Inter, Arial, sans-serif" font-size="18">Ask anything...</text>
    <circle cx="990" cy="637" r="19" fill="#a78bfa"/>
    <path d="M982 637 L990 629 L998 637" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`
  );
}

function marketplaceMockup() {
  const categoryLabels = ['All', 'Dark', 'Light', 'Vibrant', 'Glass', 'Pretty', 'Nature', 'Sci-fi'];
  const tabs = categoryLabels.map((label, index) => {
    const x = 102 + index * 116;
    const active = index === 0;
    return `
    <rect x="${x}" y="198" width="96" height="40" rx="12" fill="${active ? '#18181b' : '#f4f4f5'}"/>
    <text x="${x + 48}" y="224" text-anchor="middle" fill="${active ? '#fff' : '#52525b'}" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="800">${label}</text>`;
  }).join('');
  const grid = skins.slice(0, 8).map((skin, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    return skinCard(102 + col * 148, 276 + row * 132, 126, 108, skin);
  }).join('');

  return shell(
    'Skyn marketplace',
    'Browse skins by category, unlock individual styles, or buy packs.',
    `
  <g filter="url(#shadow)">
    <rect x="70" y="158" width="1140" height="580" rx="30" fill="#ffffff"/>
    <text x="102" y="214" fill="#18181b" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800">Marketplace</text>
    <g transform="translate(210,0)">${tabs}</g>
    ${grid}
    <rect x="730" y="276" width="410" height="90" rx="18" fill="#18181b"/>
    <text x="760" y="312" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">Skin Pack</text>
    <text x="760" y="340" fill="#d8b4fe" font-family="Inter, Arial, sans-serif" font-size="17">Unlock a curated set of premium skins.</text>
    <text x="1048" y="331" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900">$6.99</text>
    <rect x="730" y="386" width="410" height="90" rx="18" fill="#f5f3ff" stroke="#ddd6fe"/>
    <text x="760" y="422" fill="#3b0764" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">All-Access Lifetime</text>
    <text x="760" y="450" fill="#6b21a8" font-family="Inter, Arial, sans-serif" font-size="17">All current skins plus new drops.</text>
    <text x="1034" y="441" fill="#3b0764" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900">$24.99</text>
    <rect x="730" y="496" width="410" height="90" rx="18" fill="#fdf2f8" stroke="#fbcfe8"/>
    <text x="760" y="532" fill="#831843" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">Season Pass</text>
    <text x="760" y="560" fill="#9d174d" font-family="Inter, Arial, sans-serif" font-size="17">New skins every release day.</text>
    <text x="1010" y="551" fill="#831843" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900">$3.99/mo</text>
  </g>`
  );
}

function skinCard(x, y, w, h, skin) {
  const [name, bg, accent, price] = skin;
  const text = isLight(bg) ? '#171717' : '#ffffff';
  const muted = isLight(bg) ? '#52525b' : '#d4d4d8';
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${bg}" stroke="${accent}" stroke-width="2"/>
    <circle cx="${x + w - 22}" cy="${y + 22}" r="8" fill="${accent}"/>
    <text x="${x + 14}" y="${y + h - 38}" fill="${text}" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="800">${escapeXml(name)}</text>
    <text x="${x + 14}" y="${y + h - 15}" fill="${muted}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(price)}</text>
  </g>`;
}

function sidebarRow(x, y, label) {
  return `
  <rect x="${x}" y="${y}" width="158" height="32" rx="10" fill="#1e1e28"/>
  <text x="${x + 14}" y="${y + 22}" fill="#d8d5e8" font-family="Inter, Arial, sans-serif" font-size="14">${escapeXml(label)}</text>`;
}

function isLight(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 170;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
