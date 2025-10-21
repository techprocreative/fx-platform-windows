/**
 * Keyboard Navigation Utilities
 * 
 * This file contains utilities for implementing proper keyboard navigation
 * throughout the application, following WCAG 2.1 AA guidelines.
 */

export interface KeyboardNavigationOptions {
  /** Array of keyboard keys to handle */
  keys?: string[];
  /** Callback function when key is pressed */
  onKeyDown?: (event: KeyboardEvent, element: HTMLElement) => void;
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
  /** Whether to stop event propagation */
  stopPropagation?: boolean;
}

export interface FocusTrapOptions {
  /** Initial element to focus */
  initialFocus?: HTMLElement;
  /** Element to restore focus to when trap is deactivated */
  restoreFocus?: HTMLElement;
  /** Whether to escape on Escape key */
  escapeDeactivates?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
}

/**
 * Generate unique ID for keyboard navigation elements
 */
export function generateKeyboardId(prefix = 'kb'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (
    ('disabled' in element && element.disabled) ||
    element.hidden ||
    element.getAttribute('aria-hidden') === 'true'
  ) {
    return false;
  }

  const focusableTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'AREA'];
  const hasTabIndex = element.tabIndex >= 0;
  const isFocusableTag = focusableTags.includes(element.tagName);
  const hasAriaRole = element.getAttribute('role') === 'button' || 
                      element.getAttribute('role') === 'link' ||
                      element.getAttribute('role') === 'tab';

  return hasTabIndex || isFocusableTag || hasAriaRole;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
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

  return elements.filter(isFocusable);
}

/**
 * Set up keyboard navigation for an element
 */
export function setupKeyboardNavigation(
  element: HTMLElement,
  options: KeyboardNavigationOptions = {}
): () => void {
  const {
    keys = ['Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'],
    onKeyDown,
    preventDefault = true,
    stopPropagation = false
  } = options;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (keys.includes(event.key)) {
      if (preventDefault) {
        event.preventDefault();
      }
      if (stopPropagation) {
        event.stopPropagation();
      }
      onKeyDown?.(event, element);
    }
  };

  element.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Create a focus trap within a container
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
): { activate: () => void; deactivate: () => void } {
  const {
    initialFocus,
    restoreFocus,
    escapeDeactivates = true,
    onEscape
  } = options;

  let previousActiveElement: HTMLElement | null = null;
  let isActive = false;

  const getFirstFocusable = (): HTMLElement | null => {
    const focusable = getFocusableElements(container);
    return focusable.length > 0 ? focusable[0] : null;
  };

  const getLastFocusable = (): HTMLElement | null => {
    const focusable = getFocusableElements(container);
    return focusable.length > 0 ? focusable[focusable.length - 1] : null;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isActive) return;

    if (event.key === 'Tab') {
      const focusable = getFocusableElements(container);
      
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    } else if (event.key === 'Escape' && escapeDeactivates) {
      event.preventDefault();
      onEscape?.();
      deactivate();
    }
  };

  const activate = () => {
    if (isActive) return;

    previousActiveElement = document.activeElement as HTMLElement;
    isActive = true;

    // Set initial focus
    const targetElement = initialFocus || getFirstFocusable();
    targetElement?.focus();

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
  };

  const deactivate = () => {
    if (!isActive) return;

    isActive = false;

    // Restore focus
    const targetElement = restoreFocus || previousActiveElement;
    targetElement?.focus();

    // Remove event listener
    document.removeEventListener('keydown', handleKeyDown);
  };

  return { activate, deactivate };
}

/**
 * Handle arrow key navigation for lists and menus
 */
export function setupArrowKeyNavigation(
  container: HTMLElement,
  options: {
    orientation?: 'vertical' | 'horizontal';
    loop?: boolean;
    onSelect?: (element: HTMLElement) => void;
  } = {}
): () => void {
  const { orientation = 'vertical', loop = true, onSelect } = options;
  const items = getFocusableElements(container);
  
  if (items.length === 0) return () => {};

  let currentIndex = -1;

  const handleKeyDown = (event: KeyboardEvent) => {
    const isVertical = orientation === 'vertical';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

    if (event.key === nextKey) {
      event.preventDefault();
      currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (loop ? 0 : currentIndex);
      items[currentIndex]?.focus();
    } else if (event.key === prevKey) {
      event.preventDefault();
      currentIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? items.length - 1 : currentIndex);
      items[currentIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      currentIndex = 0;
      items[currentIndex]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      currentIndex = items.length - 1;
      items[currentIndex]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (currentIndex >= 0 && currentIndex < items.length) {
        onSelect?.(items[currentIndex]);
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Skip link functionality for accessibility
 */
export function createSkipLink(
  target: HTMLElement,
  label: string = 'Skip to main content'
): HTMLAnchorElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${target.id || generateKeyboardId('main')}`;
  skipLink.textContent = label;
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-primary-500';
  
  // Ensure target has an ID
  if (!target.id) {
    target.id = generateKeyboardId('main');
  }

  return skipLink;
}

/**
 * Announce content to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if user is navigating with keyboard
 */
export function isKeyboardNavigation(): boolean {
  // Check if the last interaction was keyboard-based
  const lastInteraction = sessionStorage.getItem('lastInteractionType');
  return lastInteraction === 'keyboard';
}

/**
 * Track user interaction type (mouse vs keyboard)
 */
export function setupInteractionTracking(): () => void {
  const handleMouseDown = () => {
    sessionStorage.setItem('lastInteractionType', 'mouse');
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Only track actual navigation keys, not modifier keys
    if (['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      sessionStorage.setItem('lastInteractionType', 'keyboard');
    }
  };

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Focus management for modal dialogs
 */
export function manageModalFocus(
  modal: HTMLElement,
  options: FocusTrapOptions = {}
): { open: () => void; close: () => void } {
  const focusTrap = createFocusTrap(modal, options);
  
  const open = () => {
    modal.setAttribute('aria-hidden', 'false');
    modal.removeAttribute('inert');
    focusTrap.activate();
    announceToScreenReader('Dialog opened');
  };

  const close = () => {
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', 'true');
    focusTrap.deactivate();
    announceToScreenReader('Dialog closed');
  };

  return { open, close };
}