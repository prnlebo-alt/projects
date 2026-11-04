import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Model } from '@/types/app';
import { demoConversation, DEMO_CONVERSATIONS, isDemoMode } from '@/lib/demo-mode';

export async function GET() {
  if (isDemoMode()) return Response.json({ conversations: DEMO_CONVERSATIONS });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ conversations: data });
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const { title } = await req.json() as { model: Model; title?: string };
    return Response.json({ conversation: demoConversation(title ?? 'Demo conversation') });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { model, title } = await req.json() as { model: Model; title?: string };

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, model, title: title ?? 'New conversation' })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ conversation: data });
}

export async function PATCH(req: NextRequest) {
  if (isDemoMode()) return Response.json({ ok: true });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title } = await req.json();

  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (isDemoMode()) return Response.json({ ok: true });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
