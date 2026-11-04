import OpenAI from 'openai';
import { logUsage, estimateCost } from './usage-tracker';

export async function streamGPT(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  userId: string,
  conversationId?: string
): Promise<Response> {
  const client = new OpenAI({ apiKey });

  const stream = await client.chat.completions.create({
    model:          'gpt-4o',
    messages:       messages as OpenAI.Chat.ChatCompletionMessageParam[],
    stream:         true,
    stream_options: { include_usage: true },
  });

  const encoder     = new TextEncoder();
  let inputTokens   = 0;
  let outputTokens  = 0;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
          if (chunk.usage) {
            inputTokens  = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
        );
      } finally {
        const cost = estimateCost('gpt', inputTokens, outputTokens);
        await logUsage({ userId, conversationId, model: 'gpt', tokens_input: inputTokens, tokens_output: outputTokens, cost_usd: cost });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
