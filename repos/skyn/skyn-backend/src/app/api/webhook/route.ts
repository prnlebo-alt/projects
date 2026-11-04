import { NextRequest, NextResponse } from 'next/server';
import { fulfillCheckoutSession } from '@/lib/fulfillment';
import { jsonError, routeError } from '@/lib/http';
import { getStripe } from '@/lib/stripe';
import { requireEnv } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return jsonError('Missing Stripe signature.', 400);

    const payload = await request.text();
    const event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );

    if (event.type === 'checkout.session.completed') {
      await fulfillCheckoutSession(event.data.object);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return routeError(error);
  }
}

export function GET(): NextResponse {
  return jsonError('Method not allowed.', 405);
}
