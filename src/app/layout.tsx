import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { ClientProvider } from '../components/providers/ClientProvider';

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}
