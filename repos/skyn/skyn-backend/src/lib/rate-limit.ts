import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { requireEnv } from './env';

const MAX_REQUESTS = 30;
const WINDOW_SECONDS = 60;

export async function rateLimit(request: NextRequest, routeName: string): Promise<NextResponse | null> {
  const redis = new Redis({
    url: requireEnv('UPSTASH_REDIS_REST_URL'),
    token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
  });

  const ip = getClientIp(request);
  const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const key = `rate:${routeName}:${ip}:${bucket}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS + 5);
  }

  if (count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(WINDOW_SECONDS),
        },
      },
    );
  }

  return null;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}
