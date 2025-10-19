import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/dashboard/:path*',
    '/api/strategy/:path*',
  ],
};

export default withAuth(
  function middleware(req) {
    // Allow access if authenticated
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Require token for protected routes
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
      error: '/auth/error',
    },
  }
);
