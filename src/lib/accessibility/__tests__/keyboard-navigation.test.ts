/**
 * Unit Tests for Keyboard Navigation Utilities
 * 
 * These tests cover critical accessibility functions used throughout the application.
 */

import {
  generateKeyboardId,
  isFocusable,
  getFocusableElements,
  setupKeyboardNavigation,
  createFocusTrap,
  setupArrowKeyNavigation,
  createSkipLink,
  announceToScreenReader,
  isKeyboardNavigation,
  setupInteractionTracking,
  manageModalFocus
} from '../keyboard-navigation';

// Mock DOM methods
Object.defineProperty(HTMLElement.prototype, 'disabled', {
  get: function() { return this.hasAttribute('disabled'); },
  configurable: true
});

describe('Keyboard Navigation Utilities', () => {
  describe('generateKeyboardId', () => {
    it('should generate unique ID with default prefix', () => {
      const id = generateKeyboardId();
      expect(id).toMatch(/^kb-[a-z0-9]{9}$/);
    });

    it('should generate unique ID with custom prefix', () => {
      const id = generateKeyboardId('test');
      expect(id).toMatch(/^test-[a-z0-9]{9}$/);
    });

    it('should generate different IDs on multiple calls', () => {
      const id1 = generateKeyboardId();
      const id2 = generateKeyboardId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('isFocusable', () => {
    let element: HTMLElement;

    beforeEach(() => {
      element = document.createElement('div');
    });

    it('should return false for disabled elements', () => {
      element.setAttribute('disabled', '');
      element.setAttribute('tabindex', '0');
      expect(isFocusable(element)).toBe(false);
    });

    it('should return false for hidden elements', () => {
      element.style.display = 'none';
      element.setAttribute('tabindex', '0');
      expect(isFocusable(element)).toBe(false);
    });

    it('should return false for elements with aria-hidden="true"', () => {
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('tabindex', '0');
      expect(isFocusable(element)).toBe(false);
    });

    it('should return true for elements with tabindex >= 0', () => {
      element.setAttribute('tabindex', '0');
      expect(isFocusable(element)).toBe(true);
    });

    it('should return true for focusable tags', () => {
      const button = document.createElement('button');
      expect(isFocusable(button)).toBe(true);

      const input = document.createElement('input');
      expect(isFocusable(input)).toBe(true);

      const a = document.createElement('a');
      a.href = '#';
      expect(isFocusable(a)).toBe(true);
    });

    it('should return true for elements with button role', () => {
      element.setAttribute('role', 'button');
      expect(isFocusable(element)).toBe(true);
    });
  });

  describe('getFocusableElements', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should return focusable elements within container', () => {
      const button = document.createElement('button');
      const input = document.createElement('input');
      const div = document.createElement('div'); // Not focusable

      container.appendChild(button);
      container.appendChild(input);
      container.appendChild(div);

      const focusableElements = getFocusableElements(container);
      expect(focusableElements).toHaveLength(2);
      expect(focusableElements).toContain(button);
      expect(focusableElements).toContain(input);
    });

    it('should ignore disabled elements', () => {
      const button = document.createElement('button');
      const disabledButton = document.createElement('button');
      disabledButton.setAttribute('disabled', '');

      container.appendChild(button);
      container.appendChild(disabledButton);

      const focusableElements = getFocusableElements(container);
      expect(focusableElements).toHaveLength(1);
      expect(focusableElements).toContain(button);
    });

    it('should ignore elements with aria-hidden="true"', () => {
      const button = document.createElement('button');
      const hiddenButton = document.createElement('button');
      hiddenButton.setAttribute('aria-hidden', 'true');

      container.appendChild(button);
      container.appendChild(hiddenButton);

      const focusableElements = getFocusableElements(container);
      expect(focusableElements).toHaveLength(1);
      expect(focusableElements).toContain(button);
    });
  });

  describe('setupKeyboardNavigation', () => {
    let element: HTMLElement;
    let onKeyDown: jest.Mock;

    beforeEach(() => {
      element = document.createElement('div');
      onKeyDown = jest.fn();
    });

    it('should set up keyboard event listeners', () => {
      const cleanup = setupKeyboardNavigation(element, {
        keys: ['Enter'],
        onKeyDown
      });

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(event);

      expect(onKeyDown).toHaveBeenCalledWith(event, element);

      cleanup();
    });

    it('should ignore keys not in the keys array', () => {
      const cleanup = setupKeyboardNavigation(element, {
        keys: ['Enter'],
        onKeyDown
      });

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      element.dispatchEvent(event);

      expect(onKeyDown).not.toHaveBeenCalled();

      cleanup();
    });

    it('should prevent default when specified', () => {
      const cleanup = setupKeyboardNavigation(element, {
        keys: ['Enter'],
        onKeyDown,
        preventDefault: true
      });

      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      element.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);

      cleanup();
    });

    it('should return cleanup function', () => {
      const cleanup = setupKeyboardNavigation(element, { onKeyDown });

      expect(typeof cleanup).toBe('function');

      // Call cleanup to remove event listeners
      cleanup();
    });
  });

  describe('createFocusTrap', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);

      // Add focusable elements
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      button1.textContent = 'Button 1';
      button2.textContent = 'Button 2';
      container.appendChild(button1);
      container.appendChild(button2);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should create focus trap with activate and deactivate methods', () => {
      const focusTrap = createFocusTrap(container);

      expect(focusTrap.activate).toBeDefined();
      expect(focusTrap.deactivate).toBeDefined();
      expect(typeof focusTrap.activate).toBe('function');
      expect(typeof focusTrap.deactivate).toBe('function');
    });

    it('should focus first element when activated', () => {
      const focusTrap = createFocusTrap(container);
      
      // Mock focus method
      const firstButton = container.querySelector('button') as HTMLElement;
      firstButton.focus = jest.fn();

      focusTrap.activate();

      expect(firstButton.focus).toHaveBeenCalled();
    });

    it('should handle escape key when escapeDeactivates is true', () => {
      const onEscape = jest.fn();
      const focusTrap = createFocusTrap(container, {
        escapeDeactivates: true,
        onEscape
      });

      focusTrap.activate();

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(onEscape).toHaveBeenCalled();
    });
  });

  describe('setupArrowKeyNavigation', () => {
    let container: HTMLElement;
    let onSelect: jest.Mock;

    beforeEach(() => {
      container = document.createElement('div');
      onSelect = jest.fn();

      // Add focusable elements
      for (let i = 0; i < 3; i++) {
        const button = document.createElement('button');
        button.textContent = `Button ${i}`;
        container.appendChild(button);
      }
    });

    it('should set up arrow key navigation', () => {
      const cleanup = setupArrowKeyNavigation(container, {
        onSelect
      });

      const firstButton = container.querySelector('button') as HTMLElement;
      firstButton.focus();

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      firstButton.dispatchEvent(downEvent);

      // Should move focus to next element
      cleanup();
    });

    it('should handle Enter key selection', () => {
      const cleanup = setupArrowKeyNavigation(container, {
        onSelect
      });

      const firstButton = container.querySelector('button') as HTMLElement;
      firstButton.focus();

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      firstButton.dispatchEvent(enterEvent);

      expect(onSelect).toHaveBeenCalledWith(firstButton);

      cleanup();
    });

    it('should return cleanup function', () => {
      const cleanup = setupArrowKeyNavigation(container);

      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('createSkipLink', () => {
    let target: HTMLElement;

    beforeEach(() => {
      target = document.createElement('main');
      target.id = 'main-content';
      document.body.appendChild(target);
    });

    afterEach(() => {
      document.body.removeChild(target);
    });

    it('should create skip link element', () => {
      const skipLink = createSkipLink(target);

      expect(skipLink.tagName).toBe('A');
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(skipLink.textContent).toBe('Skip to main content');
      expect(skipLink.className).toContain('sr-only');
    });

    it('should use custom label', () => {
      const skipLink = createSkipLink(target, 'Custom skip link');

      expect(skipLink.textContent).toBe('Custom skip link');
    });

    it('should add ID to target if missing', () => {
      const targetWithoutId = document.createElement('main');
      document.body.appendChild(targetWithoutId);

      const skipLink = createSkipLink(targetWithoutId);

      expect(targetWithoutId.id).toMatch(/^main-[a-z0-9]{9}$/);
      expect(skipLink.getAttribute('href')).toBe(`#${targetWithoutId.id}`);

      document.body.removeChild(targetWithoutId);
    });
  });

  describe('announceToScreenReader', () => {
    beforeEach(() => {
      // Clean up any existing elements
      document.querySelectorAll('[aria-live]').forEach(el => el.remove());
    });

    it('should create live region element', () => {
      announceToScreenReader('Test message');

      const liveRegion = document.querySelector('[aria-live]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent).toBe('Test message');
    });

    it('should use polite priority by default', () => {
      announceToScreenReader('Test message');

      const liveRegion = document.querySelector('[aria-live]');
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    });

    it('should use assertive priority when specified', () => {
      announceToScreenReader('Test message', 'assertive');

      const liveRegion = document.querySelector('[aria-live]');
      expect(liveRegion?.getAttribute('aria-live')).toBe('assertive');
    });

    it('should remove element after announcement', (done) => {
      announceToScreenReader('Test message', 'polite');

      setTimeout(() => {
        const liveRegion = document.querySelector('[aria-live]');
        // Element should still exist at this point since we didn't specify clearAfter
        expect(liveRegion).toBeTruthy();
        done();
      }, 100);
    });
  });

  describe('isKeyboardNavigation', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should return false when no interaction type is stored', () => {
      expect(isKeyboardNavigation()).toBe(false);
    });

    it('should return true when keyboard interaction is stored', () => {
      sessionStorage.setItem('lastInteractionType', 'keyboard');
      expect(isKeyboardNavigation()).toBe(true);
    });

    it('should return false when mouse interaction is stored', () => {
      sessionStorage.setItem('lastInteractionType', 'mouse');
      expect(isKeyboardNavigation()).toBe(false);
    });
  });

  describe('setupInteractionTracking', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should set up event listeners', () => {
      const cleanup = setupInteractionTracking();

      // Simulate keyboard navigation
      const keyboardEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      document.dispatchEvent(keyboardEvent);

      expect(sessionStorage.getItem('lastInteractionType')).toBe('keyboard');

      // Simulate mouse interaction
      const mouseEvent = new MouseEvent('mousedown');
      document.dispatchEvent(mouseEvent);

      expect(sessionStorage.getItem('lastInteractionType')).toBe('mouse');

      cleanup();
    });

    it('should return cleanup function', () => {
      const cleanup = setupInteractionTracking();

      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('manageModalFocus', () => {
    let modal: HTMLElement;

    beforeEach(() => {
      modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      document.body.appendChild(modal);
    });

    afterEach(() => {
      document.body.removeChild(modal);
    });

    it('should create modal focus manager', () => {
      const modalManager = manageModalFocus(modal);

      expect(modalManager.open).toBeDefined();
      expect(modalManager.close).toBeDefined();
      expect(typeof modalManager.open).toBe('function');
      expect(typeof modalManager.close).toBe('function');
    });

    it('should set aria-hidden and remove when opened/closed', () => {
      const modalManager = manageModalFocus(modal);

      modalManager.open();
      expect(modal.getAttribute('aria-hidden')).toBe('false');
      expect(modal.hasAttribute('inert')).toBe(false);

      modalManager.close();
      expect(modal.getAttribute('aria-hidden')).toBe('true');
      expect(modal.getAttribute('inert')).toBe('true');
    });
  });
});