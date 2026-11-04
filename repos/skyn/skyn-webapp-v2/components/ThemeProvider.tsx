'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { canUseSkin } from '@/lib/plans';
import type { Plan } from '@/types/app';

interface ThemeContextType {
  theme:     string;
  setTheme:  (id: string) => void;
  plan:      Plan;
  customBackground: boolean;
  setCustomBackground: (file: File) => Promise<void>;
  clearCustomBackground: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme:    'midnight',
  setTheme: () => {},
  plan:     'free',
  customBackground: false,
  setCustomBackground: async () => {},
  clearCustomBackground: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children, plan = 'free' }: { children: ReactNode; plan?: Plan }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'midnight';
    const saved = localStorage.getItem('nexus_theme') ?? 'midnight';
    return canUseSkin(saved, plan) ? saved : 'midnight';
  });
  const [customBackground, setCustomBackgroundState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('nexus_custom_bg');
  });
  const effectiveTheme = canUseSkin(theme, plan) ? theme : 'midnight';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    const dataUrl = localStorage.getItem('nexus_custom_bg');
    const rawPalette = localStorage.getItem('nexus_custom_palette');
    if (!dataUrl || !rawPalette) {
      document.documentElement.removeAttribute('data-custom-bg');
      return;
    }
    try {
      applyCustomBackground(dataUrl, JSON.parse(rawPalette) as Palette);
    } catch {
      localStorage.removeItem('nexus_custom_bg');
      localStorage.removeItem('nexus_custom_palette');
      document.documentElement.removeAttribute('data-custom-bg');
    }
  }, [effectiveTheme]);

  function setTheme(id: string) {
    if (!canUseSkin(id, plan)) return;
    setThemeState(id);
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('nexus_theme', id);
  }

  async function setCustomBackground(file: File) {
    if (file.size > 2_000_000) throw new Error('Use an image under 2 MB.');
    const dataUrl = await readFileAsDataUrl(file);
    const palette = await extractPalette(dataUrl);
    localStorage.setItem('nexus_custom_bg', dataUrl);
    localStorage.setItem('nexus_custom_palette', JSON.stringify(palette));
    applyCustomBackground(dataUrl, palette);
    setCustomBackgroundState(true);
  }

  function clearCustomBackground() {
    localStorage.removeItem('nexus_custom_bg');
    localStorage.removeItem('nexus_custom_palette');
    const root = document.documentElement;
    root.removeAttribute('data-custom-bg');
    root.style.removeProperty('--nx-custom-bg-image');
    root.style.removeProperty('--nx-custom-bg-overlay');
    root.style.removeProperty('--nx-bg-solid');
    setCustomBackgroundState(false);
  }

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, setTheme, plan, customBackground, setCustomBackground, clearCustomBackground }}>
      {children}
    </ThemeContext.Provider>
  );
}

type Palette = {
  bg: string;
  accent: string;
  text: string;
  muted: string;
  overlay: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

function applyCustomBackground(dataUrl: string, palette: Palette) {
  const root = document.documentElement;
  root.setAttribute('data-custom-bg', 'true');
  root.style.setProperty('--nx-custom-bg-image', `url("${dataUrl}") center / cover no-repeat fixed`);
  root.style.setProperty('--nx-custom-bg-overlay', palette.overlay);
  root.style.setProperty('--nx-bg-solid', palette.bg);
  root.style.setProperty('--nx-text', palette.text);
  root.style.setProperty('--nx-text-muted', palette.muted);
  root.style.setProperty('--nx-accent', palette.accent);
  root.style.setProperty('--nx-accent2', palette.accent);
  root.style.setProperty('--nx-border', colorWithAlpha(palette.text, 0.22));
  root.style.setProperty('--nx-bubble-shadow', '0 16px 34px rgba(0,0,0,0.22)');
  root.style.setProperty('--nx-bubble-radius-ai', '22px 22px 22px 7px');
  root.style.setProperty('--nx-bubble-radius-user', '22px 22px 7px 22px');
}

async function extractPalette(dataUrl: string): Promise<Palette> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const size = 48;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not sample image.');
  ctx.drawImage(image, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  let r = 0, g = 0, b = 0, count = 0;
  let accent = { r: 120, g: 160, b: 255, score: 0 };

  for (let i = 0; i < pixels.length; i += 16) {
    const pr = pixels[i];
    const pg = pixels[i + 1];
    const pb = pixels[i + 2];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const sat = max - min;
    const lum = luminance(pr, pg, pb);
    r += pr; g += pg; b += pb; count++;
    const score = sat + Math.abs(lum - 140);
    if (sat > 35 && score > accent.score) accent = { r: pr, g: pg, b: pb, score };
  }

  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);
  const isLight = luminance(r, g, b) > 150;
  const bg = rgb(r, g, b);
  return {
    bg,
    accent: rgb(accent.r, accent.g, accent.b),
    text: isLight ? '#172033' : '#f8fbff',
    muted: isLight ? '#5c6678' : '#b9c7d9',
    overlay: isLight
      ? 'linear-gradient(rgba(255,255,255,0.46), rgba(255,255,255,0.34))'
      : 'linear-gradient(rgba(0,0,0,0.48), rgba(0,0,0,0.56))',
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image.'));
    image.src = src;
  });
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgb(r: number, g: number, b: number) {
  return `rgb(${r}, ${g}, ${b})`;
}

function colorWithAlpha(color: string, alpha: number) {
  return color.startsWith('rgb(')
    ? color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
    : `rgba(255,255,255,${alpha})`;
}
