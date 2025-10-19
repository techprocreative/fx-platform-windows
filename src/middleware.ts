import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected paths that require authentication
const protectedPaths = [
  '/dashboard/:path*',
  '/api/dashboard/:path*',
  '/api/strategy/:path*',
  '/api/signals/:path*',
  '/api/commands/:path*',
  '/api/ws/:path*',
];

// Apply security headers to all responses
function applySecurityHeaders(response: NextResponse) {
  // Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Production security headers
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.pusher.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.pusher.com wss://*.pusher.com https://*.vercel.app;"
    );
  }
  
  return response;
}

// Apply CORS headers for API routes
function applyCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    process.env.NEXTAUTH_URL || 'https://yourdomain.vercel.app',
    'http://localhost:3000',
  ];

  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // API Rate Limiting Headers
  response.headers.set('X-RateLimit-Limit', process.env.API_RATE_LIMIT_MAX_REQUESTS || '100');
  response.headers.set('X-RateLimit-Window', process.env.API_RATE_LIMIT_WINDOW_MS || '60000');

  return response;
}

export const config = {
  matcher: [
    // Protected paths
    '/dashboard/:path*',
    '/api/dashboard/:path*',
    '/api/strategy/:path*',
    '/api/signals/:path*',
    '/api/commands/:path*',
    '/api/ws/:path*',
    // API routes for CORS
    '/api/:path*',
    // All paths for security headers
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export default withAuth(
  function middleware(req) {
    const response = NextResponse.next();
    
    // Apply security headers to all responses
    applySecurityHeaders(response);
    
    // Apply CORS headers for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      
      applyCorsHeaders(req as NextRequest, response);
    }
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check if path requires authentication
        const isProtectedPath = protectedPaths.some(path => {
          const pattern = path.replace(':path*', '.*');
          return new RegExp(`^${pattern}$`).test(req.nextUrl.pathname);
        });
        
        // Require token only for protected routes
        if (isProtectedPath) {
          return !!token;
        }
        
        return true;
      },
    },
    pages: {
      signIn: '/login',
      error: '/auth/error',
    },
  }
);
