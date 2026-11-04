import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return res;

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';

  // Skip auth check during build (no real URL configured)
  if (url.includes('placeholder')) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = req.nextUrl.pathname;

  const protectedPaths = ['/chat', '/compare', '/prompts', '/settings', '/upgrade'];
  if (protectedPaths.some(p => pathname.startsWith(p)) && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if ((pathname === '/login' || pathname === '/signup') && user) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook).*)'],
};
