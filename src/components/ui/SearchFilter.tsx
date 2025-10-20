/**
 * Search & Filter Component
 * 
 * Provides advanced search and filtering capabilities for data tables and lists
 * with full-text search, multi-criteria filtering, and saved preferences.
 */

"use client";

import * as React from "react";
import { Search, Filter, X, ChevronDown, Save, RotateCcw } from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";
import { cn } from "@/lib/utils";
import { useAriaLabels } from "@/hooks/useAriaLabels";

export interface FilterOption {
  id: string;
  label: string;
  value: string | number | boolean;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean';
  options?: Array<{ label: string; value: string | number }>;
  placeholder?: string;
}

export interface SearchFilterProps {
  /** Current search query */
  searchQuery: string;
  /** Current filter values */
  filters: Record<string, any>;
  /** Available filter options */
  filterOptions: FilterOption[];
  /** Callback when search changes */
  onSearchChange: (query: string) => void;
  /** Callback when filters change */
  onFiltersChange: (filters: Record<string, any>) => void;
  /** Placeholder text for search */
  searchPlaceholder?: string;
  /** Whether to show advanced filters */
  showAdvanced?: boolean;
  /** Callback to toggle advanced filters */
  onToggleAdvanced?: () => void;
  /** Saved filter presets */
  savedFilters?: Array<{ id: string; name: string; filters: Record<string, any> }>;
  /** Callback to save filter preset */
  onSaveFilter?: (name: string) => void;
  /** Callback to load filter preset */
  onLoadFilter?: (presetId: string) => void;
  /** Callback to clear all filters */
  onClearFilters?: () => void;
  /** Custom className */
  className?: string;
  /** Debounce delay for search (ms) */
  searchDebounce?: number;
}

export function SearchFilter({
  searchQuery,
  filters,
  filterOptions,
  onSearchChange,
  onFiltersChange,
  searchPlaceholder = "Search...",
  showAdvanced = false,
  onToggleAdvanced,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onClearFilters,
  className,
  searchDebounce = 300,
}: SearchFilterProps) {
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(showAdvanced);
  const [newFilterName, setNewFilterName] = React.useState('');
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const searchRef = React.useRef<HTMLDivElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearchChange(localSearchQuery);
    }, searchDebounce);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [localSearchQuery, onSearchChange, searchDebounce]);

  // Sync with props
  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(event.target.value);
  };

  const handleFilterChange = (filterId: string, value: any) => {
    const newFilters = { ...filters };
    
    if (value === '' || value === null || value === undefined) {
      delete newFilters[filterId];
    } else {
      newFilters[filterId] = value;
    }
    
    onFiltersChange(newFilters);
  };

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    onSearchChange('');
  };

  const handleClearFilters = () => {
    onFiltersChange({});
    onClearFilters?.();
  };

  const handleSaveFilter = () => {
    if (newFilterName.trim() && onSaveFilter) {
      onSaveFilter(newFilterName.trim());
      setNewFilterName('');
      setShowSaveDialog(false);
    }
  };

  const toggleAdvanced = () => {
    const newState = !isAdvancedOpen;
    setIsAdvancedOpen(newState);
    onToggleAdvanced?.();
  };

  const hasActiveFilters = Object.keys(filters).length > 0;
  const hasActiveSearch = localSearchQuery.trim().length > 0;

  return (
    <div ref={searchRef} className={cn("space-y-4", className)} role="search" aria-label="Search and filter controls">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={localSearchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-10 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-label="Search input"
          />
          {hasActiveSearch && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          onClick={toggleAdvanced}
          variant="secondary"
          className={cn(
            "gap-2",
            hasActiveFilters && "border-primary-500 text-primary-600 bg-primary-50"
          )}
          aria-expanded={isAdvancedOpen}
          aria-controls="advanced-filters"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
              {Object.keys(filters).length}
            </span>
          )}
          <ChevronDown 
            className={cn("h-4 w-4 transition-transform", isAdvancedOpen && "rotate-180")}
          />
        </Button>
      </div>

      {/* Advanced Filters */}
      {isAdvancedOpen && (
        <Card id="advanced-filters">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Filter Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterOptions.map((option) => (
                  <FilterField
                    key={option.id}
                    option={option}
                    value={filters[option.id]}
                    onChange={(value) => handleFilterChange(option.id, value)}
                  />
                ))}
              </div>

              {/* Filter Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <div className="flex gap-2">
                  {hasActiveFilters && (
                    <Button
                      onClick={handleClearFilters}
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Clear Filters
                    </Button>
                  )}

                  {onSaveFilter && hasActiveFilters && (
                    <Button
                      onClick={() => setShowSaveDialog(true)}
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Filter
                    </Button>
                  )}
                </div>

                {/* Saved Filters */}
                {savedFilters.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">Saved:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value && onLoadFilter) {
                          onLoadFilter(e.target.value);
                        }
                      }}
                      className="text-sm border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      aria-label="Load saved filter"
                    >
                      <option value="">Select saved filter...</option>
                      {savedFilters.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-3">
            <h4 className="font-medium text-blue-900">Save Current Filters</h4>
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="Enter filter name..."
              className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter name"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveFilter}
                disabled={!newFilterName.trim()}
                size="sm"
              >
                Save
              </Button>
              <Button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewFilterName('');
                }}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Individual filter field component
 */
interface FilterFieldProps {
  option: FilterOption;
  value: any;
  onChange: (value: any) => void;
}

function FilterField({ option, value, onChange }: FilterFieldProps) {
  const elementRef = React.useRef<HTMLDivElement>(null);

  switch (option.type) {
    case 'text':
      return (
        <div ref={elementRef} aria-label={`Filter by ${option.label}`}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {option.label}
          </label>
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={option.placeholder}
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      );

    case 'select':
      return (
        <div ref={elementRef} aria-label={`Filter by ${option.label}`}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {option.label}
          </label>
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            {option.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'multiselect':
      return (
        <div ref={elementRef} aria-label={`Filter by ${option.label}`}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {option.label}
          </label>
          <select
            multiple
            value={Array.isArray(value) ? value : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              onChange(selected.length > 0 ? selected : undefined);
            }}
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            size={4}
          >
            {option.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'date':
      return (
        <div ref={elementRef} aria-label={`Filter by ${option.label}`}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {option.label}
          </label>
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      );

    case 'number':
      return (
        <div ref={elementRef} aria-label={`Filter by ${option.label}`}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {option.label}
          </label>
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={option.placeholder}
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      );

    case 'boolean':
      return (
        <div ref={elementRef} aria-label={`Filter by ${option.label}`}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-neutral-700">
              {option.label}
            </span>
          </label>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Hook for managing search and filter state
 */
export function useSearchFilter<T extends Record<string, any>>(
  initialSearch: string = '',
  initialFilters: T = {} as T
) {
  const [searchQuery, setSearchQuery] = React.useState(initialSearch);
  const [filters, setFilters] = React.useState<T>(initialFilters);
  const [savedFilters, setSavedFilters] = React.useState<Array<{
    id: string;
    name: string;
    filters: T;
  }>>([]);

  const clearAll = React.useCallback(() => {
    setSearchQuery('');
    setFilters({} as T);
  }, []);

  const saveFilter = React.useCallback((name: string) => {
    const newFilter = {
      id: Date.now().toString(),
      name,
      filters: { ...filters }
    };
    setSavedFilters(prev => [...prev, newFilter]);
  }, [filters]);

  const loadFilter = React.useCallback((presetId: string) => {
    const preset = savedFilters.find(f => f.id === presetId);
    if (preset) {
      setFilters(preset.filters);
    }
  }, [savedFilters]);

  const deleteFilter = React.useCallback((presetId: string) => {
    setSavedFilters(prev => prev.filter(f => f.id !== presetId));
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    savedFilters,
    clearAll,
    saveFilter,
    loadFilter,
    deleteFilter
  };
}