import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (ratelimit) return ratelimit;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Return a mock that always passes when Redis not configured
    return {
      limit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0, pending: Promise.resolve() }),
    } as unknown as Ratelimit;
  }

  const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter:   Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix:    'nexus_rl',
  });

  return ratelimit;
}

export async function checkRateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  const rl = getRatelimit();
  const result = await rl.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
