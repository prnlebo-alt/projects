import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import AppShellClient from '@/components/AppShellClient';
import type { UserProfile, Conversation } from '@/types/app';
import { DEMO_CONVERSATIONS, DEMO_USER, isDemoMode } from '@/lib/demo-mode';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) {
    return (
      <AppShellClient profile={DEMO_USER} conversations={DEMO_CONVERSATIONS}>
        {children}
      </AppShellClient>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  return (
    <AppShellClient
      profile={profile as UserProfile}
      conversations={(conversations ?? []) as Conversation[]}
    >
      {children}
    </AppShellClient>
  );
}

export const dynamic = 'force-dynamic';
