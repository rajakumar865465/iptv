import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Admin routes that require authentication
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/users',
  '/licenses',
  '/devices',
  '/channels',
  '/categories',
  '/plans',
  '/payments',
  '/analytics',
  '/logs',
  '/app-settings',
  '/app-releases',
  '/website-settings',
  '/stream-scanner',
  '/broken-channels',
  '/duplicates',
  '/languages',
  '/notifications',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if this path needs protection
  const isProtected = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Read token from cookie (preferred) or Authorization header
  // The client stores the token in localStorage, so we read it from a
  // custom request header that the API layer adds (X-Admin-Token).
  // For cookie-based auth, set an httpOnly cookie on login instead.
  const token =
    req.cookies.get('adminToken')?.value ||
    req.headers.get('x-admin-token');

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      // If secret is not configured on the server, deny access to be safe
      console.error('ADMIN_JWT_SECRET not set — cannot verify admin token in middleware');
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Verify the token using jose (works in Edge Runtime, unlike jsonwebtoken)
    await jwtVerify(token, new TextEncoder().encode(secret));

    return NextResponse.next();
  } catch {
    // Token invalid or expired — redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all admin panel paths.
     * Excludes:
     *   - /api routes (handled by their own auth middleware)
     *   - /_next (Next.js internals)
     *   - /login (the login page itself)
     *   - Static files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|.*\\..*).*)' ,
  ],
};
