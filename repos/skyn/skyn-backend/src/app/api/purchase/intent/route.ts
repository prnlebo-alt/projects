import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { STRIPE_PURCHASE_PRODUCTS } from '@/lib/catalog';
import { getAppUrl } from '@/lib/env';
import { jsonError, routeError } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { getOrCreatePriceForPurchase, getStripe } from '@/lib/stripe';
import { upsertUserByEmail } from '@/lib/supabase';

const BodySchema = z.object({
  itemId: z.string().min(1),
  itemType: z.enum(['skin', 'pack', 'all_access', 'season_pass']),
  userEmail: z.string().email(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limited = await rateLimit(request, 'purchase-intent');
    if (limited) return limited;

    const body = BodySchema.parse(await request.json());
    await upsertUserByEmail(body.userEmail);
    const stripe = getStripe();
    const appUrl = getAppUrl();
    const product = STRIPE_PURCHASE_PRODUCTS[body.itemType];
    const priceId = await getOrCreatePriceForPurchase(body.itemType);
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      customer_email: body.userEmail,
      success_url: `${appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/purchase/cancelled`,
      metadata: {
        itemId: body.itemId,
        itemType: body.itemType,
      },
      line_items: [
        {
          quantity: 1,
          price: priceId,
        },
      ],
    });

    if (!session.url) return jsonError('Stripe did not return a checkout URL.', 502);
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    return routeError(error);
  }
}

export function GET(): NextResponse {
  return jsonError('Method not allowed.', 405);
}
