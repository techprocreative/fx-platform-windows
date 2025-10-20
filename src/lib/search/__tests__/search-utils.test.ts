/**
 * Unit Tests for Search Utilities
 * 
 * These tests cover critical search and filtering functions used throughout the application.
 */

import {
  fullTextSearch,
  applyFilters,
  highlightSearchTerms,
  createSearchIndex,
  searchWithIndex,
  debounceSearch,
  createSearchPipeline,
  type SearchOptions,
  type FilterCriteria
} from '../search-utils';

describe('Search Utilities', () => {
  // Sample data for testing
  const sampleItems = [
    {
      id: '1',
      name: 'Test Strategy',
      description: 'A strategy for testing purposes',
      symbol: 'EURUSD',
      timeframe: 'H1',
      type: 'manual'
    },
    {
      id: '2',
      name: 'Moving Average Cross',
      description: 'Strategy based on moving average crossovers',
      symbol: 'GBPUSD',
      timeframe: 'H4',
      type: 'ai_generated'
    },
    {
      id: '3',
      name: 'RSI Divergence',
      description: 'Strategy using RSI divergence signals',
      symbol: 'USDJPY',
      timeframe: 'D1',
      type: 'manual'
    }
  ];

  describe('fullTextSearch', () => {
    it('should return all items with empty query', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const results = fullTextSearch(sampleItems, '', options);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBe(1);
    });

    it('should search across specified fields', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const results = fullTextSearch(sampleItems, 'strategy', options);

      expect(results).toHaveLength(3);
      expect(results[0].item.name).toContain('Strategy');
    });

    it('should rank results by relevance', () => {
      const options: SearchOptions = {
        fields: ['name', 'description'],
        fieldBoosts: { name: 2, description: 1 }
      };

      const results = fullTextSearch(sampleItems, 'test', options);

      expect(results[0].item.name).toBe('Test Strategy');
      expect(results[0].score).toBeGreaterThan(results[1]?.score || 0);
    });

    it('should handle case sensitivity', () => {
      const options: SearchOptions = {
        fields: ['name'],
        caseSensitive: true
      };

      const results = fullTextSearch(sampleItems, 'TEST', options);

      expect(results).toHaveLength(0);
    });

    it('should respect minimum score threshold', () => {
      const options: SearchOptions = {
        fields: ['name', 'description'],
        minScore: 0.8
      };

      const results = fullTextSearch(sampleItems, 'xyz', options);

      expect(results).toHaveLength(0);
    });

    it('should return matches information', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const results = fullTextSearch(sampleItems, 'strategy', options);

      expect(results[0].matches).toContain('name: "strategy"');
    });
  });

  describe('applyFilters', () => {
    it('should filter items based on criteria', () => {
      const criteria: FilterCriteria[] = [
        { field: 'symbol', operator: 'eq', value: 'EURUSD' }
      ];

      const results = applyFilters(sampleItems, criteria);

      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('EURUSD');
    });

    it('should handle multiple criteria', () => {
      const criteria: FilterCriteria[] = [
        { field: 'type', operator: 'eq', value: 'manual' },
        { field: 'timeframe', operator: 'eq', value: 'H1' }
      ];

      const results = applyFilters(sampleItems, criteria);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('manual');
      expect(results[0].timeframe).toBe('H1');
    });

    it('should handle different operators', () => {
      const criteria: FilterCriteria[] = [
        { field: 'timeframe', operator: 'ne', value: 'H1' }
      ];

      const results = applyFilters(sampleItems, criteria);

      expect(results).toHaveLength(2);
      expect(results.every(item => item.timeframe !== 'H1')).toBe(true);
    });

    it('should handle contains operator', () => {
      const criteria: FilterCriteria[] = [
        { field: 'name', operator: 'contains', value: 'Strategy' }
      ];

      const results = applyFilters(sampleItems, criteria);

      expect(results).toHaveLength(2);
      expect(results.every(item => item.name.includes('Strategy'))).toBe(true);
    });

    it('should handle numeric operators', () => {
      const itemsWithNumbers = [
        { id: '1', name: 'Item 1', value: 10 },
        { id: '2', name: 'Item 2', value: 20 },
        { id: '3', name: 'Item 3', value: 30 }
      ];

      const criteria: FilterCriteria[] = [
        { field: 'value', operator: 'gt', value: 15 }
      ];

      const results = applyFilters(itemsWithNumbers, criteria);

      expect(results).toHaveLength(2);
      expect(results.every(item => item.value > 15)).toBe(true);
    });

    it('should handle in operator', () => {
      const criteria: FilterCriteria[] = [
        { field: 'symbol', operator: 'in', value: ['EURUSD', 'GBPUSD'] }
      ];

      const results = applyFilters(sampleItems, criteria);

      expect(results).toHaveLength(2);
      expect(results.every(item => ['EURUSD', 'GBPUSD'].includes(item.symbol))).toBe(true);
    });
  });

  describe('highlightSearchTerms', () => {
    it('should highlight search terms in text', () => {
      const result = highlightSearchTerms('Test Strategy for testing', ['test', 'strategy']);

      expect(result).toContain('<span class="highlight">Test</span>');
      expect(result).toContain('<span class="highlight">Strategy</span>');
      expect(result).toContain('<span class="highlight">testing</span>');
    });

    it('should handle case insensitivity', () => {
      const result = highlightSearchTerms('Test Strategy for testing', ['TEST', 'STRATEGY']);

      expect(result).toContain('<span class="highlight">Test</span>');
      expect(result).toContain('<span class="highlight">Strategy</span>');
    });

    it('should handle case sensitivity when specified', () => {
      const result = highlightSearchTerms('Test Strategy for testing', ['TEST'], {
        caseSensitive: true
      });

      expect(result).not.toContain('<span class="highlight">Test</span>');
    });

    it('should use custom highlight class', () => {
      const result = highlightSearchTerms('Test Strategy', ['test'], {
        highlightClass: 'custom-highlight'
      });

      expect(result).toContain('<span class="custom-highlight">Test</span>');
    });

    it('should return original text with no search terms', () => {
      const result = highlightSearchTerms('Test Strategy', []);

      expect(result).toBe('Test Strategy');
    });

    it('should handle overlapping terms correctly', () => {
      const result = highlightSearchTerms('Test Strategy', ['test', 'test strategy']);

      expect(result).toContain('<span class="highlight">Test Strategy</span>');
    });
  });

  describe('createSearchIndex', () => {
    it('should create search index from items', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const index = createSearchIndex(sampleItems, options.fields);

      expect(index.size).toBeGreaterThan(0);
      expect(index.has('strategy')).toBe(true);
      expect(index.has('test')).toBe(true);
    });

    it('should index words longer than 2 characters', () => {
      const items = [
        { id: '1', name: 'A B C D E F G' }
      ];

      const options: SearchOptions = {
        fields: ['name']
      };

      const index = createSearchIndex(items, options.fields);

      expect(index.has('a')).toBe(false);
      expect(index.has('b')).toBe(false);
      expect(index.has('c')).toBe(false);
      expect(index.has('d')).toBe(true);
    });

    it('should map words to item IDs', () => {
      const options: SearchOptions = {
        fields: ['name']
      };

      const index = createSearchIndex(sampleItems, options.fields);

      const strategyIds = index.get('strategy');
      expect(strategyIds).toBeDefined();
      expect(strategyIds!.size).toBe(3); // All items contain 'strategy'
    });
  });

  describe('searchWithIndex', () => {
    it('should search using pre-built index', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const index = createSearchIndex(sampleItems, options.fields);
      const results = searchWithIndex(sampleItems, index, 'strategy');

      expect(results).toHaveLength(3);
      expect(results.every(item => 
        item.name.toLowerCase().includes('strategy') || 
        item.description.toLowerCase().includes('strategy')
      )).toBe(true);
    });

    it('should return all items with empty query', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const index = createSearchIndex(sampleItems, options.fields);
      const results = searchWithIndex(sampleItems, index, '');

      expect(results).toHaveLength(3);
    });

    it('should handle multiple search terms', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const index = createSearchIndex(sampleItems, options.fields);
      const results = searchWithIndex(sampleItems, index, 'moving average');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Moving Average Cross');
    });
  });

  describe('debounceSearch', () => {
    jest.useFakeTimers();

    it('should debounce search function', () => {
      const mockFn = jest.fn();
      const debouncedSearch = debounceSearch(mockFn, 100);

      debouncedSearch('test');
      debouncedSearch('test2');
      debouncedSearch('test3');

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test3');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });

  describe('createSearchPipeline', () => {
    it('should create search pipeline with search, filter, and searchAndFilter methods', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const pipeline = createSearchPipeline(sampleItems, options);

      expect(pipeline.search).toBeDefined();
      expect(pipeline.filter).toBeDefined();
      expect(pipeline.searchAndFilter).toBeDefined();
      expect(typeof pipeline.search).toBe('function');
      expect(typeof pipeline.filter).toBe('function');
      expect(typeof pipeline.searchAndFilter).toBe('function');
    });

    it('should search using pipeline', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const pipeline = createSearchPipeline(sampleItems, options);
      const results = pipeline.search('strategy');

      expect(results).toHaveLength(3);
      expect(results[0].item.name).toContain('Strategy');
    });

    it('should filter using pipeline', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const pipeline = createSearchPipeline(sampleItems, options);
      const criteria: FilterCriteria[] = [
        { field: 'symbol', operator: 'eq', value: 'EURUSD' }
      ];
      const results = pipeline.filter(criteria);

      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('EURUSD');
    });

    it('should search and filter using pipeline', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const pipeline = createSearchPipeline(sampleItems, options);
      const criteria: FilterCriteria[] = [
        { field: 'type', operator: 'eq', value: 'manual' }
      ];
      const results = pipeline.searchAndFilter('strategy', criteria);

      expect(results).toHaveLength(2);
      expect(results.every(result => result.item.type === 'manual')).toBe(true);
    });

    it('should return all items with empty query and no criteria', () => {
      const options: SearchOptions = {
        fields: ['name', 'description']
      };

      const pipeline = createSearchPipeline(sampleItems, options);
      const results = pipeline.searchAndFilter('', []);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBe(1);
    });
  });
});