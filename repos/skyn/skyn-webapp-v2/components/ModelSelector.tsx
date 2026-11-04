'use client';

import type { Model } from '@/types/app';
import { MODEL_LABELS, MODEL_DESCRIPTIONS, MODEL_COLORS } from '@/lib/model-router';

interface Props {
  value:    Model;
  onChange: (m: Model) => void;
}

const MODELS: Model[] = ['claude', 'gpt', 'gemini'];

export default function ModelSelector({ value, onChange }: Props) {
  return (
    <div style={{ display:'flex', gap:'4px' }}>
      {MODELS.map(m => {
        const active = m === value;
        const color  = MODEL_COLORS[m];
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            title={MODEL_DESCRIPTIONS[m]}
            style={{
              padding:      '4px 10px',
              borderRadius: '20px',
              fontSize:     '10px',
              fontWeight:   600,
              cursor:       'pointer',
              border:       `1px solid ${active ? color : 'var(--nx-border)'}`,
              background:   active ? `${color}22` : 'transparent',
              color:        active ? color : 'var(--nx-text-muted)',
              transition:   'all 0.12s',
              fontFamily:   'var(--nx-font)',
              letterSpacing:'0.2px',
            }}
          >
            {MODEL_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}
