'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { HelpProvider } from '@/contexts/HelpContext';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';

export function ClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <HelpProvider>
          <UserPreferencesProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                },
              }}
            />
          </UserPreferencesProvider>
        </HelpProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
