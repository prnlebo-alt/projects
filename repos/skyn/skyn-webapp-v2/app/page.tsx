import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isDemoMode } from '@/lib/demo-mode';

export default function LandingPage() {
  if (isDemoMode()) redirect('/chat');

  const features = [
    { icon:'✦', title:'3 AI models', desc:'Claude, GPT-4o, Gemini in one chat' },
    { icon:'⊞', title:'Compare mode', desc:'Same prompt, all three answers side by side' },
    { icon:'◈', title:'44 skins', desc:'Color, bubble, tropical, gamer, cloud — you choose' },
    { icon:'⌘', title:'Prompt library', desc:'Save and reuse your best prompts' },
  ];
  return (
    <main style={{ minHeight:'100vh', background:'var(--nx-bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', fontFamily:'var(--nx-font)' }}>
      <div style={{ maxWidth:'600px', width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:'42px', fontWeight:800, color:'var(--nx-text)', letterSpacing:'-1px', marginBottom:'12px' }}>
          NEX<span style={{ color:'var(--nx-accent)' }}>US</span>
        </div>
        <p style={{ fontSize:'20px', color:'var(--nx-text-muted)', marginBottom:'8px', lineHeight:1.4 }}>
          Claude + GPT-4o + Gemini. One interface. One subscription.
        </p>
        <p style={{ fontSize:'14px', color:'var(--nx-text-muted)', marginBottom:'36px', opacity:0.7 }}>
          Stop paying $60/month across three platforms. NEXUS gives you all three AI models, 44 skins, side-by-side comparison, and prompt library — starting at $12/month.
        </p>
        <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap', marginBottom:'48px' }}>
          <Link href="/signup" style={{ padding:'12px 28px', borderRadius:'10px', background:'var(--nx-accent)', color:'var(--nx-bg)', fontSize:'14px', fontWeight:700, textDecoration:'none' }}>Start free →</Link>
          <Link href="/login" style={{ padding:'12px 28px', borderRadius:'10px', border:'1px solid var(--nx-border)', color:'var(--nx-text-muted)', fontSize:'14px', textDecoration:'none' }}>Sign in</Link>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'12px', marginBottom:'36px' }}>
          {features.map(({ icon, title, desc }) => (
            <div key={title} style={{ background:'var(--nx-sidebar)', border:'1px solid var(--nx-border)', borderRadius:'10px', padding:'14px', textAlign:'left' }}>
              <div style={{ fontSize:'18px', color:'var(--nx-accent)', marginBottom:'6px' }}>{icon}</div>
              <div style={{ fontSize:'12px', fontWeight:700, color:'var(--nx-text)', marginBottom:'4px' }}>{title}</div>
              <div style={{ fontSize:'11px', color:'var(--nx-text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:'11px', color:'var(--nx-text-muted)', opacity:0.6 }}>50 free messages/month · No credit card required · Cancel anytime</p>
      </div>
    </main>
  );
}
