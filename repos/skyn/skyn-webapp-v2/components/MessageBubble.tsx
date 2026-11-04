'use client';

import type { Message, Model } from '@/types/app';
import { MODEL_COLORS, MODEL_LABELS } from '@/lib/model-router';

interface Props {
  message:   Message | { role: string; content: string; model?: Model; id?: string };
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';
  const model  = message.model as Model | undefined;
  const color  = model ? MODEL_COLORS[model] : 'var(--nx-accent)';
  const label  = model ? MODEL_LABELS[model] : 'AI';

  if (isUser) {
    return (
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'10px' }}>
        <div style={{
          maxWidth:     '70%',
          padding:      '10px 14px',
          borderRadius: 'var(--nx-bubble-radius-user)',
          background:   'var(--nx-bubble-user)',
          border:       'var(--nx-bubble-border-user)',
          boxShadow:    'var(--nx-bubble-shadow)',
          fontSize:     '13px',
          color:        'var(--nx-text)',
          lineHeight:   1.6,
          fontFamily:   'var(--nx-font)',
          whiteSpace:   'pre-wrap',
          wordBreak:    'break-word',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', gap:'8px', marginBottom:'10px', alignItems:'flex-start' }}>
      {/* Model avatar */}
      <div style={{
        width:        '26px',
        height:       '26px',
        borderRadius: '50%',
        background:   `${color}22`,
        border:       `1px solid ${color}44`,
        display:      'flex',
        alignItems:   'center',
        justifyContent:'center',
        fontSize:     '9px',
        fontWeight:   700,
        color:        color,
        flexShrink:   0,
        marginTop:    '2px',
        fontFamily:   'var(--nx-font)',
      }}>
        {model === 'claude' ? 'C' : model === 'gpt' ? 'G' : '◈'}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'10px', color:'var(--nx-text-muted)', marginBottom:'4px', fontFamily:'var(--nx-font)' }}>
          {label}
        </div>
        <div style={{
          padding:      '10px 14px',
          borderRadius: 'var(--nx-bubble-radius-ai)',
          background:   'var(--nx-bubble-ai)',
          border:       'var(--nx-bubble-border-ai)',
          borderLeft:   `2px solid ${color}`,
          boxShadow:    'var(--nx-bubble-shadow)',
          fontSize:     '13px',
          color:        'var(--nx-text)',
          lineHeight:   1.7,
          fontFamily:   'var(--nx-font)',
          whiteSpace:   'pre-wrap',
          wordBreak:    'break-word',
        }}>
          {message.content}
          {isStreaming && (
            <span style={{
              display:    'inline-block',
              width:      '2px',
              height:     '14px',
              background: color,
              marginLeft: '2px',
              verticalAlign:'middle',
              animation:  'blink 1s step-end infinite',
            }} />
          )}
        </div>
      </div>
    </div>
  );
}
