import type { LocalStorage, SkinCategory } from '../shared/types';

export function buildBackgroundCss(local: LocalStorage, category: SkinCategory): string {
  if (!local.backgroundImage) return '';

  const fallbackOpacity = category === 'vibrant' ? 0.18 : category === 'light' ? 0.08 : 0.12;
  const opacity = local.bgOpacityOverride === null
    ? fallbackOpacity
    : Math.max(0, Math.min(30, local.bgOpacityOverride)) / 100;

  return `
body::before {
  content: '' !important;
  position: fixed !important;
  inset: 0 !important;
  background-image: url("${escapeCssUrl(local.backgroundImage)}") !important;
  background-size: cover !important;
  background-position: center !important;
  opacity: ${opacity} !important;
  pointer-events: none !important;
  z-index: 0 !important;
}
`;
}

function escapeCssUrl(value: string): string {
  return value.replaceAll('"', '%22').replaceAll('\\', '%5C');
}
