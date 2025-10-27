import { useEffect } from 'react';

interface KeyboardShortcuts {
  onRefresh?: () => void;
  onSettings?: () => void;
  onEscape?: () => void;
  onHelp?: () => void;
}

export function useKeyboardShortcuts({ onRefresh, onSettings, onEscape, onHelp }: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+R - Refresh
      if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        onRefresh?.();
      }

      // Ctrl+, - Settings
      if (event.ctrlKey && event.key === ',') {
        event.preventDefault();
        onSettings?.();
      }

      // Escape - Close modals/panels
      if (event.key === 'Escape') {
        onEscape?.();
      }

      // F1 - Help
      if (event.key === 'F1') {
        event.preventDefault();
        onHelp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onRefresh, onSettings, onEscape, onHelp]);
}
