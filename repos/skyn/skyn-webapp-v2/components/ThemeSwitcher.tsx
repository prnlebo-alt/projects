'use client';

import { useState } from 'react';
import { useTheme } from './ThemeProvider';
import { canUseSkin } from '@/lib/plans';

const THEMES = [
  { id: 'midnight',      name: 'Midnight',      cat: 'dark',    accent: '#a78bfa', bg: '#0e0e11' },
  { id: 'obsidian',      name: 'Obsidian',      cat: 'dark',    accent: '#e0e0e0', bg: '#111111' },
  { id: 'aurora',        name: 'Aurora',        cat: 'dark',    accent: '#34d399', bg: '#050d12' },
  { id: 'crimson',       name: 'Crimson',       cat: 'dark',    accent: '#f87171', bg: '#0f0708' },
  { id: 'navy',          name: 'Navy',          cat: 'dark',    accent: '#7aa2f7', bg: '#080c18' },
  { id: 'forest',        name: 'Forest',        cat: 'dark',    accent: '#4ade80', bg: '#080f08' },
  { id: 'amber',         name: 'Amber',         cat: 'dark',    accent: '#f59e0b', bg: '#0f0a04' },
  { id: 'rose',          name: 'Rose',          cat: 'dark',    accent: '#f472b6', bg: '#0f080c' },
  { id: 'slate',         name: 'Slate',         cat: 'dark',    accent: '#94a3b8', bg: '#0c0f14' },
  { id: 'cyber',         name: 'Cyber',         cat: 'dark',    accent: '#00ffcc', bg: '#040608' },
  { id: 'ivory',         name: 'Ivory',         cat: 'light',   accent: '#5c5c40', bg: '#fafaf5' },
  { id: 'snow',          name: 'Snow',          cat: 'light',   accent: '#228be6', bg: '#ffffff' },
  { id: 'cream',         name: 'Cream',         cat: 'light',   accent: '#b8860b', bg: '#fffef7' },
  { id: 'arctic',        name: 'Arctic',        cat: 'light',   accent: '#0088cc', bg: '#f0f8ff' },
  { id: 'blush',         name: 'Blush',         cat: 'light',   accent: '#e53e3e', bg: '#fff5f5' },
  { id: 'mint',          name: 'Mint',          cat: 'light',   accent: '#059669', bg: '#f0fff8' },
  { id: 'lavender',      name: 'Lavender',      cat: 'light',   accent: '#7c3aed', bg: '#faf5ff' },
  { id: 'sunrise',       name: 'Sunrise',       cat: 'light',   accent: '#d97706', bg: '#fffbf0' },
  { id: 'paper',         name: 'Paper',         cat: 'light',   accent: '#2c4a7c', bg: '#fefefe' },
  { id: 'zinc',          name: 'Zinc',          cat: 'light',   accent: '#3f3f46', bg: '#fafafa' },
  { id: 'neon',          name: 'Neon',          cat: 'vibrant', accent: '#ff00ff', bg: '#04001a' },
  { id: 'candy',         name: 'Candy',         cat: 'vibrant', accent: '#ff1493', bg: '#fff0f8' },
  { id: 'ocean',         name: 'Ocean',         cat: 'vibrant', accent: '#00d4ff', bg: '#001830' },
  { id: 'lava',          name: 'Lava',          cat: 'vibrant', accent: '#ff4500', bg: '#0a0000' },
  { id: 'galaxy',        name: 'Galaxy',        cat: 'vibrant', accent: '#9d4edd', bg: '#020010' },
  { id: 'matrix',        name: 'Matrix',        cat: 'vibrant', accent: '#00ff41', bg: '#000800' },
  { id: 'retro',         name: 'Retro',         cat: 'special', accent: '#ff9900', bg: '#1a1008' },
  { id: 'nordic',        name: 'Nordic',        cat: 'special', accent: '#88aacc', bg: '#1a1e28' },
  { id: 'sakura',        name: 'Sakura',        cat: 'special', accent: '#ff7096', bg: '#1a0a10' },
  { id: 'sand',          name: 'Sand',          cat: 'special', accent: '#8b6914', bg: '#f8f0e0' },
  { id: 'mono',          name: 'Mono',          cat: 'special', accent: '#f5f5f5', bg: '#111111' },
  { id: 'glass-day',     name: 'Glass Day',     cat: 'glass',   accent: '#586eff', bg: '#daeeff' },
  { id: 'glass-dusk',    name: 'Glass Dusk',    cat: 'glass',   accent: '#9b50e8', bg: '#ffd4f0' },
  { id: 'glass-night',   name: 'Glass Night',   cat: 'glass',   accent: '#7090ff', bg: '#080820' },
  { id: 'glass-warm',    name: 'Glass Warm',    cat: 'glass',   accent: '#e06010', bg: '#fff0d8' },
  { id: 'glass-emerald', name: 'Glass Emerald', cat: 'glass',   accent: '#059660', bg: '#d8fff0' },
  { id: 'lagoon-pop',    name: 'Lagoon Pop',    cat: 'tropical', accent: '#ffcf56', bg: '#07495a' },
  { id: 'mango-breeze',  name: 'Mango Breeze',  cat: 'tropical', accent: '#ef8f22', bg: '#ffe0a8' },
  { id: 'hibiscus-night',name: 'Hibiscus Night',cat: 'tropical', accent: '#ff4d8d', bg: '#2a0828' },
  { id: 'speech-bubble', name: 'Speech Bubble', cat: 'bubble',   accent: '#3b82f6', bg: '#f7f8fc' },
  { id: 'soft-cloud',    name: 'Soft Cloud',    cat: 'bubble',   accent: '#8b5cf6', bg: '#eaf6ff' },
  { id: 'comic-pop',     name: 'Comic Pop',     cat: 'bubble',   accent: '#ef4444', bg: '#fffdf2' },
  { id: 'pixel-arcade',  name: 'Pixel Arcade',  cat: 'gamer',    accent: '#00f5ff', bg: '#060611' },
  { id: 'console-green', name: 'Console Green', cat: 'gamer',    accent: '#39ff14', bg: '#020602' },
  { id: 'rainbow-cloud', name: 'Rainbow Cloud', cat: 'cloud',    accent: '#ff6fb1', bg: '#b9e8ff' },
] as const;

type Cat = 'all' | 'dark' | 'light' | 'vibrant' | 'special' | 'glass' | 'tropical' | 'bubble' | 'gamer' | 'cloud';
const CATS: Cat[] = ['all', 'dark', 'light', 'vibrant', 'special', 'glass', 'tropical', 'bubble', 'gamer', 'cloud'];

interface Props {
  onUpgradeClick?: () => void;
}

export default function ThemeSwitcher({ onUpgradeClick }: Props) {
  const { theme, setTheme, plan, customBackground, setCustomBackground, clearCustomBackground } = useTheme();
  const [open, setOpen] = useState(false);
  const [cat,  setCat]  = useState<Cat>('all');
  const [uploadError, setUploadError] = useState('');

  const filtered = cat === 'all' ? THEMES : THEMES.filter(t => t.cat === cat);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '6px',
          padding:     '5px 10px',
          borderRadius:'6px',
          border:      '1px solid var(--nx-border)',
          background:  'transparent',
          color:       'var(--nx-text-muted)',
          fontSize:    '11px',
          cursor:      'pointer',
          fontFamily:  'var(--nx-font)',
        }}
      >
        <span style={{ width:10, height:10, borderRadius:'50%', background:'var(--nx-accent)', display:'inline-block' }} />
        Theme
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:98 }} />
          <div style={{
            position:   'absolute',
            right:      0,
            top:        '40px',
            width:      '340px',
            background: 'var(--nx-sidebar)',
            border:     '1px solid var(--nx-border)',
            borderRadius:'12px',
            padding:    '14px',
            zIndex:     99,
          }}>
            <div style={{ fontSize:'10px', fontWeight:600, color:'var(--nx-text-muted)', marginBottom:'10px', letterSpacing:'0.5px', textTransform:'uppercase' }}>
              {plan === 'free' ? `3 free · ${THEMES.length - 3} unlock on Starter` : `${THEMES.length} skins`}
            </div>

            <div style={{
              border:'1px solid var(--nx-border)',
              borderRadius:'10px',
              padding:'10px',
              marginBottom:'10px',
              background:'var(--nx-bubble-ai)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:'8px', alignItems:'center', marginBottom:'8px' }}>
                <div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'var(--nx-text)' }}>Custom background</div>
                  <div style={{ fontSize:'9px', color:'var(--nx-text-muted)', marginTop:'2px' }}>Auto-matches text, bubbles, and accent</div>
                </div>
                {customBackground && (
                  <button
                    onClick={clearCustomBackground}
                    style={{ border:'none', background:'transparent', color:'var(--nx-accent)', fontSize:'10px', cursor:'pointer', fontWeight:700 }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <label style={{
                display:'block',
                textAlign:'center',
                padding:'8px',
                borderRadius:'8px',
                border:'1px dashed var(--nx-border)',
                color:'var(--nx-text-muted)',
                fontSize:'10px',
                cursor:'pointer',
                background:'transparent',
              }}>
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  style={{ display:'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    e.currentTarget.value = '';
                    if (!file) return;
                    setUploadError('');
                    try {
                      await setCustomBackground(file);
                    } catch (err) {
                      setUploadError(err instanceof Error ? err.message : 'Could not use that image.');
                    }
                  }}
                />
              </label>
              {uploadError && <div style={{ color:'#ef4444', fontSize:'9px', marginTop:'6px' }}>{uploadError}</div>}
            </div>

            {/* Category tabs */}
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'10px' }}>
              {CATS.map(c => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  style={{
                    padding:      '2px 8px',
                    borderRadius: '10px',
                    fontSize:     '10px',
                    cursor:       'pointer',
                    border:       '1px solid var(--nx-border)',
                    background:   c === cat ? 'var(--nx-accent)' : 'transparent',
                    color:        c === cat ? 'var(--nx-bg)'     : 'var(--nx-text-muted)',
                    fontWeight:   c === cat ? 600 : 400,
                    fontFamily:   'var(--nx-font)',
                  }}
                >
                  {c === 'all' ? `All` : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            {/* Skin grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'5px' }}>
              {filtered.map(t => {
                const unlocked = canUseSkin(t.id, plan);
                const isActive = t.id === theme;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (!unlocked) { onUpgradeClick?.(); return; }
                      setTheme(t.id);
                    }}
                    title={unlocked ? t.name : `${t.name} — Starter+`}
                    style={{
                      padding:        '7px 4px',
                      borderRadius:   '7px',
                      cursor:         'pointer',
                      background:     t.bg,
                      border:         isActive ? `2px solid ${t.accent}` : '1px solid transparent',
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      gap:            '3px',
                      opacity:        unlocked ? 1 : 0.45,
                      position:       'relative',
                      transition:     'transform 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.07)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <div style={{ width:8, height:8, borderRadius:'50%', background:t.accent }} />
                    <span style={{ fontSize:'8px', color:t.accent, fontWeight:600 }}>{t.name.split(' ')[0]}</span>
                    {!unlocked && (
                      <span style={{ position:'absolute', top:2, right:2, fontSize:'7px', background:'rgba(0,0,0,0.6)', color:'#fff', borderRadius:'3px', padding:'1px 3px' }}>PRO</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
