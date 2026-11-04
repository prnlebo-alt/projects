import type { Conversation, Message, UserProfile } from '@/types/app';

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

export const DEMO_USER: UserProfile = {
  id: 'demo-user',
  email: 'demo@nexus.local',
  name: 'Demo User',
  plan: 'pro',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  api_key_anthropic: null,
  api_key_openai: null,
  api_key_google: null,
  theme: 'midnight',
  messages_used_this_month: 0,
  billing_period_start: new Date(0).toISOString(),
  created_at: new Date(0).toISOString(),
};

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'demo-launch-plan',
    user_id: DEMO_USER.id,
    workspace_id: null,
    title: 'Launch plan teardown',
    model: 'claude',
    created_at: '2026-05-06T00:00:00.000Z',
    updated_at: '2026-05-06T00:00:00.000Z',
  },
  {
    id: 'demo-pricing',
    user_id: DEMO_USER.id,
    workspace_id: null,
    title: 'Pricing page copy',
    model: 'gpt',
    created_at: '2026-05-05T00:00:00.000Z',
    updated_at: '2026-05-05T00:00:00.000Z',
  },
  {
    id: 'demo-research',
    user_id: DEMO_USER.id,
    workspace_id: null,
    title: 'Market research brief',
    model: 'gemini',
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T00:00:00.000Z',
  },
];

export const DEMO_MESSAGES: Record<string, Message[]> = {
  'demo-launch-plan': [
    {
      id: 'demo-message-1',
      conversation_id: 'demo-launch-plan',
      role: 'user',
      content: 'Stress-test this launch plan.',
      model: null,
      tokens_input: 0,
      tokens_output: 0,
      created_at: '2026-05-06T00:00:00.000Z',
    },
    {
      id: 'demo-message-2',
      conversation_id: 'demo-launch-plan',
      role: 'assistant',
      content: 'The weak point is not the landing page. It is proving the paid promise with a working backend, billing, and retention loop. Demo polish helps sell the vision, but production credibility comes from auth, persistence, and clean usage limits.',
      model: 'claude',
      tokens_input: 0,
      tokens_output: 0,
      created_at: '2026-05-06T00:00:05.000Z',
    },
  ],
  'demo-pricing': [
    {
      id: 'demo-message-3',
      conversation_id: 'demo-pricing',
      role: 'assistant',
      content: 'The $12 Starter plan is the anchor. Free gets users into the habit. Pro exists for serious users who want BYOK and higher limits. Team is currently underbuilt unless admin controls are real.',
      model: 'gpt',
      tokens_input: 0,
      tokens_output: 0,
      created_at: '2026-05-05T00:00:00.000Z',
    },
  ],
  'demo-research': [
    {
      id: 'demo-message-4',
      conversation_id: 'demo-research',
      role: 'assistant',
      content: 'The competitor angle is simple: people already bounce between models. The product wins if switching, comparing, saving, and usage visibility are faster than three separate tabs.',
      model: 'gemini',
      tokens_input: 0,
      tokens_output: 0,
      created_at: '2026-05-04T00:00:00.000Z',
    },
  ],
};

export function demoConversation(title = 'Demo conversation'): Conversation {
  const now = new Date().toISOString();
  return {
    id: `demo-${Date.now()}`,
    user_id: DEMO_USER.id,
    workspace_id: null,
    title,
    model: 'claude',
    created_at: now,
    updated_at: now,
  };
}

export function demoStreamResponse(model: string) {
  const encoder = new TextEncoder();
  const labels: Record<string, string> = {
    claude: 'Claude-style blunt analysis',
    gpt: 'GPT-style polished drafting',
    gemini: 'Gemini-style research framing',
  };
  const text = `${labels[model] ?? 'Demo response'}: demo mode is working. You skipped auth and reached the product shell. This response is mocked because Supabase and provider keys are placeholders. The UI path is testable now; production still needs real credentials, schema, and OAuth.`;

  const readable = new ReadableStream({
    async start(controller) {
      for (const word of text.split(' ')) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `${word} ` })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
