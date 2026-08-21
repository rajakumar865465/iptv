import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function getDevFallbackSecret(): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'dev-fallback-secret-key-32-chars-long';
}

// In non-production, generate a random secret for local dev if ADMIN_JWT_SECRET is unset
const DEV_FALLBACK_SECRET = getDevFallbackSecret();


const PUBLIC_PREFIXES = [
  '/',
  '/login',
  '/browse',
  '/download',
  '/features',
  '/license',
  '/payment',
  '/pricing',
  '/privacy',
  '/support',
  '/terms',
  '/my-account',
];

// Admin routes that require authentication. Keep this explicit because route
// groups like `(admin)` do not appear in the browser URL.
const PROTECTED_PREFIXES = [
  '/admin-users',
  '/analytics',
  '/app-releases',
  '/app-settings',
  '/categories',
  '/channels',
  '/dashboard',
  '/devices',
  '/duplicate-channels',
  '/feedback',
  '/hidden-channels',
  '/import/iptv',
  '/languages',
  '/licenses',
  '/logs',
  '/notifications',
  '/orders',
  '/payments',
  '/plans',
  '/reported-channels',
  '/stream-health',
  '/stream-scanner',
  '/system',
  '/users',
  '/website-settings',
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((prefix) => (
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix + '/')
  ));
  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);

  // Route groups like `(admin)` do not exist in URLs, so public pages are
  // allowlisted and every known admin route above is protected explicitly.
  if (isPublic || !isProtected) {
    return NextResponse.next();
  }

  const token =
    req.cookies.get('adminToken')?.value ||
    req.headers.get('x-admin-token');

  if (!token) {
    return redirectToLogin(req);
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET || DEV_FALLBACK_SECRET;

    if (!secret) {
      console.error('ADMIN_JWT_SECRET not set - cannot verify admin token in middleware');
      return redirectToLogin(req);
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    // Admin routes must have role: 'admin'
    if (payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

export const config = {
  matcher: [
    /*
     * Match app routes so admin pages can be protected.
     * Excludes:
     *   - /api routes (handled by their own auth middleware)
     *   - /_next (Next.js internals)
     *   - Static files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
