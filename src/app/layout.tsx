import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { ClientProvider } from '../components/providers/ClientProvider';
import { DefaultSkipLinks } from '../components/accessibility/SkipLink';
import { setupInteractionTracking } from '@/lib/accessibility/keyboard-navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NexusTrade - AI-Powered Trading Platform',
  description: 'Empower your trading with institutional-grade technology',
  keywords: [
    'trading',
    'forex',
    'cryptocurrency',
    'automated trading',
    'AI',
    'machine learning',
  ],
  viewport: 'width=device-width, initial-scale=1',
  icons: '/favicon.ico',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set up interaction tracking for keyboard navigation
  if (typeof window !== 'undefined') {
    setupInteractionTracking();
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="Empower your trading with institutional-grade technology" />
      </head>
      <body className={inter.className}>
        <DefaultSkipLinks />
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}
