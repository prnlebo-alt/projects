import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PLAN_LIMITS } from '@/lib/plans';
import type { Plan } from '@/types/app';
import { isDemoMode } from '@/lib/demo-mode';

export async function GET() {
  if (isDemoMode()) {
    return Response.json({
      plan: 'pro',
      used: 0,
      limit: PLAN_LIMITS.pro.messages,
      remaining: PLAN_LIMITS.pro.messages,
      pct: 0,
      cost_usd: 0,
      by_model: {},
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('plan, messages_used_this_month, billing_period_start')
    .eq('id', user.id)
    .single();

  if (!profile) return Response.json({ error: 'Not found' }, { status: 404 });

  const plan  = profile.plan as Plan;
  const limit = PLAN_LIMITS[plan].messages;
  const used  = profile.messages_used_this_month;

  // Get cost this month
  const start = profile.billing_period_start;
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('cost_usd, model')
    .eq('user_id', user.id)
    .gte('created_at', start);

  const totalCost   = logs?.reduce((sum, l) => sum + (l.cost_usd ?? 0), 0) ?? 0;
  const byModel     = logs?.reduce((acc, l) => {
    acc[l.model] = (acc[l.model] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return Response.json({
    plan,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    pct:       Math.round((used / limit) * 100),
    cost_usd:  totalCost,
    by_model:  byModel,
  });
}
