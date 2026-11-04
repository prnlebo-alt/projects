import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { encrypt } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (!['pro', 'team'].includes(profile?.plan ?? '')) {
    return Response.json({ error: 'Pro plan required for BYOK' }, { status: 403 });
  }

  const { anthropic, openai, google } = await req.json();
  const updates: Record<string, string | null> = {};

  if (anthropic !== undefined) updates.api_key_anthropic = anthropic ? encrypt(anthropic) : null;
  if (openai    !== undefined) updates.api_key_openai    = openai    ? encrypt(openai)    : null;
  if (google    !== undefined) updates.api_key_google    = google    ? encrypt(google)    : null;

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
