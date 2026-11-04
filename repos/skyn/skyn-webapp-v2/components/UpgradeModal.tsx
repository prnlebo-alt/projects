'use client';

import { useState } from 'react';
import { PLANS } from '@/lib/plans';

type CheckoutResponse = {
  url?: string;
  error?: string;
};

interface Props {
  onClose: () => void;
  trigger?: 'skin' | 'limit' | 'feature';
}

export default function UpgradeModal({ onClose, trigger = 'feature' }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const headlines: Record<string, string> = {
    skin:    'Unlock all 44 skins',
    limit:   "You've hit your message limit",
    feature: 'Upgrade to unlock this feature',
  };

  async function checkout(priceId: string, planId: string) {
    setLoading(planId);
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ priceId }),
      });
      const data = await res.json() as CheckoutResponse;
      if (data.url) window.location.assign(data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{
      position:       'fixed', inset:0, zIndex:200,
      background:     'rgba(0,0,0,0.6)',
      display:        'flex', alignItems:'center', justifyContent:'center',
      padding:        '20px',
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:   'var(--nx-sidebar)',
        border:       '1px solid var(--nx-border)',
        borderRadius: '16px',
        padding:      '28px',
        width:        '100%',
        maxWidth:     '560px',
        maxHeight:    '90vh',
        overflowY:    'auto',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
          <div>
            <div style={{ fontSize:'18px', fontWeight:700, color:'var(--nx-text)', fontFamily:'var(--nx-font)', marginBottom:'4px' }}>
              {headlines[trigger]}
            </div>
            <div style={{ fontSize:'12px', color:'var(--nx-text-muted)', fontFamily:'var(--nx-font)' }}>
              Replace three subscriptions with one. $12/month.
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--nx-text-muted)', fontSize:'20px', lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'10px' }}>
          {PLANS.filter(p => p.id !== 'free').map(plan => (
            <div
              key={plan.id}
              style={{
                background:   plan.recommended ? `var(--nx-accent)11` : 'var(--nx-bubble-ai)',
                border:       plan.recommended ? '2px solid var(--nx-accent)' : '1px solid var(--nx-border)',
                borderRadius: '12px',
                padding:      '16px',
              }}
            >
              {plan.recommended && (
                <div style={{
                  display:'inline-block', fontSize:'9px', fontWeight:700,
                  background:'var(--nx-accent)', color:'var(--nx-bg)',
                  borderRadius:'10px', padding:'2px 8px', marginBottom:'8px', letterSpacing:'0.5px',
                  fontFamily:'var(--nx-font)',
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize:'15px', fontWeight:700, color:'var(--nx-text)', fontFamily:'var(--nx-font)' }}>{plan.name}</div>
              <div style={{ fontSize:'22px', fontWeight:700, color:'var(--nx-accent)', margin:'6px 0 10px', fontFamily:'var(--nx-font)' }}>
                ${plan.price}<span style={{ fontSize:'12px', fontWeight:400, color:'var(--nx-text-muted)' }}>/mo</span>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 14px', display:'flex', flexDirection:'column', gap:'5px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ fontSize:'11px', color:'var(--nx-text)', display:'flex', gap:'6px', fontFamily:'var(--nx-font)' }}>
                    <span style={{ color:'var(--nx-accent)', flexShrink:0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => plan.priceId && checkout(plan.priceId, plan.id)}
                disabled={!!loading || !plan.priceId}
                style={{
                  width:        '100%',
                  padding:      '9px',
                  borderRadius: '8px',
                  border:       'none',
                  background:   plan.recommended ? 'var(--nx-accent)' : 'var(--nx-bubble-user)',
                  color:        plan.recommended ? 'var(--nx-bg)' : 'var(--nx-text)',
                  fontSize:     '12px',
                  fontWeight:   600,
                  cursor:       loading ? 'wait' : 'pointer',
                  fontFamily:   'var(--nx-font)',
                }}
              >
                {loading === plan.id ? 'Redirecting...' : `Get ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
