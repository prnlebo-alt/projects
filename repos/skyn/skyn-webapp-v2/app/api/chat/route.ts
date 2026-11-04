import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { streamClaude } from '@/lib/anthropic';
import { streamGPT }    from '@/lib/openai';
import { streamGemini } from '@/lib/gemini';
import { checkRateLimit } from '@/lib/rate-limit';
import { PLAN_LIMITS }    from '@/lib/plans';
import { decrypt }        from '@/lib/encryption';
import type { Model }     from '@/types/app';
import { demoStreamResponse, isDemoMode } from '@/lib/demo-mode';

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const body = await req.json().catch(() => ({ model: 'claude' }));
    return demoStreamResponse(body.model ?? 'claude');
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const { success: ratePassed } = await checkRateLimit(ip);
  if (!ratePassed) return Response.json({ error: 'Rate limited. Slow down.' }, { status: 429 });

  const { data: profile } = await supabase
    .from('users')
    .select('plan, messages_used_this_month, api_key_anthropic, api_key_openai, api_key_google')
    .eq('id', user.id)
    .single();

  if (!profile) return Response.json({ error: 'User not found' }, { status: 404 });

  // Enforce plan message limit
  const limit = PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS]?.messages ?? 50;
  if (profile.messages_used_this_month >= limit) {
    return Response.json(
      { error: 'limit_reached', limit, used: profile.messages_used_this_month, plan: profile.plan },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { model, messages, conversationId, useByok } = body as {
    model:          Model;
    messages:       Array<{ role: string; content: string }>;
    conversationId?: string;
    useByok?:       boolean;
  };

  if (!['claude', 'gpt', 'gemini'].includes(model)) {
    return Response.json({ error: 'Invalid model' }, { status: 400 });
  }
  if (!messages?.length) {
    return Response.json({ error: 'No messages provided' }, { status: 400 });
  }

  // Resolve API keys: BYOK if enabled and available, else platform keys
  const isPro = ['pro', 'team'].includes(profile.plan);
  let anthropicKey = process.env.ANTHROPIC_API_KEY!;
  let openaiKey    = process.env.OPENAI_API_KEY!;
  let googleKey    = process.env.GOOGLE_AI_API_KEY!;

  if (useByok && isPro) {
    if (profile.api_key_anthropic) anthropicKey = decrypt(profile.api_key_anthropic);
    if (profile.api_key_openai)    openaiKey    = decrypt(profile.api_key_openai);
    if (profile.api_key_google)    googleKey    = decrypt(profile.api_key_google);
  }

  // Increment message count
  await supabase
    .from('users')
    .update({ messages_used_this_month: profile.messages_used_this_month + 1 })
    .eq('id', user.id);

  // Stream from selected model
  try {
    if (model === 'claude')  return streamClaude(messages, anthropicKey, user.id, conversationId);
    if (model === 'gpt')     return streamGPT(messages, openaiKey, user.id, conversationId);
    if (model === 'gemini')  return streamGemini(messages, googleKey, user.id, conversationId);
    return Response.json({ error: 'Invalid model' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Chat route error:', err);
    const message = err instanceof Error ? err.message : 'AI service error';
    return Response.json({ error: message }, { status: 502 });
  }
}
