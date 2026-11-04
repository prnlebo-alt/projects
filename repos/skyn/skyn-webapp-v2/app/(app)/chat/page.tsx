import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import type { Plan } from '@/types/app';
import { isDemoMode } from '@/lib/demo-mode';

const FALLBACK_BILLING_PERIOD_START = new Date(0).toISOString();

export default async function ChatPage() {
  if (isDemoMode()) {
    return (
      <ChatInterface
        plan="pro"
        usage={{ used: 0, limit: 2000, cost: 0 }}
      />
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('plan, messages_used_this_month, billing_period_start')
    .eq('id', user.id)
    .single();

  const plan  = (profile?.plan ?? 'free') as Plan;
  const used  = profile?.messages_used_this_month ?? 0;
  const limit = { free:50, starter:500, pro:2000, team:5000 }[plan] ?? 50;

  // Cost this month
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('cost_usd')
    .eq('user_id', user.id)
    .gte('created_at', profile?.billing_period_start ?? FALLBACK_BILLING_PERIOD_START);
  const cost = logs?.reduce((s, l) => s + (l.cost_usd ?? 0), 0) ?? 0;

  return (
    <ChatInterface
      plan={plan}
      usage={{ used, limit, cost }}
    />
  );
}

export const dynamic = 'force-dynamic';
