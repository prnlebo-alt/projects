import type { Model } from '@/types/app';

interface LogUsageParams {
  userId: string;
  conversationId?: string;
  model: Model;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
}

// Cost per token in USD (approximate, update as pricing changes)
export const TOKEN_COSTS: Record<Model, { input: number; output: number }> = {
  claude: { input: 0.000003,   output: 0.000015   }, // claude-3.5-sonnet
  gpt:    { input: 0.0000025,  output: 0.00001    }, // gpt-4o
  gemini: { input: 0.00000125, output: 0.000005   }, // gemini-1.5-pro
};

export function estimateCost(model: Model, inputTokens: number, outputTokens: number): number {
  const costs = TOKEN_COSTS[model];
  return (inputTokens * costs.input) + (outputTokens * costs.output);
}

export async function logUsage(params: LogUsageParams): Promise<void> {
  try {
    // Dynamic import to avoid edge runtime issues
    const { createServiceRoleClient } = await import('./supabase-server');
    const supabase = await createServiceRoleClient();

    await supabase.from('usage_logs').insert({
      user_id:         params.userId,
      conversation_id: params.conversationId ?? null,
      model:           params.model,
      tokens_input:    params.tokens_input,
      tokens_output:   params.tokens_output,
      cost_usd:        params.cost_usd,
    });
  } catch (err) {
    // Non-fatal — don't fail the response if logging fails
    console.error('Usage log failed:', err);
  }
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}m`;
  return `$${usd.toFixed(4)}`;
}
