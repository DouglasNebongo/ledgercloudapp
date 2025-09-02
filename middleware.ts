// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


const requestCounts = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 min
const RATE_LIMIT_MAX_REQUESTS = 100;

// helper that looks for common NextAuth cookie names
function hasNextAuthSession(req: NextRequest): boolean {
  // cookie names vary depending on your NextAuth config & secure settings
  const candidates = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    // If you're using jwt-based session cookie name you might have:
    'next-auth.callback-url',
    'next-auth.csrf-token',
  ];

  for (const name of candidates) {
    const c = req.cookies.get(name);
    if (c && c.value) return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const userKey = ip; // fallback; you can use a cookie-identified user id if available

    // rate limit
    const now = Date.now();
    const existing = requestCounts.get(userKey);
    if (!existing) {
      requestCounts.set(userKey, { count: 1, timestamp: now });
    } else {
      if (now - existing.timestamp > RATE_LIMIT_WINDOW) {
        existing.count = 1;
        existing.timestamp = now;
      } else {
        existing.count += 1;
        if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
          return new NextResponse('Too many requests. Please try again later.', { status: 429 });
        }
      }
      requestCounts.set(userKey, existing);
    }

    const hasSession = hasNextAuthSession(request);

    // redirect unauthenticated users away from protected routes
    if (!hasSession && (pathname.startsWith('/dashboard') || pathname.startsWith('/customers/create'))) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // redirect authenticated users away from auth routes
    if (hasSession && (pathname === '/' || pathname.startsWith('/auth'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (err) {
    if (err instanceof Error) {
      console.error('Middleware error stack:', err.stack);
    } else {
      console.error('Middleware error (non-Error):', err);
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
