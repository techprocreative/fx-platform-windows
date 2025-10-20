/**
 * ARIA Labels Utilities
 * 
 * This file contains utilities for implementing comprehensive ARIA labels
 * following WCAG 2.1 AA guidelines.
 */

export interface AriaLabelOptions {
  /** Primary label for the element */
  label?: string;
  /** Additional description or context */
  description?: string;
  /** Element's role or type */
  role?: string;
  /** Whether element is required */
  required?: boolean;
  /** Whether element is invalid */
  invalid?: boolean;
  /** Error message for invalid elements */
  errorMessage?: string;
  /** Current value for form elements */
  value?: string;
  /** Minimum value for range inputs */
  minValue?: number;
  /** Maximum value for range inputs */
  maxValue?: number;
  /** Current step or progress */
  valueNow?: number;
  /** Minimum step or progress */
  valueMin?: number;
  /** Maximum step or progress */
  valueMax?: number;
  /** Current text selection */
  valueText?: string;
  /** Whether element is expanded (accordion, dropdown) */
  expanded?: boolean;
  /** Whether element is pressed (toggle buttons) */
  pressed?: boolean;
  /** Whether element is selected */
  selected?: boolean;
  /** Whether element is checked (checkboxes) */
  checked?: boolean;
  /** Current sort direction */
  sort?: 'ascending' | 'descending' | 'none';
  /** Whether element is busy/loading */
  busy?: boolean;
  /** Whether element is disabled */
  disabled?: boolean;
  /** Whether element is hidden */
  hidden?: boolean;
  /** Live region settings */
  live?: 'off' | 'polite' | 'assertive';
  /** Atomic live region */
  atomic?: boolean;
  /** Relevant for live regions */
  relevant?: 'additions' | 'removals' | 'text' | 'all';
}

/**
 * Generate ARIA attributes based on options
 */
export function generateAriaAttributes(options: AriaLabelOptions): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (options.label) {
    attributes['aria-label'] = options.label;
  }

  if (options.description) {
    const id = generateAriaId('desc');
    attributes['aria-describedby'] = id;
    // Store description for later use
    (attributes as any)._descriptionId = id;
    (attributes as any)._descriptionText = options.description;
  }

  if (options.role) {
    attributes['role'] = options.role;
  }

  if (options.required) {
    attributes['aria-required'] = 'true';
  }

  if (options.invalid) {
    attributes['aria-invalid'] = 'true';
    if (options.errorMessage) {
      const id = generateAriaId('error');
      attributes['aria-errormessage'] = id;
      (attributes as any)._errorId = id;
      (attributes as any)._errorText = options.errorMessage;
    }
  }

  if (options.value !== undefined) {
    attributes['aria-valuenow'] = options.value.toString();
  }

  if (options.minValue !== undefined) {
    attributes['aria-valuemin'] = options.minValue.toString();
  }

  if (options.maxValue !== undefined) {
    attributes['aria-valuemax'] = options.maxValue.toString();
  }

  if (options.valueNow !== undefined) {
    attributes['aria-valuenow'] = options.valueNow.toString();
  }

  if (options.valueMin !== undefined) {
    attributes['aria-valuemin'] = options.valueMin.toString();
  }

  if (options.valueMax !== undefined) {
    attributes['aria-valuemax'] = options.valueMax.toString();
  }

  if (options.valueText) {
    attributes['aria-valuetext'] = options.valueText;
  }

  if (options.expanded !== undefined) {
    attributes['aria-expanded'] = options.expanded.toString();
  }

  if (options.pressed !== undefined) {
    attributes['aria-pressed'] = options.pressed.toString();
  }

  if (options.selected !== undefined) {
    attributes['aria-selected'] = options.selected.toString();
  }

  if (options.checked !== undefined) {
    attributes['aria-checked'] = options.checked.toString();
  }

  if (options.sort) {
    attributes['aria-sort'] = options.sort;
  }

  if (options.busy) {
    attributes['aria-busy'] = 'true';
  }

  if (options.disabled) {
    attributes['aria-disabled'] = 'true';
  }

  if (options.hidden) {
    attributes['aria-hidden'] = 'true';
  }

  if (options.live) {
    attributes['aria-live'] = options.live;
  }

  if (options.atomic) {
    attributes['aria-atomic'] = 'true';
  }

  if (options.relevant) {
    attributes['aria-relevant'] = options.relevant;
  }

  return attributes;
}

/**
 * Generate unique ARIA IDs
 */
export function generateAriaId(prefix = 'aria'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a live region for dynamic content updates
 */
export function createLiveRegion(
  message: string,
  options: {
    priority?: 'polite' | 'assertive';
    atomic?: boolean;
    clearAfter?: number;
  } = {}
): HTMLElement {
  const { priority = 'polite', atomic = false, clearAfter = 5000 } = options;

  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', atomic.toString());
  liveRegion.className = 'sr-only';
  liveRegion.textContent = message;

  document.body.appendChild(liveRegion);

  if (clearAfter > 0) {
    setTimeout(() => {
      if (liveRegion.parentNode) {
        liveRegion.parentNode.removeChild(liveRegion);
      }
    }, clearAfter);
  }

  return liveRegion;
}

/**
 * Announce message to screen readers
 */
export function announceMessage(
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
  clearAfter = 5000
): void {
  createLiveRegion(message, { priority, clearAfter });
}

/**
 * Set up ARIA labels for form elements
 */
export function setupFormAriaLabels(
  formElement: HTMLFormElement,
  options: {
    validateOnChange?: boolean;
    announceErrors?: boolean;
  } = {}
): () => void {
  const { validateOnChange = true, announceErrors = true } = options;

  const inputs = formElement.querySelectorAll('input, select, textarea');
  const errorContainers = new Map<string, HTMLElement>();

  // Create error containers
  inputs.forEach((input) => {
    const id = input.id || generateAriaId('input');
    input.id = id;

    const errorContainer = document.createElement('div');
    errorContainer.id = `${id}-error`;
    errorContainer.className = 'sr-only';
    errorContainer.setAttribute('role', 'alert');
    input.parentNode?.appendChild(errorContainer);
    errorContainers.set(id, errorContainer);

    // Set up initial ARIA attributes
    input.setAttribute('aria-describedby', `${id}-error`);
  });

  const handleInput = (event: Event) => {
    if (!validateOnChange) return;

    const input = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const id = input.id;
    const errorContainer = errorContainers.get(id);

    if (!errorContainer) return;

    // Basic validation
    const isValid = input.checkValidity();
    
    if (isValid) {
      input.removeAttribute('aria-invalid');
      errorContainer.textContent = '';
    } else {
      input.setAttribute('aria-invalid', 'true');
      const errorMessage = input.validationMessage || 'This field is required';
      errorContainer.textContent = errorMessage;
      
      if (announceErrors) {
        announceMessage(errorMessage, 'assertive');
      }
    }
  };

  inputs.forEach((input) => {
    input.addEventListener('input', handleInput);
    input.addEventListener('blur', handleInput);
  });

  return () => {
    inputs.forEach((input) => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', handleInput);
    });

    errorContainers.forEach((container) => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
  };
}

/**
 * Set up ARIA labels for data tables
 */
export function setupTableAriaLabels(tableElement: HTMLTableElement): void {
  // Set table role
  tableElement.setAttribute('role', 'table');

  // Find header row
  const headerRow = tableElement.querySelector('thead tr');
  if (headerRow) {
    headerRow.setAttribute('role', 'row');
    
    const headers = headerRow.querySelectorAll('th');
    headers.forEach((header, index) => {
      header.setAttribute('role', 'columnheader');
      header.setAttribute('aria-sort', 'none');
      
      // Add column index for reference
      header.setAttribute('aria-colindex', (index + 1).toString());
    });
  }

  // Set up body rows
  const bodyRows = tableElement.querySelectorAll('tbody tr');
  bodyRows.forEach((row, rowIndex) => {
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', (rowIndex + 1).toString());
    
    const cells = row.querySelectorAll('td');
    cells.forEach((cell, cellIndex) => {
      cell.setAttribute('role', 'cell');
      cell.setAttribute('aria-colindex', (cellIndex + 1).toString());
      
      // Associate with header if possible
      const header = tableElement.querySelector(`thead th:nth-child(${cellIndex + 1})`);
      if (header) {
        const headerId = header.id || generateAriaId('header');
        header.id = headerId;
        cell.setAttribute('aria-describedby', headerId);
      }
    });
  });

  // Add table caption if not present
  if (!tableElement.querySelector('caption')) {
    const caption = document.createElement('caption');
    caption.className = 'sr-only';
    caption.textContent = 'Data table with sortable columns';
    tableElement.insertBefore(caption, tableElement.firstChild);
  }
}

/**
 * Set up ARIA labels for navigation menus
 */
export function setupNavigationAriaLabels(navElement: HTMLElement): void {
  navElement.setAttribute('role', 'navigation');
  navElement.setAttribute('aria-label', 'Main navigation');

  const links = navElement.querySelectorAll('a');
  links.forEach((link, index) => {
    link.setAttribute('aria-current', link.classList.contains('active') ? 'page' : 'false');
  });
}

/**
 * Set up ARIA labels for progress indicators
 */
export function setupProgressAriaLabels(
  progressElement: HTMLElement,
  options: {
    value?: number;
    min?: number;
    max?: number;
    label?: string;
  } = {}
): void {
  const { value = 0, min = 0, max = 100, label = 'Loading progress' } = options;

  progressElement.setAttribute('role', 'progressbar');
  progressElement.setAttribute('aria-label', label);
  progressElement.setAttribute('aria-valuenow', value.toString());
  progressElement.setAttribute('aria-valuemin', min.toString());
  progressElement.setAttribute('aria-valuemax', max.toString());
  progressElement.setAttribute('aria-valuetext', `${Math.round((value / max) * 100)}%`);
}

/**
 * Set up ARIA labels for tabs
 */
export function setupTabsAriaLabels(tabListElement: HTMLElement): void {
  tabListElement.setAttribute('role', 'tablist');

  const tabs = tabListElement.querySelectorAll('[role="tab"], button');
  let selectedTab: HTMLElement | null = null;

  tabs.forEach((tab, index) => {
    const tabElement = tab as HTMLElement;
    const tabId = tabElement.id || generateAriaId('tab');
    const panelId = `${tabId}-panel`;

    tabElement.id = tabId;
    tabElement.setAttribute('role', 'tab');
    tabElement.setAttribute('aria-selected', 'false');
    tabElement.setAttribute('aria-controls', panelId);
    tabElement.setAttribute('tabindex', '-1');

    // Find corresponding panel
    const panel = document.getElementById(panelId) || 
                  document.querySelector(`[aria-labelledby="${tabId}"]`);
    
    if (panel) {
      panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabId);
      panel.setAttribute('tabindex', '0');
      panel.setAttribute('hidden', 'true');
    }

    // Set first tab as selected
    if (index === 0) {
      tabElement.setAttribute('aria-selected', 'true');
      tabElement.setAttribute('tabindex', '0');
      if (panel) {
        panel.removeAttribute('hidden');
      }
      selectedTab = tabElement;
    }
  });

  // Store selected tab for keyboard navigation
  (tabListElement as any)._selectedTab = selectedTab;
}

/**
 * Update ARIA labels for dynamic content
 */
export function updateAriaLabels(
  element: HTMLElement,
  updates: Partial<AriaLabelOptions>
): void {
  const attributes = generateAriaAttributes(updates);

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
}