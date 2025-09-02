// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const requestCounts = new Map<string, { count: number; timestamp: number }>();

// rate limit config
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;

export async function middleware(request: NextRequest) {
  try {
    // lazy import getToken to avoid pulling node-only deps into the Edge bundle
    const { getToken } = await import('next-auth/jwt');

    // call getToken with the request (note: next-auth typings may not match dynamic import types)
    const token = await getToken({ req: request as any });

    const { pathname } = request.nextUrl;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    // rate limit
    const currentTime = Date.now();
    const userKey = token?.sub || ip;

    if (!requestCounts.has(userKey)) {
      requestCounts.set(userKey, { count: 1, timestamp: currentTime });
    } else {
      const userRequestData = requestCounts.get(userKey);
      if (userRequestData) {
        if (currentTime - userRequestData.timestamp > RATE_LIMIT_WINDOW) {
          userRequestData.count = 1;
          userRequestData.timestamp = currentTime;
        } else {
          userRequestData.count += 1;
          if (userRequestData.count > RATE_LIMIT_MAX_REQUESTS) {
            return new NextResponse('Too many requests. Please try again later.', {
              status: 429,
            });
          }
        }
        requestCounts.set(userKey, userRequestData);
      }
    }

    // redirect unauthenticated users away from protected routes
    if (!token && (pathname.startsWith('/dashboard') || pathname.startsWith('/customers/create'))) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // redirect authenticated users away from auth-related routes
    if (token && (pathname === '/' || pathname.startsWith('/auth'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (err) {
    // Log the error so Vercel shows the stack trace for the Edge invocation
    console.error('Middleware runtime error:', err);
    // Return a safe 500 so you can inspect logs
    return new NextResponse('Middleware error', { status: 500 });
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
