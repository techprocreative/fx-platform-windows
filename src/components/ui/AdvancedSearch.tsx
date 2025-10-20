'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  Clock, 
  Tag,
  Calendar,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';

export interface SearchFilter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in' | 'notIn';
  value: any;
  label?: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: { value: string; label: string }[];
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: SearchFilter[];
  createdAt: Date;
  isDefault?: boolean;
}

export interface SearchTemplate {
  id: string;
  name: string;
  description: string;
  filters: Omit<SearchFilter, 'value'>[];
  category: string;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilter[]) => void;
  savedSearches?: SavedSearch[];
  templates?: SearchTemplate[];
  fields: Array<{
    value: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean';
    options?: { value: string; label: string }[];
  }>;
  placeholder?: string;
  className?: string;
}

export function AdvancedSearch({
  onSearch,
  savedSearches = [],
  templates = [],
  fields,
  placeholder = 'Search...',
  className = '',
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const addFilter = useCallback(() => {
    const newFilter: SearchFilter = {
      id: Date.now().toString(),
      field: fields[0]?.value || '',
      operator: 'contains',
      value: '',
      type: fields[0]?.type || 'text',
      options: fields[0]?.options,
    };
    setFilters(prev => [...prev, newFilter]);
  }, [fields]);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<SearchFilter>) => {
    setFilters(prev => prev.map(f => 
      f.id === id ? { ...f, ...updates } : f
    ));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
    setQuery('');
  }, []);

  const handleSearch = useCallback(() => {
    onSearch(query, filters);
  }, [query, filters, onSearch]);

  const applySavedSearch = useCallback((savedSearch: SavedSearch) => {
    setFilters(savedSearch.filters);
    setShowSavedSearches(false);
  }, []);

  const applyTemplate = useCallback((template: SearchTemplate) => {
    const newFilters = template.filters.map(filter => ({
      ...filter,
      id: Date.now().toString() + Math.random(),
      value: filter.type === 'boolean' ? false : '',
    }));
    setFilters(newFilters);
    setShowTemplates(false);
  }, []);

  const saveSearch = useCallback(() => {
    const name = prompt('Enter a name for this search:');
    if (name) {
      const newSavedSearch: SavedSearch = {
        id: Date.now().toString(),
        name,
        filters,
        createdAt: new Date(),
      };
      // In a real app, this would save to backend
      console.log('Saving search:', newSavedSearch);
    }
  }, [filters]);

  const getOperatorLabel = (operator: SearchFilter['operator']) => {
    const labels = {
      equals: 'Equals',
      contains: 'Contains',
      startsWith: 'Starts with',
      endsWith: 'Ends with',
      greaterThan: 'Greater than',
      lessThan: 'Less than',
      between: 'Between',
      in: 'In',
      notIn: 'Not in',
    };
    return labels[operator];
  };

  const renderFilterValue = (filter: SearchFilter) => {
    const { type, operator, value, options } = filter;

    switch (type) {
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value === 'true' })}
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select...</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select...</option>
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => updateFilter(filter.id, { value: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder="Enter value..."
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <Button onClick={handleSearch} className="px-4">
          Search
        </Button>
        
        <Button
          variant="secondary"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Advanced
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowSavedSearches(!showSavedSearches)}
          className="flex items-center gap-2"
        >
          <Clock className="h-4 w-4" />
          Saved Searches
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex items-center gap-2"
        >
          <Tag className="h-4 w-4" />
          Templates
        </Button>
        
        {filters.length > 0 && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={saveSearch}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Search
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Filters */}
              {filters.map((filter, index) => (
                <div key={filter.id} className="flex gap-2 items-end">
                  {/* Field Select */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Field
                    </label>
                    <select
                      value={filter.field}
                      onChange={(e) => {
                        const field = fields.find(f => f.value === e.target.value);
                        updateFilter(filter.id, {
                          field: e.target.value,
                          type: field?.type || 'text',
                          options: field?.options,
                          value: '',
                        });
                      }}
                      className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {fields.map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operator Select */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Operator
                    </label>
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(filter.id, { operator: e.target.value as SearchFilter['operator'] })}
                      className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {Object.entries({
                        equals: 'Equals',
                        contains: 'Contains',
                        startsWith: 'Starts with',
                        endsWith: 'Ends with',
                        greaterThan: 'Greater than',
                        lessThan: 'Less than',
                        between: 'Between',
                        in: 'In',
                        notIn: 'Not in',
                      }).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Value Input */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary mb-1">
                      Value
                    </label>
                    {renderFilterValue(filter)}
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => removeFilter(filter.id)}
                    className="mb-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add Filter Button */}
              <Button
                variant="secondary"
                onClick={addFilter}
                className="w-full"
              >
                Add Filter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Searches */}
      {showSavedSearches && savedSearches.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-primary mb-3">Saved Searches</h3>
            <div className="space-y-2">
              {savedSearches.map(search => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-2 border border-secondary rounded-md hover:bg-secondary cursor-pointer"
                  onClick={() => applySavedSearch(search)}
                >
                  <div>
                    <div className="text-sm font-medium text-primary">{search.name}</div>
                    {search.description && (
                      <div className="text-xs text-tertiary">{search.description}</div>
                    )}
                  </div>
                  <div className="text-xs text-tertiary">
                    {search.filters.length} filter{search.filters.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates */}
      {showTemplates && templates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-primary mb-3">Search Templates</h3>
            <div className="space-y-2">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-2 border border-secondary rounded-md hover:bg-secondary cursor-pointer"
                  onClick={() => applyTemplate(template)}
                >
                  <div>
                    <div className="text-sm font-medium text-primary">{template.name}</div>
                    <div className="text-xs text-tertiary">{template.description}</div>
                  </div>
                  <div className="text-xs text-tertiary bg-secondary px-2 py-1 rounded">
                    {template.category}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Summary */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <div
              key={filter.id}
              className="flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full text-sm"
            >
              <span className="font-medium">
                {fields.find(f => f.value === filter.field)?.label || filter.field}
              </span>
              <span className="text-xs">{getOperatorLabel(filter.operator)}</span>
              <span>{String(filter.value)}</span>
              <button
                onClick={() => removeFilter(filter.id)}
                className="ml-1 hover:text-primary-900"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Search Analytics Component
export function SearchAnalytics({
  recentSearches,
  popularFilters,
  searchHistory,
}: {
  recentSearches: Array<{ query: string; timestamp: Date; resultCount: number }>;
  popularFilters: Array<{ field: string; value: string; count: number }>;
  searchHistory: Array<{ query: string; filters: SearchFilter[]; timestamp: Date }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-primary mb-4">Search Analytics</h3>
        
        <div className="space-y-4">
          {/* Recent Searches */}
          <div>
            <h4 className="text-xs font-medium text-secondary mb-2">Recent Searches</h4>
            <div className="space-y-1">
              {recentSearches.slice(0, 5).map((search, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-tertiary">{search.query}</span>
                  <span className="text-tertiary">{search.resultCount} results</span>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Filters */}
          <div>
            <h4 className="text-xs font-medium text-secondary mb-2">Popular Filters</h4>
            <div className="space-y-1">
              {popularFilters.slice(0, 5).map((filter, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-tertiary">
                    {filter.field}: {filter.value}
                  </span>
                  <span className="text-tertiary">{filter.count} uses</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}