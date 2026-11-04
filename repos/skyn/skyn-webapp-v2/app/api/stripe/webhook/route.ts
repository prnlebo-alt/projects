import { NextRequest } from 'next/server';
import { getStripe }   from '@/lib/stripe';
import { STRIPE_PLAN_MAP } from '@/lib/plans';
import Stripe from 'stripe';


export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  if (!sig) return new Response('Missing signature', { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('Webhook signature error:', message);
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }

  const { createServiceRoleClient } = await import('@/lib/supabase-server');
  const supabase = await createServiceRoleClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.metadata?.userId;
        if (!userId) break;

        // Get price ID from session
        const sessionWithItems = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        });
        const priceId = sessionWithItems.line_items?.data[0]?.price?.id;
        const plan    = STRIPE_PLAN_MAP[priceId ?? ''] ?? 'starter';

        await supabase.from('users').update({
          plan,
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: session.subscription as string,
        }).eq('id', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub     = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price?.id;
        const plan    = STRIPE_PLAN_MAP[priceId ?? ''] ?? 'starter';
        await supabase.from('users')
          .update({ plan })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from('users')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        // Could send email via Resend here
        console.log('Payment failed for:', event.data.object);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
