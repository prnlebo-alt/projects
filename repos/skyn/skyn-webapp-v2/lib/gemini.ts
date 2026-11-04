import { GoogleGenerativeAI } from '@google/generative-ai';
import { logUsage, estimateCost } from './usage-tracker';

export async function streamGemini(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  userId: string,
  conversationId?: string
): Promise<Response> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const history = messages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1]?.content ?? '';

  const chat   = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage);

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }
        const response    = await result.response;
        const totalTokens = response.usageMetadata?.totalTokenCount ?? 0;
        const cost        = estimateCost('gemini', totalTokens, 0);
        await logUsage({ userId, conversationId, model: 'gemini', tokens_input: totalTokens, tokens_output: 0, cost_usd: cost });
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
        );
      } finally {
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
