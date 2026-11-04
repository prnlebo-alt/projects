'use client';

import { useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter }    from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email,   setEmail]   = useState('');
  const [password,setPassword]= useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Replace the placeholder NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.');
      return;
    }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push('/chat');
  }

  async function handleGoogle() {
    setError('');
    if (!isSupabaseConfigured()) {
      setError('Google sign-in cannot run against placeholder.supabase.co. Configure a real Supabase project first.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/chat` },
    });
    if (error) setError(error.message);
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--nx-bg)', padding:'20px',
    }}>
      <div style={{
        width:'100%', maxWidth:'380px',
        background:'var(--nx-sidebar)', border:'1px solid var(--nx-border)',
        borderRadius:'16px', padding:'32px',
      }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'24px', fontWeight:700, color:'var(--nx-text)', fontFamily:'var(--nx-font)' }}>
            NEX<span style={{ color:'var(--nx-accent)' }}>US</span>
          </div>
          <div style={{ fontSize:'12px', color:'var(--nx-text-muted)', marginTop:'6px', fontFamily:'var(--nx-font)' }}>
            Sign in to your account
          </div>
        </div>

        <button
          onClick={handleGoogle}
          style={{
            width:'100%', padding:'10px', borderRadius:'8px', marginBottom:'16px',
            border:'1px solid var(--nx-border)', background:'var(--nx-bubble-ai)',
            color:'var(--nx-text)', fontSize:'13px', cursor:'pointer', fontFamily:'var(--nx-font)',
          }}
        >
          Continue with Google
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <div style={{ flex:1, height:'1px', background:'var(--nx-border)' }} />
          <span style={{ fontSize:'11px', color:'var(--nx-text-muted)', fontFamily:'var(--nx-font)' }}>or</span>
          <div style={{ flex:1, height:'1px', background:'var(--nx-border)' }} />
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid var(--nx-border)', background:'var(--nx-bubble-ai)', color:'var(--nx-text)', fontSize:'13px', outline:'none', fontFamily:'var(--nx-font)' }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid var(--nx-border)', background:'var(--nx-bubble-ai)', color:'var(--nx-text)', fontSize:'13px', outline:'none', fontFamily:'var(--nx-font)' }}
          />
          {error && <div style={{ fontSize:'11px', color:'#ef4444', fontFamily:'var(--nx-font)' }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{ padding:'10px', borderRadius:'8px', border:'none', background:'var(--nx-accent)', color:'var(--nx-bg)', fontSize:'13px', fontWeight:600, cursor:loading?'wait':'pointer', fontFamily:'var(--nx-font)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:'12px', color:'var(--nx-text-muted)', marginTop:'16px', fontFamily:'var(--nx-font)' }}>
          No account?{' '}
          <a href="/signup" style={{ color:'var(--nx-accent)', textDecoration:'none' }}>Sign up free</a>
        </p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
