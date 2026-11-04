'use client';

import { useState } from 'react';
import type { Conversation } from '@/types/app';
import { MODEL_COLORS } from '@/lib/model-router';

interface Props {
  conversations: Conversation[];
  activeId?:     string;
  onSelect:      (c: Conversation) => void;
  onNew:         () => void;
  onDelete?:     (id: string) => void;
}

export default function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1)  return 'Just now';
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 48) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minHeight:0 }}>
      <button
        onClick={onNew}
        style={{
          margin:'8px', padding:'8px 12px', borderRadius:'8px',
          border:'1px solid var(--nx-border)', background:'var(--nx-accent)11',
          color:'var(--nx-accent)', fontSize:'12px', fontWeight:600, cursor:'pointer',
          textAlign:'center', fontFamily:'var(--nx-font)', transition:'all 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--nx-accent)22')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--nx-accent)11')}
      >
        + New conversation
      </button>

      <div style={{ flex:1, overflowY:'auto', padding:'0 4px 8px' }}>
        {conversations.length === 0 && (
          <div style={{ padding:'16px 8px', fontSize:'11px', color:'var(--nx-text-muted)', textAlign:'center', fontFamily:'var(--nx-font)' }}>
            No conversations yet
          </div>
        )}
        {conversations.map(c => {
          const active = c.id === activeId;
          const hovered = c.id === hoverId;
          const color = MODEL_COLORS[c.model];
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c)}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                padding:      '7px 8px',
                borderRadius: '7px',
                cursor:       'pointer',
                marginBottom: '2px',
                background:   active ? 'var(--nx-bubble-user)' : hovered ? 'var(--nx-bubble-ai)' : 'transparent',
                borderLeft:   active ? `2px solid ${color}` : '2px solid transparent',
                display:      'flex',
                alignItems:   'center',
                gap:          '6px',
                transition:   'all 0.1s',
              }}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:'11px', color:active ? 'var(--nx-text)' : 'var(--nx-text-muted)',
                  fontWeight: active ? 600 : 400,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  fontFamily:'var(--nx-font)',
                }}>
                  {c.title}
                </div>
                <div style={{ fontSize:'9px', color:'var(--nx-text-muted)', marginTop:'1px', fontFamily:'monospace' }}>
                  <span style={{ color }}>{c.model}</span> · {formatDate(c.updated_at)}
                </div>
              </div>
              {onDelete && hovered && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                  style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--nx-text-muted)', fontSize:'14px', padding:'0 2px', lineHeight:1 }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
