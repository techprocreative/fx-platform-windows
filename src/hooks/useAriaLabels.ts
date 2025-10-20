/**
 * React Hooks for ARIA Labels
 * 
 * These hooks provide easy integration with the ARIA labels utilities
 * for React components.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  generateAriaAttributes,
  updateAriaLabels,
  announceMessage,
  setupFormAriaLabels,
  setupTableAriaLabels,
  setupNavigationAriaLabels,
  setupProgressAriaLabels,
  setupTabsAriaLabels,
  type AriaLabelOptions
} from '@/lib/accessibility/aria-labels';

/**
 * Hook for managing ARIA attributes on an element
 */
export function useAriaLabels(
  options: AriaLabelOptions = {}
) {
  const elementRef = useRef<HTMLElement>(null);
  const [currentOptions, setCurrentOptions] = useState(options);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const attributes = generateAriaAttributes(currentOptions);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key.startsWith('_')) return; // Skip internal properties
      element.setAttribute(key, value);
    });

    // Handle dynamic description and error elements
    if ((attributes as any)._descriptionId && (attributes as any)._descriptionText) {
      let descElement = document.getElementById((attributes as any)._descriptionId);
      if (!descElement) {
        descElement = document.createElement('div');
        descElement.id = (attributes as any)._descriptionId;
        descElement.className = 'sr-only';
        element.parentNode?.insertBefore(descElement, element.nextSibling);
      }
      descElement.textContent = (attributes as any)._descriptionText;
    }

    if ((attributes as any)._errorId && (attributes as any)._errorText) {
      let errorElement = document.getElementById((attributes as any)._errorId);
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = (attributes as any)._errorId;
        errorElement.className = 'sr-only';
        errorElement.setAttribute('role', 'alert');
        element.parentNode?.insertBefore(errorElement, element.nextSibling);
      }
      errorElement.textContent = (attributes as any)._errorText;
    }
  }, [currentOptions]);

  const updateLabels = useCallback((updates: Partial<AriaLabelOptions>) => {
    setCurrentOptions(prev => ({ ...prev, ...updates }));
  }, []);

  return { elementRef, updateLabels };
}

/**
 * Hook for screen reader announcements
 */
export function useAnnouncer() {
  const announce = useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite',
    clearAfter = 5000
  ) => {
    announceMessage(message, priority, clearAfter);
  }, []);

  return { announce };
}

/**
 * Hook for form accessibility
 */
export function useFormAriaLabels(
  options: {
    validateOnChange?: boolean;
    announceErrors?: boolean;
  } = {}
) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const cleanup = setupFormAriaLabels(form, options);
    return cleanup;
  }, [options]);

  return formRef;
}

/**
 * Hook for table accessibility
 */
export function useTableAriaLabels() {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    setupTableAriaLabels(table);
  }, []);

  return tableRef;
}

/**
 * Hook for navigation accessibility
 */
export function useNavigationAriaLabels(
  label: string = 'Main navigation'
) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    setupNavigationAriaLabels(nav);
    nav.setAttribute('aria-label', label);
  }, [label]);

  return navRef;
}

/**
 * Hook for progress indicator accessibility
 */
export function useProgressAriaLabels(
  options: {
    value?: number;
    min?: number;
    max?: number;
    label?: string;
  } = {}
) {
  const progressRef = useRef<HTMLElement>(null);
  const [currentValue, setCurrentValue] = useState(options.value || 0);

  useEffect(() => {
    const progress = progressRef.current;
    if (!progress) return;

    setupProgressAriaLabels(progress, {
      ...options,
      value: currentValue
    });
  }, [currentValue, options]);

  const updateProgress = useCallback((newValue: number) => {
    setCurrentValue(newValue);
  }, []);

  return { progressRef, updateProgress };
}

/**
 * Hook for tabs accessibility
 */
export function useTabsAriaLabels() {
  const tabListRef = useRef<HTMLElement>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  useEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    setupTabsAriaLabels(tabList);
    
    // Get initial selected tab
    const selected = tabList.querySelector('[aria-selected="true"]') as HTMLElement;
    if (selected) {
      setSelectedTab(selected.id);
    }
  }, []);

  const selectTab = useCallback((tabId: string) => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    // Update all tabs
    const tabs = tabList.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => {
      const tabElement = tab as HTMLElement;
      if (tabElement.id === tabId) {
        tabElement.setAttribute('aria-selected', 'true');
        tabElement.setAttribute('tabindex', '0');
      } else {
        tabElement.setAttribute('aria-selected', 'false');
        tabElement.setAttribute('tabindex', '-1');
      }
    });

    // Update panels
    const panels = document.querySelectorAll('[role="tabpanel"]');
    panels.forEach((panel) => {
      const panelElement = panel as HTMLElement;
      if (panelElement.getAttribute('aria-labelledby') === tabId) {
        panelElement.removeAttribute('hidden');
      } else {
        panelElement.setAttribute('hidden', 'true');
      }
    });

    setSelectedTab(tabId);
  }, []);

  return { tabListRef, selectedTab, selectTab };
}

/**
 * Hook for live regions
 */
export function useLiveRegion(
  options: {
    priority?: 'polite' | 'assertive';
    atomic?: boolean;
    clearAfter?: number;
  } = {}
) {
  const regionRef = useRef<HTMLElement | null>(null);
  const { priority = 'polite', atomic = false, clearAfter = 0 } = options;

  useEffect(() => {
    // Create live region
    const region = document.createElement('div');
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', atomic.toString());
    region.className = 'sr-only';
    document.body.appendChild(region);
    regionRef.current = region;

    return () => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    };
  }, [priority, atomic]);

  const announce = useCallback((message: string) => {
    if (!regionRef.current) return;

    regionRef.current.textContent = message;

    if (clearAfter > 0) {
      setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = '';
        }
      }, clearAfter);
    }
  }, [clearAfter]);

  return { announce };
}

/**
 * Hook for managing focus and ARIA states
 */
export function useFocusManagement() {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  const setFocus = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      setFocusedElement(elementId);
    }
  }, []);

  const clearFocus = useCallback(() => {
    if (focusedElement) {
      const element = document.getElementById(focusedElement);
      if (element) {
        element.blur();
      }
      setFocusedElement(null);
    }
  }, [focusedElement]);

  const announceFocusChange = useCallback((elementName: string) => {
    announceMessage(`Focused on ${elementName}`, 'polite');
  }, []);

  return {
    focusedElement,
    setFocus,
    clearFocus,
    announceFocusChange
  };
}

/**
 * Hook for validation states
 */
export function useValidationAria() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { announce } = useAnnouncer();

  const setError = useCallback((fieldId: string, message: string) => {
    setErrors(prev => ({ ...prev, [fieldId]: message }));
    
    const element = document.getElementById(fieldId);
    if (element) {
      element.setAttribute('aria-invalid', 'true');
      element.setAttribute('aria-errormessage', `${fieldId}-error`);
      
      // Create or update error message element
      let errorElement = document.getElementById(`${fieldId}-error`);
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = `${fieldId}-error`;
        errorElement.className = 'sr-only';
        errorElement.setAttribute('role', 'alert');
        element.parentNode?.insertBefore(errorElement, element.nextSibling);
      }
      errorElement.textContent = message;
      
      announce(message, 'assertive');
    }
  }, [announce]);

  const clearError = useCallback((fieldId: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
    
    const element = document.getElementById(fieldId);
    if (element) {
      element.removeAttribute('aria-invalid');
      element.removeAttribute('aria-errormessage');
      
      const errorElement = document.getElementById(`${fieldId}-error`);
      if (errorElement && errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
    }
  }, []);

  const clearAllErrors = useCallback(() => {
    Object.keys(errors).forEach(fieldId => {
      clearError(fieldId);
    });
  }, [errors, clearError]);

  return {
    errors,
    setError,
    clearError,
    clearAllErrors,
    hasErrors: Object.keys(errors).length > 0
  };
}