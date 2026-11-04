import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isDemoMode } from '@/lib/demo-mode';

export async function GET(req: NextRequest) {
  if (isDemoMode()) return Response.json({ messages: [] });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversationId   = searchParams.get('conversationId');
  if (!conversationId) return Response.json({ error: 'conversationId required' }, { status: 400 });

  // Verify ownership
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return Response.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const { conversationId, role, content, model } = await req.json();
    return Response.json({
      message: {
        id: `demo-message-${Date.now()}`,
        conversation_id: conversationId,
        role,
        content,
        model: model ?? null,
        tokens_input: 0,
        tokens_output: 0,
        created_at: new Date().toISOString(),
      },
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId, role, content, model } = await req.json();
  if (!conversationId || !role || !content) {
    return Response.json({ error: 'conversationId, role, content required' }, { status: 400 });
  }

  // Verify ownership
  const { data: conv } = await supabase
    .from('conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content, model: model ?? null })
    .select()
    .single();

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ message: data });
}
