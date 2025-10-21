/**
 * Search Utilities
 * 
 * This file contains utilities for implementing advanced search and filtering
 * functionality throughout the application.
 */

export interface SearchableItem {
  id: string;
  [key: string]: any;
}

export interface SearchOptions {
  /** Fields to search in */
  fields: string[];
  /** Whether to use fuzzy matching */
  fuzzy?: boolean;
  /** Case sensitivity */
  caseSensitive?: boolean;
  /** Minimum score for matches */
  minScore?: number;
  /** Boost scores for certain fields */
  fieldBoosts?: Record<string, number>;
}

export interface FilterCriteria {
  /** Field to filter on */
  field: string;
  /** Filter operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'nin';
  /** Value to filter by */
  value: any;
}

/**
 * Perform full-text search on an array of items
 */
export function fullTextSearch<T extends SearchableItem>(
  items: T[],
  query: string,
  options: SearchOptions
): Array<{ item: T; score: number; matches: string[] }> {
  if (!query.trim()) {
    return items.map(item => ({ item, score: 1, matches: [] }));
  }

  const {
    fields,
    fuzzy = false,
    caseSensitive = false,
    minScore = 0.1,
    fieldBoosts = {}
  } = options;

  const searchTerms = query.trim().split(/\s+/);
  const results: Array<{ item: T; score: number; matches: string[] }> = [];

  for (const item of items) {
    let totalScore = 0;
    let allMatches: string[] = [];

    for (const term of searchTerms) {
      let termScore = 0;
      let termMatches: string[] = [];

      for (const field of fields) {
        const fieldValue = getFieldValue(item, field);
        if (fieldValue === null || fieldValue === undefined) continue;

        const stringValue = String(fieldValue);
        const boost = fieldBoosts[field] || 1;

        // Exact match
        if (caseSensitive) {
          if (stringValue.includes(term)) {
            termScore += boost * 1.0;
            termMatches.push(`${field}: "${term}"`);
          }
        } else {
          const lowerTerm = term.toLowerCase();
          const lowerValue = stringValue.toLowerCase();
          if (lowerValue.includes(lowerTerm)) {
            termScore += boost * 1.0;
            termMatches.push(`${field}: "${term}"`);
          }
        }

        // Fuzzy matching
        if (fuzzy && termScore === 0) {
          const similarity = calculateSimilarity(term, stringValue, caseSensitive);
          if (similarity > 0.7) {
            termScore += boost * similarity * 0.8;
            termMatches.push(`${field}: "~${term}"`);
          }
        }
      }

      totalScore += termScore;
      allMatches.push(...termMatches);
    }

    // Normalize score by number of terms
    const normalizedScore = totalScore / searchTerms.length;

    if (normalizedScore >= minScore) {
      results.push({
        item,
        score: normalizedScore,
        matches: allMatches
      });
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Apply filter criteria to an array of items
 */
export function applyFilters<T extends SearchableItem>(
  items: T[],
  criteria: FilterCriteria[]
): T[] {
  return items.filter(item => {
    return criteria.every(criterion => {
      const fieldValue = getFieldValue(item, criterion.field);
      return matchesCriteria(fieldValue, criterion.operator, criterion.value);
    });
  });
}

/**
 * Check if a value matches filter criteria
 */
function matchesCriteria(
  fieldValue: any,
  operator: FilterCriteria['operator'],
  criteriaValue: any
): boolean {
  switch (operator) {
    case 'eq':
      return fieldValue === criteriaValue;
    case 'ne':
      return fieldValue !== criteriaValue;
    case 'gt':
      return Number(fieldValue) > Number(criteriaValue);
    case 'gte':
      return Number(fieldValue) >= Number(criteriaValue);
    case 'lt':
      return Number(fieldValue) < Number(criteriaValue);
    case 'lte':
      return Number(fieldValue) <= Number(criteriaValue);
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(criteriaValue).toLowerCase());
    case 'startsWith':
      return String(fieldValue).toLowerCase().startsWith(String(criteriaValue).toLowerCase());
    case 'endsWith':
      return String(fieldValue).toLowerCase().endsWith(String(criteriaValue).toLowerCase());
    case 'in':
      return Array.isArray(criteriaValue) && criteriaValue.includes(fieldValue);
    case 'nin':
      return Array.isArray(criteriaValue) && !criteriaValue.includes(fieldValue);
    default:
      return false;
  }
}

/**
 * Get nested field value from object
 */
function getFieldValue(obj: any, fieldPath: string): any {
  return fieldPath.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Calculate similarity between two strings (Levenshtein distance)
 */
function calculateSimilarity(str1: string, str2: string, caseSensitive = false): number {
  if (!caseSensitive) {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
  }

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(
  text: string,
  searchTerms: string[],
  options: {
    caseSensitive?: boolean;
    highlightClass?: string;
  } = {}
): string {
  const { caseSensitive = false, highlightClass = 'highlight' } = options;
  
  if (!searchTerms.length) return text;

  let highlightedText = text;
  
  // Sort terms by length (longest first) to avoid overlapping highlights
  const sortedTerms = [...searchTerms].sort((a, b) => b.length - a.length);
  
  for (const term of sortedTerms) {
    if (!term.trim()) continue;
    
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapeRegExp(term), flags);
    
    highlightedText = highlightedText.replace(regex, (match) => {
      return `<span class="${highlightClass}">${match}</span>`;
    });
  }
  
  return highlightedText;
}

/**
 * Escape special characters in regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a search index for faster searching
 */
export function createSearchIndex<T extends SearchableItem>(
  items: T[],
  fields: string[]
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const item of items) {
    for (const field of fields) {
      const fieldValue = getFieldValue(item, field);
      if (fieldValue === null || fieldValue === undefined) continue;

      const words = String(fieldValue)
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2); // Skip very short words

      for (const word of words) {
        if (!index.has(word)) {
          index.set(word, new Set());
        }
        index.get(word)!.add(item.id);
      }
    }
  }

  return index;
}

/**
 * Search using pre-built index
 */
export function searchWithIndex<T extends SearchableItem>(
  items: T[],
  index: Map<string, Set<string>>,
  query: string
): T[] {
  if (!query.trim()) return items;

  const searchTerms = query.toLowerCase().split(/\s+/);
  const matchingIds = new Set<string>();

  for (const term of searchTerms) {
    const termMatches = index.get(term);
    if (termMatches) {
      if (matchingIds.size === 0) {
        // First term - add all matches
        termMatches.forEach(id => matchingIds.add(id));
      } else {
        // Subsequent terms - intersect with existing matches
        const currentIds = new Set(matchingIds);
        matchingIds.clear();
        
        termMatches.forEach(id => {
          if (currentIds.has(id)) {
            matchingIds.add(id);
          }
        });
      }
    }
  }

  // Convert matching IDs back to items
  const idToItem = new Map(items.map(item => [item.id, item]));
  return Array.from(matchingIds).map(id => idToItem.get(id)!).filter(Boolean);
}

/**
 * Debounce search function
 */
export function debounceSearch<T extends any[]>(
  searchFn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => searchFn(...args), delay);
  };
}

/**
 * Create a search and filter pipeline
 */
export function createSearchPipeline<T extends SearchableItem>(
  items: T[],
  searchOptions: SearchOptions,
  filterCriteria: FilterCriteria[] = []
): {
  search: (query: string) => Array<{ item: T; score: number; matches: string[] }>;
  filter: (criteria: FilterCriteria[]) => T[];
  searchAndFilter: (query: string, criteria?: FilterCriteria[]) => Array<{ item: T; score: number; matches: string[] }>;
} {
  const search = (query: string) => {
    return fullTextSearch(items, query, searchOptions);
  };

  const filter = (criteria: FilterCriteria[]) => {
    return applyFilters(items, criteria);
  };

  const searchAndFilter = (query: string, criteria: FilterCriteria[] = filterCriteria) => {
    let filteredItems = items;
    
    if (criteria.length > 0) {
      filteredItems = applyFilters(items, criteria);
    }
    
    if (query.trim()) {
      return fullTextSearch(filteredItems, query, searchOptions);
    }
    
    return filteredItems.map(item => ({ item, score: 1, matches: [] }));
  };

  return { search, filter, searchAndFilter };
}