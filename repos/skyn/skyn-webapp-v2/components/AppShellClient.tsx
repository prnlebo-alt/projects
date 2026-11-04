'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConversationList from '@/components/ConversationList';
import ThemeSwitcher    from '@/components/ThemeSwitcher';
import UpgradeModal     from '@/components/UpgradeModal';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Conversation, UserProfile, Plan } from '@/types/app';

interface Props {
  children:     React.ReactNode;
  profile:      UserProfile;
  conversations: Conversation[];
}

export default function AppShellClient({ children, profile, conversations: initial }: Props) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [activeId,      setActiveId]      = useState<string | undefined>();
  const [showUpgrade,   setShowUpgrade]   = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);

  function handleNew() {
    setActiveId(undefined);
    router.push('/chat');
  }

  function handleSelect(c: Conversation) {
    setActiveId(c.id);
    router.push(`/chat/${c.id}`);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/conversations?id=${id}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) router.push('/chat');
  }

  return (
    <ThemeProvider plan={profile.plan as Plan}>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      <div style={{
        position:'fixed', inset:0, zIndex:0,
        background:'var(--nx-bg-gradient, var(--nx-bg))',
        pointerEvents:'none',
      }} />

      <div style={{
        display:'flex', height:'100vh', position:'relative', zIndex:1,
        background:'var(--nx-bg)',
        fontFamily:'var(--nx-font)',
      }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{
            width:'220px', flexShrink:0,
            background:'var(--nx-sidebar)',
            borderRight:'1px solid var(--nx-border)',
            display:'flex', flexDirection:'column',
            backdropFilter: 'blur(28px) saturate(1.25)',
          }}>
            {/* Logo */}
            <div style={{ padding:'16px 14px 10px', borderBottom:'1px solid var(--nx-border)' }}>
              <div style={{ fontSize:'18px', fontWeight:700, color:'var(--nx-text)', letterSpacing:'-0.5px', fontFamily:'var(--nx-font)' }}>
                NEX<span style={{ color:'var(--nx-accent)' }}>US</span>
              </div>
              <div style={{ fontSize:'9px', color:'var(--nx-text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginTop:'2px', fontFamily:'monospace' }}>
                Multi-model AI
              </div>
            </div>

            {/* Conversation list */}
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={handleSelect}
              onNew={handleNew}
              onDelete={handleDelete}
            />

            {/* Footer */}
            <div style={{ padding:'10px 12px', borderTop:'1px solid var(--nx-border)' }}>
              {profile.plan === 'free' && (
                <button
                  onClick={() => setShowUpgrade(true)}
                  style={{
                    width:'100%', padding:'7px', borderRadius:'8px', marginBottom:'8px',
                    background:'var(--nx-accent)', border:'none', cursor:'pointer',
                    color:'var(--nx-bg)', fontSize:'11px', fontWeight:600, fontFamily:'var(--nx-font)',
                  }}
                >
                  Upgrade — from $12/mo
                </button>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%',
                  background:'var(--nx-accent)33', border:'1px solid var(--nx-accent)44',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'9px', fontWeight:700, color:'var(--nx-accent)', flexShrink:0,
                }}>
                  {(profile.name ?? profile.email ?? 'U').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'11px', color:'var(--nx-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'var(--nx-font)' }}>
                    {profile.name ?? profile.email}
                  </div>
                  <div style={{ fontSize:'9px', color:'var(--nx-accent)', fontFamily:'monospace' }}>
                    {profile.plan} plan
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, position:'relative' }}>
          {/* App topbar */}
          <div style={{
            height:'44px', flexShrink:0,
            background:'var(--nx-topbar)',
            borderBottom:'1px solid var(--nx-border)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 14px',
            backdropFilter:'blur(24px)',
          }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--nx-text-muted)', fontSize:'16px', padding:'4px 6px' }}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <a href="/prompts" style={{ fontSize:'11px', color:'var(--nx-text-muted)', textDecoration:'none', fontFamily:'var(--nx-font)' }}>Prompts</a>
              <a href="/settings" style={{ fontSize:'11px', color:'var(--nx-text-muted)', textDecoration:'none', fontFamily:'var(--nx-font)' }}>Settings</a>
              <ThemeSwitcher onUpgradeClick={() => setShowUpgrade(true)} />
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
