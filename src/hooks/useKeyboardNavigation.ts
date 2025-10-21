/**
 * React Hooks for Keyboard Navigation
 * 
 * These hooks provide easy integration with the keyboard navigation utilities
 * for React components.
 */

import { useEffect, useRef, useCallback } from 'react';
import { 
  setupKeyboardNavigation, 
  setupArrowKeyNavigation, 
  createFocusTrap,
  manageModalFocus,
  setupInteractionTracking,
  announceToScreenReader,
  isKeyboardNavigation,
  type KeyboardNavigationOptions,
  type FocusTrapOptions
} from '@/lib/accessibility/keyboard-navigation';

/**
 * Hook for setting up keyboard navigation on an element
 */
export function useKeyboardNavigation(
  options: KeyboardNavigationOptions = {}
) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const cleanup = setupKeyboardNavigation(element, options);
    return cleanup;
  }, [options]);

  return elementRef;
}

/**
 * Hook for arrow key navigation in lists/menus
 */
export function useArrowKeyNavigation(
  options: {
    orientation?: 'vertical' | 'horizontal';
    loop?: boolean;
    onSelect?: (element: HTMLElement) => void;
  } = {}
) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cleanup = setupArrowKeyNavigation(container, options);
    return cleanup;
  }, [options]);

  return containerRef;
}

/**
 * Hook for focus trap functionality
 */
export function useFocusTrap(
  options: FocusTrapOptions = {}
) {
  const containerRef = useRef<HTMLElement>(null);
  const focusTrapRef = useRef<{ activate: () => void; deactivate: () => void } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    focusTrapRef.current = createFocusTrap(container, options);

    return () => {
      focusTrapRef.current?.deactivate();
    };
  }, [options]);

  const activate = useCallback(() => {
    focusTrapRef.current?.activate();
  }, []);

  const deactivate = useCallback(() => {
    focusTrapRef.current?.deactivate();
  }, []);

  return { containerRef, activate, deactivate };
}

/**
 * Hook for modal focus management
 */
export function useModalFocus(
  options: FocusTrapOptions = {}
) {
  const modalRef = useRef<HTMLElement>(null);
  const modalManagerRef = useRef<{ open: () => void; close: () => void } | null>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    modalManagerRef.current = manageModalFocus(modal, options);
  }, [options]);

  const open = useCallback(() => {
    modalManagerRef.current?.open();
  }, []);

  const close = useCallback(() => {
    modalManagerRef.current?.close();
  }, []);

  return { modalRef, open, close };
}

/**
 * Hook for tracking user interaction type
 */
export function useInteractionTracking() {
  useEffect(() => {
    const cleanup = setupInteractionTracking();
    return cleanup;
  }, []);

  return isKeyboardNavigation();
}

/**
 * Hook for screen reader announcements
 */
export function useScreenReader() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, []);

  return { announce };
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  options: {
    preventDefault?: boolean;
    stopPropagation?: boolean;
    target?: HTMLElement | Document;
  } = {}
) {
  const { preventDefault = true, stopPropagation = false, target = document } = options;

  useEffect(() => {
    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      const key = [
        keyboardEvent.ctrlKey && 'ctrl',
        keyboardEvent.altKey && 'alt',
        keyboardEvent.shiftKey && 'shift',
        keyboardEvent.metaKey && 'meta',
        keyboardEvent.key
      ].filter(Boolean).join('+');

      if (shortcuts[key]) {
        if (preventDefault) {
          keyboardEvent.preventDefault();
        }
        if (stopPropagation) {
          keyboardEvent.stopPropagation();
        }
        shortcuts[key]();
      }
    };

    target.addEventListener('keydown', handleKeyDown);
    return () => target.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, preventDefault, stopPropagation, target]);
}

/**
 * Hook for managing focusable elements
 */
export function useFocusableElements(containerRef: React.RefObject<HTMLElement>) {
  const getFocusableElements = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      'area[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]:not([aria-disabled="true"])',
      '[role="tab"]:not([aria-disabled="true"])'
    ];

    const elements = Array.from(
      container.querySelectorAll(focusableSelectors.join(', '))
    ) as HTMLElement[];

    return elements.filter(element => {
      if (
        ('disabled' in element && element.disabled) || 
        element.hidden || 
        element.getAttribute('aria-hidden') === 'true'
      ) {
        return false;
      }
      return true;
    });
  }, [containerRef]);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
      return elements[0];
    }
    return null;
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
      return elements[elements.length - 1];
    }
    return null;
  }, [getFocusableElements]);

  const focusNext = useCallback((currentElement?: HTMLElement) => {
    const elements = getFocusableElements();
    const currentIndex = currentElement ? elements.indexOf(currentElement) : -1;
    
    if (currentIndex < elements.length - 1) {
      elements[currentIndex + 1].focus();
      return elements[currentIndex + 1];
    } else if (elements.length > 0) {
      elements[0].focus();
      return elements[0];
    }
    return null;
  }, [getFocusableElements]);

  const focusPrevious = useCallback((currentElement?: HTMLElement) => {
    const elements = getFocusableElements();
    const currentIndex = currentElement ? elements.indexOf(currentElement) : -1;
    
    if (currentIndex > 0) {
      elements[currentIndex - 1].focus();
      return elements[currentIndex - 1];
    } else if (elements.length > 0) {
      elements[elements.length - 1].focus();
      return elements[elements.length - 1];
    }
    return null;
  }, [getFocusableElements]);

  return {
    getFocusableElements,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious
  };
}