import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function routeError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return jsonError(error.issues[0]?.message ?? 'Invalid request.', 400);
  }

  if (error instanceof Error && error.message.startsWith('Missing required environment variable')) {
    return jsonError(error.message, 500);
  }

  return jsonError('Internal server error.', 500);
}
