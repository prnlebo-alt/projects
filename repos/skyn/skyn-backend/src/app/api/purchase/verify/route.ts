import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fulfillCheckoutSession } from '@/lib/fulfillment';
import { jsonError, routeError } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe';

const BodySchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limited = await rateLimit(request, 'purchase-verify');
    if (limited) return limited;

    const body = BodySchema.parse(await request.json());
    const session = await getStripe().checkout.sessions.retrieve(body.sessionId);
    const { token, unlockedSkins } = await fulfillCheckoutSession(session);
    return NextResponse.json({ token, unlockedSkins });
  } catch (error) {
    if (error instanceof Error && error.message === 'Payment is not complete.') {
      return jsonError(error.message, 402);
    }
    return routeError(error);
  }
}

export function GET(): NextResponse {
  return jsonError('Method not allowed.', 405);
}
