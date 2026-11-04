import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import type { Plan, Message, Conversation } from '@/types/app';
import { DEMO_CONVERSATIONS, DEMO_MESSAGES, isDemoMode } from '@/lib/demo-mode';

interface Props { params: Promise<{ id: string }> }

const FALLBACK_BILLING_PERIOD_START = new Date(0).toISOString();

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;

  if (isDemoMode()) {
    const conversation = DEMO_CONVERSATIONS.find(c => c.id === id) ?? {
      id,
      user_id: 'demo-user',
      workspace_id: null,
      title: 'Demo conversation',
      model: 'claude' as const,
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
    };
    return (
      <ChatInterface
        conversation={conversation}
        initialMessages={DEMO_MESSAGES[id] ?? []}
        plan="pro"
        usage={{ used: 0, limit: 2000, cost: 0 }}
      />
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!conv) notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  const { data: profile } = await supabase
    .from('users')
    .select('plan, messages_used_this_month, billing_period_start')
    .eq('id', user.id)
    .single();

  const plan  = (profile?.plan ?? 'free') as Plan;
  const used  = profile?.messages_used_this_month ?? 0;
  const limit = { free:50, starter:500, pro:2000, team:5000 }[plan] ?? 50;

  const { data: logs } = await supabase
    .from('usage_logs').select('cost_usd').eq('user_id', user.id)
    .gte('created_at', profile?.billing_period_start ?? FALLBACK_BILLING_PERIOD_START);
  const cost = logs?.reduce((s, l) => s + (l.cost_usd ?? 0), 0) ?? 0;

  return (
    <ChatInterface
      conversation={conv as Conversation}
      initialMessages={(messages ?? []) as Message[]}
      plan={plan}
      usage={{ used, limit, cost }}
    />
  );
}
