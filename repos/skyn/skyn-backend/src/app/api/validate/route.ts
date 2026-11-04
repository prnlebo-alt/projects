import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FREE_SKINS } from '@/lib/catalog';
import { jsonError, routeError } from '@/lib/http';
import { validateLicenseToken } from '@/lib/license';
import { rateLimit } from '@/lib/rate-limit';
import { getUserById } from '@/lib/supabase';

const BodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const limited = await rateLimit(request, 'validate');
    if (limited) return limited;

    const body = BodySchema.parse(await request.json());
    let license;
    try {
      license = await validateLicenseToken(body.token);
    } catch {
      return NextResponse.json({
        valid: false,
        plan: 'free',
        unlockedSkins: FREE_SKINS,
      });
    }

    const user = await getUserById(license.userId);

    if (!user || user.license_token !== body.token) {
      return NextResponse.json({
        valid: false,
        plan: 'free',
        unlockedSkins: FREE_SKINS,
      });
    }

    return NextResponse.json({
      valid: true,
      plan: user.plan,
      unlockedSkins: user.unlocked_skins,
    });
  } catch (error) {
    if (error instanceof Error && error.message !== 'Missing required environment variable: JWT_SECRET') {
      return NextResponse.json({
        valid: false,
        plan: 'free',
        unlockedSkins: FREE_SKINS,
      });
    }

    return routeError(error);
  }
}

export function GET(): NextResponse {
  return jsonError('Method not allowed.', 405);
}
