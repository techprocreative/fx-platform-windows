import { type NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { verifyPassword } from './crypto';
import type { NextRequest } from 'next/server';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password');
        }

        if (user.locked && user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('Account is temporarily locked. Please try again later.');
        }

        const isPasswordValid = await verifyPassword(credentials.password, user.passwordHash);

        if (!isPasswordValid) {
          // Record failed login attempt
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: (user.failedLoginAttempts || 0) + 1,
              ...(user.failedLoginAttempts >= 4 && {
                locked: true,
                lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
              }),
            },
          });

          throw new Error('Invalid email or password');
        }

        // Reset failed login attempts on successful login
        if (user.failedLoginAttempts > 0 || user.locked) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              locked: false,
              lockedUntil: null,
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim() || user.email,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }

      if (account?.provider === 'credentials') {
        // Additional logic for credentials provider
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }

      return session;
    },

    async signIn({ user, account }) {
      if (account?.provider === 'credentials' && user.id) {
        // Log successful login
        const userRecord = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (userRecord?.emailVerified || account?.provider === 'credentials') {
          return true;
        }
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60,
  },
};

/**
 * Helper function to require authentication in API routes
 */
export async function requireAuth(request?: NextRequest) {
  const session = await getServerSession(authOptions);
  return session;
}
