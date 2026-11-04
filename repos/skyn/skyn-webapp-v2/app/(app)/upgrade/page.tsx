'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PLANS } from '@/lib/plans';

type CheckoutResponse = {
  url?: string;
  error?: string;
};

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(priceId: string, planId: string) {
    setLoading(planId);
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json() as CheckoutResponse;
      if (data.url) window.location.assign(data.url);
    } finally { setLoading(null); }
  }

  return (
    <div style={{
      flex:1, overflowY:'auto', padding:'40px 24px',
      background:'var(--nx-bg)', display:'flex', flexDirection:'column', alignItems:'center',
    }}>
      <div style={{ maxWidth:'800px', width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <h1 style={{ fontSize:'28px', fontWeight:700, color:'var(--nx-text)', margin:'0 0 10px', fontFamily:'var(--nx-font)' }}>
            Replace three subscriptions with one
          </h1>
          <p style={{ fontSize:'14px', color:'var(--nx-text-muted)', fontFamily:'var(--nx-font)', margin:0 }}>
            Claude Pro + ChatGPT Plus + Gemini Advanced = $60/month.<br />
            NEXUS gives you all three for $12.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'14px' }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background:   plan.recommended ? 'var(--nx-accent)0d' : 'var(--nx-sidebar)',
              border:       plan.recommended ? '2px solid var(--nx-accent)' : '1px solid var(--nx-border)',
              borderRadius: '14px',
              padding:      '20px',
              display:      'flex',
              flexDirection:'column',
            }}>
              {plan.recommended && (
                <div style={{
                  display:'inline-block', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px',
                  background:'var(--nx-accent)', color:'var(--nx-bg)',
                  borderRadius:'10px', padding:'2px 8px', marginBottom:'10px',
                  alignSelf:'flex-start', fontFamily:'var(--nx-font)',
                }}>MOST POPULAR</div>
              )}
              <div style={{ fontSize:'16px', fontWeight:700, color:'var(--nx-text)', fontFamily:'var(--nx-font)' }}>{plan.name}</div>
              <div style={{ margin:'8px 0 14px', fontFamily:'var(--nx-font)' }}>
                <span style={{ fontSize:'26px', fontWeight:700, color:'var(--nx-accent)' }}>${plan.price}</span>
                <span style={{ fontSize:'12px', color:'var(--nx-text-muted)' }}>/month</span>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 16px', flex:1, display:'flex', flexDirection:'column', gap:'6px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ fontSize:'12px', color:'var(--nx-text)', display:'flex', gap:'7px', alignItems:'flex-start', fontFamily:'var(--nx-font)' }}>
                    <span style={{ color:'var(--nx-accent)', flexShrink:0, fontWeight:700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {plan.id === 'free' ? (
                <Link href="/chat" style={{
                  display:'block', textAlign:'center', padding:'9px', borderRadius:'8px',
                  background:'transparent', border:'1px solid var(--nx-border)',
                  color:'var(--nx-text-muted)', fontSize:'12px', fontWeight:600,
                  textDecoration:'none', fontFamily:'var(--nx-font)',
                }}>
                  Current plan
                </Link>
              ) : (
                <button
                  onClick={() => plan.priceId && checkout(plan.priceId, plan.id)}
                  disabled={!!loading || !plan.priceId}
                  style={{
                    padding:'9px', borderRadius:'8px', border:'none', cursor: loading ? 'wait' : 'pointer',
                    background: plan.recommended ? 'var(--nx-accent)' : 'var(--nx-bubble-user)',
                    color: plan.recommended ? 'var(--nx-bg)' : 'var(--nx-text)',
                    fontSize:'12px', fontWeight:600, fontFamily:'var(--nx-font)',
                    opacity: loading && loading !== plan.id ? 0.5 : 1,
                  }}
                >
                  {loading === plan.id ? 'Redirecting…' : `Get ${plan.name}`}
                </button>
              )}
            </div>
          ))}
        </div>

        <p style={{ textAlign:'center', fontSize:'11px', color:'var(--nx-text-muted)', marginTop:'24px', fontFamily:'var(--nx-font)' }}>
          Cancel anytime. No contracts. Billed monthly via Stripe.
        </p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
