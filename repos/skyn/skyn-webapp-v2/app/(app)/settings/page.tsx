'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { UserProfile } from '@/types/app';

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [byokKeys, setByokKeys] = useState({ anthropic:'', openai:'', google:'' });
  const [saving,  setSaving]   = useState(false);
  const [saved,   setSaved]    = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      setProfile(data);
    })();
  }, [supabase]);

  async function saveByok() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/byok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byokKeys),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign('/login');
  }

  if (!profile) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--nx-text-muted)', fontFamily:'var(--nx-font)', fontSize:'13px' }}>
      Loading…
    </div>
  );

  const isPro = ['pro','team'].includes(profile.plan);

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'32px 24px', background:'var(--nx-bg)' }}>
      <div style={{ maxWidth:'560px' }}>
        <h1 style={{ fontSize:'20px', fontWeight:700, color:'var(--nx-text)', margin:'0 0 24px', fontFamily:'var(--nx-font)' }}>Settings</h1>

        {/* Account */}
        <section style={{ marginBottom:'28px' }}>
          <h2 style={{ fontSize:'12px', fontWeight:700, color:'var(--nx-text-muted)', letterSpacing:'0.5px', textTransform:'uppercase', margin:'0 0 12px', fontFamily:'var(--nx-font)' }}>Account</h2>
          <div style={{ background:'var(--nx-sidebar)', border:'1px solid var(--nx-border)', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontSize:'13px', color:'var(--nx-text)', marginBottom:'4px', fontFamily:'var(--nx-font)' }}>{profile.email}</div>
            <div style={{ fontSize:'11px', color:'var(--nx-accent)', fontFamily:'monospace' }}>
              {profile.plan} plan · {profile.messages_used_this_month} messages used this month
            </div>
            {profile.plan === 'free' && (
              <a href="/upgrade" style={{ display:'inline-block', marginTop:'10px', padding:'6px 14px', borderRadius:'6px', background:'var(--nx-accent)', color:'var(--nx-bg)', fontSize:'11px', fontWeight:600, textDecoration:'none', fontFamily:'var(--nx-font)' }}>
                Upgrade plan
              </a>
            )}
          </div>
        </section>

        {/* BYOK */}
        <section style={{ marginBottom:'28px' }}>
          <h2 style={{ fontSize:'12px', fontWeight:700, color:'var(--nx-text-muted)', letterSpacing:'0.5px', textTransform:'uppercase', margin:'0 0 12px', fontFamily:'var(--nx-font)' }}>
            Bring Your Own API Keys {!isPro && <span style={{ color:'var(--nx-accent)', fontSize:'10px' }}>(Pro+)</span>}
          </h2>
          <div style={{ background:'var(--nx-sidebar)', border:'1px solid var(--nx-border)', borderRadius:'10px', padding:'14px', opacity: isPro ? 1 : 0.5 }}>
            {!isPro && <div style={{ fontSize:'11px', color:'var(--nx-text-muted)', marginBottom:'10px', fontFamily:'var(--nx-font)' }}>Upgrade to Pro to use your own API keys and pay zero API markup.</div>}
            {[
              { key:'anthropic', label:'Anthropic API Key', placeholder:'sk-ant-...' },
              { key:'openai',    label:'OpenAI API Key',    placeholder:'sk-...' },
              { key:'google',    label:'Google AI Key',     placeholder:'AIza...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom:'10px' }}>
                <label style={{ fontSize:'11px', color:'var(--nx-text-muted)', display:'block', marginBottom:'4px', fontFamily:'var(--nx-font)' }}>{label}</label>
                <input
                  type="password"
                  value={byokKeys[key as keyof typeof byokKeys]}
                  onChange={e => setByokKeys(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  disabled={!isPro}
                  style={{
                    width:'100%', padding:'8px 10px', borderRadius:'7px',
                    border:'1px solid var(--nx-border)', background:'var(--nx-bubble-ai)',
                    color:'var(--nx-text)', fontSize:'12px', outline:'none',
                    fontFamily:'monospace',
                  }}
                />
              </div>
            ))}
            {isPro && (
              <button
                onClick={saveByok}
                disabled={saving}
                style={{
                  padding:'7px 16px', borderRadius:'7px', border:'none', cursor:'pointer',
                  background:'var(--nx-accent)', color:'var(--nx-bg)', fontSize:'12px', fontWeight:600,
                  fontFamily:'var(--nx-font)',
                }}
              >
                {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save keys'}
              </button>
            )}
          </div>
        </section>

        {/* Sign out */}
        <button
          onClick={signOut}
          style={{
            padding:'8px 16px', borderRadius:'7px', cursor:'pointer',
            background:'transparent', border:'1px solid var(--nx-border)',
            color:'var(--nx-text-muted)', fontSize:'12px', fontFamily:'var(--nx-font)',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
