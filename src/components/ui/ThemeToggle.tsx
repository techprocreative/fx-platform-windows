'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-4 w-4" />;
    }
    return resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getLabel = () => {
    if (theme === 'system') {
      return `System theme (${resolvedTheme})`;
    }
    return `${theme === 'dark' ? 'Dark' : 'Light'} mode`;
  };

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return (
    <Tooltip content={getLabel()} position="bottom">
      <button
        onClick={cycleTheme}
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        aria-label={`Current theme: ${getLabel()}. Click to change theme.`}
      >
        <span className="text-neutral-700 dark:text-neutral-300">
          {getIcon()}
        </span>
      </button>
    </Tooltip>
  );
}

// Extended theme toggle with dropdown for more control
export function ThemeToggleDropdown() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        aria-label="Theme selector"
      >
        <span className="text-neutral-700 dark:text-neutral-300">
          {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </span>
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {theme === 'system' ? `System (${resolvedTheme})` : theme}
        </span>
      </button>

      <div className="absolute right-0 mt-2 w-40 rounded-lg bg-white shadow-lg border border-neutral-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 dark:bg-neutral-900 dark:border-neutral-700">
        <div className="p-1">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                theme === value
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {theme === value && (
                <span className="ml-auto text-primary-600 dark:text-primary-400">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}