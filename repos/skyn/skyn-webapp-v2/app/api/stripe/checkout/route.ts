import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { priceId } = await req.json();
  if (!priceId) return Response.json({ error: 'priceId required' }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const url = await createCheckoutSession({
      userId:     user.id,
      userEmail:  user.email!,
      priceId,
      successUrl: `${appUrl}/chat?upgraded=true`,
      cancelUrl:  `${appUrl}/upgrade`,
    });
    return Response.json({ url });
  } catch (err: unknown) {
    console.error('Checkout error:', err);
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
