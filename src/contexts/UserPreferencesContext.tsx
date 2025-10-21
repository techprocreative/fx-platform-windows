'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface DashboardLayout {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  widgets: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    collapsed?: boolean;
  }>;
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  compactMode: boolean;
  showAnimations: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  tradeAlerts: boolean;
  strategyAlerts: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
  soundEnabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface TradingPreferences {
  defaultOrderType: 'market' | 'limit' | 'stop';
  defaultTimeframe: string;
  defaultLotSize: number;
  riskPerTrade: number;
  maxDailyLoss: number;
  confirmTrades: boolean;
  autoClosePositions: boolean;
  slippageTolerance: number;
  preferredPairs: string[];
}

export interface UserPreferences {
  dashboard: DashboardLayout;
  display: DisplayPreferences;
  notifications: NotificationPreferences;
  trading: TradingPreferences;
  customSettings: Record<string, any>;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  exportPreferences: () => string;
  importPreferences: (data: string) => void;
  isLoading: boolean;
  error: string | null;
}

const defaultPreferences: UserPreferences = {
  dashboard: {
    sidebarCollapsed: false,
    sidebarWidth: 256,
    widgets: [],
  },
  display: {
    theme: 'system',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '24h',
    currency: 'USD',
    compactMode: false,
    showAnimations: true,
    highContrast: false,
    fontSize: 'medium',
  },
  notifications: {
    email: true,
    push: true,
    inApp: true,
    tradeAlerts: true,
    strategyAlerts: true,
    systemUpdates: true,
    marketingEmails: false,
    soundEnabled: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  },
  trading: {
    defaultOrderType: 'market',
    defaultTimeframe: '1h',
    defaultLotSize: 0.01,
    riskPerTrade: 2,
    maxDailyLoss: 100,
    confirmTrades: true,
    autoClosePositions: false,
    slippageTolerance: 5,
    preferredPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
  },
  customSettings: {},
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all fields exist
        const merged = mergePreferences(defaultPreferences, parsed);
        setPreferences(merged);
      }
    } catch (err) {
      console.error('Failed to load user preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
      } catch (err) {
        console.error('Failed to save user preferences:', err);
        setError('Failed to save preferences');
      }
    }
  }, [preferences, isLoading]);

  // Apply theme preference
  useEffect(() => {
    const { theme } = preferences.display;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [preferences.display.theme]);

  // Apply font size preference
  useEffect(() => {
    const { fontSize } = preferences.display;
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [preferences.display.fontSize]);

  // Apply high contrast preference
  useEffect(() => {
    const { highContrast } = preferences.display;
    if (highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, [preferences.display.highContrast]);

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences(prev => mergePreferences(prev, updates));
    setError(null);
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    setError(null);
  }, []);

  const exportPreferences = useCallback(() => {
    try {
      return JSON.stringify(preferences, null, 2);
    } catch (err) {
      console.error('Failed to export preferences:', err);
      setError('Failed to export preferences');
      return '';
    }
  }, [preferences]);

  const importPreferences = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      const merged = mergePreferences(defaultPreferences, parsed);
      setPreferences(merged);
      setError(null);
    } catch (err) {
      console.error('Failed to import preferences:', err);
      setError('Failed to import preferences: Invalid format');
    }
  }, []);

  const value: UserPreferencesContextType = {
    preferences,
    updatePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,
    isLoading,
    error,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}

// Helper function to deeply merge preferences
function mergePreferences(base: UserPreferences, updates: Partial<UserPreferences>): UserPreferences {
  const merged = { ...base };
  
  for (const key in updates) {
    const updateValue = updates[key as keyof UserPreferences];
    if (updateValue === undefined) continue;
    
    if (typeof updateValue === 'object' && updateValue !== null && !Array.isArray(updateValue)) {
      merged[key as keyof UserPreferences] = {
        ...merged[key as keyof UserPreferences],
        ...updateValue,
      } as any;
    } else {
      merged[key as keyof UserPreferences] = updateValue as any;
    }
  }
  
  return merged;
}

// Validation functions
export function validatePreferences(preferences: Partial<UserPreferences>): string[] {
  const errors: string[] = [];

  // Validate display preferences
  if (preferences.display) {
    if (preferences.display.theme && !['light', 'dark', 'system'].includes(preferences.display.theme)) {
      errors.push('Invalid theme value');
    }
    if (preferences.display.fontSize && !['small', 'medium', 'large'].includes(preferences.display.fontSize)) {
      errors.push('Invalid font size');
    }
    if (preferences.display.timeFormat && !['12h', '24h'].includes(preferences.display.timeFormat)) {
      errors.push('Invalid time format');
    }
  }

  // Validate trading preferences
  if (preferences.trading) {
    if (preferences.trading.riskPerTrade !== undefined && 
        (preferences.trading.riskPerTrade < 0 || preferences.trading.riskPerTrade > 100)) {
      errors.push('Risk per trade must be between 0 and 100');
    }
    if (preferences.trading.defaultLotSize !== undefined && 
        (preferences.trading.defaultLotSize <= 0 || preferences.trading.defaultLotSize > 100)) {
      errors.push('Default lot size must be between 0 and 100');
    }
    if (preferences.trading.slippageTolerance !== undefined && 
        (preferences.trading.slippageTolerance < 0 || preferences.trading.slippageTolerance > 100)) {
      errors.push('Slippage tolerance must be between 0 and 100');
    }
  }

  return errors;
}

// Hooks for specific preference categories
export function useDisplayPreferences() {
  const { preferences, updatePreferences } = useUserPreferences();
  return {
    preferences: preferences.display,
    updatePreferences: (updates: Partial<DisplayPreferences>) => 
      updatePreferences({ display: { ...preferences.display, ...updates } }),
  };
}

export function useNotificationPreferences() {
  const { preferences, updatePreferences } = useUserPreferences();
  return {
    preferences: preferences.notifications,
    updatePreferences: (updates: Partial<NotificationPreferences>) => 
      updatePreferences({ notifications: { ...preferences.notifications, ...updates } }),
  };
}

export function useTradingPreferences() {
  const { preferences, updatePreferences } = useUserPreferences();
  return {
    preferences: preferences.trading,
    updatePreferences: (updates: Partial<TradingPreferences>) => 
      updatePreferences({ trading: { ...preferences.trading, ...updates } }),
  };
}

export function useDashboardPreferences() {
  const { preferences, updatePreferences } = useUserPreferences();
  return {
    preferences: preferences.dashboard,
    updatePreferences: (updates: Partial<DashboardLayout>) => 
      updatePreferences({ dashboard: { ...preferences.dashboard, ...updates } }),
  };
}