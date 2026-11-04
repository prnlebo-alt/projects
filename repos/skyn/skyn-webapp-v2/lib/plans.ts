import type { Plan } from '@/types/app';

export const PLAN_LIMITS: Record<Plan, {
  messages: number;
  byok: boolean;
  compare: boolean;
  prompts: number;
  team: boolean;
}> = {
  free:    { messages: 50,   byok: false, compare: false, prompts: 5,    team: false },
  starter: { messages: 500,  byok: false, compare: true,  prompts: 50,   team: false },
  pro:     { messages: 2000, byok: true,  compare: true,  prompts: 500,  team: false },
  team:    { messages: 5000, byok: true,  compare: true,  prompts: 9999, team: true  },
};

export const FREE_SKINS = ['midnight', 'snow', 'glass-day'] as const;
export type FreeSkin = typeof FREE_SKINS[number];

export function canUseSkin(skinId: string, plan: Plan): boolean {
  if ((FREE_SKINS as readonly string[]).includes(skinId)) return true;
  return plan !== 'free';
}

export function canUseFeature(
  feature: keyof typeof PLAN_LIMITS['free'],
  plan: Plan
): boolean {
  return !!PLAN_LIMITS[plan]?.[feature];
}

export function getMessageLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].messages;
}

export const STRIPE_PLAN_MAP: Record<string, Plan> = {
  [process.env.STRIPE_STARTER_PRICE_ID ?? 'price_starter']: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID     ?? 'price_pro']:     'pro',
  [process.env.STRIPE_TEAM_PRICE_ID    ?? 'price_team']:    'team',
};

export const PLANS = [
  {
    id: 'free' as Plan,
    name: 'Free',
    price: 0,
    priceId: null,
    messages: 50,
    skins: 3,
    features: [
      '50 messages / month',
      '3 skins: Midnight, Snow, Glass Day',
      'All 3 AI models',
      'Conversation history',
    ],
    locked: [
      'Prompt library',
      'Compare mode',
      'BYOK keys',
    ],
  },
  {
    id: 'starter' as Plan,
    name: 'Starter',
    price: 12,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    messages: 500,
    skins: 44,
    features: [
      '500 messages / month',
      'All 44 skins unlocked',
      'Prompt library (50 prompts)',
      'Side-by-side model compare',
      'Conversation export',
    ],
    locked: ['BYOK keys'],
    recommended: true,
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    messages: 2000,
    skins: 44,
    features: [
      '2,000 messages / month',
      'All 44 skins',
      'Bring-your-own API keys (BYOK)',
      'Prompt library (500 prompts)',
      'Priority model routing',
    ],
    locked: [],
  },
  {
    id: 'team' as Plan,
    name: 'Team',
    price: 49,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    messages: 5000,
    skins: 44,
    features: [
      '5,000 shared messages',
      'All 44 skins',
      'Team workspaces',
      '5 seats included',
      'Admin controls + usage by member',
    ],
    locked: [],
  },
] satisfies Array<{
  id: Plan;
  name: string;
  price: number;
  priceId: string | null | undefined;
  messages: number;
  skins: number;
  features: string[];
  locked: string[];
  recommended?: boolean;
}>;
