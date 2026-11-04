import Anthropic from '@anthropic-ai/sdk';
import { logUsage, estimateCost } from './usage-tracker';

export async function streamClaude(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  userId: string,
  conversationId?: string
): Promise<Response> {
  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model:      'claude-sonnet-4-5',
    max_tokens: 4096,
    messages:   messages.map(m => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  let inputTokens  = 0;
  let outputTokens = 0;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
            );
          }
          if (chunk.type === 'message_start' && chunk.message.usage) {
            inputTokens = chunk.message.usage.input_tokens;
          }
          if (chunk.type === 'message_delta' && chunk.usage) {
            outputTokens = chunk.usage.output_tokens;
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
        );
      } finally {
        const cost = estimateCost('claude', inputTokens, outputTokens);
        await logUsage({ userId, conversationId, model: 'claude', tokens_input: inputTokens, tokens_output: outputTokens, cost_usd: cost });
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
