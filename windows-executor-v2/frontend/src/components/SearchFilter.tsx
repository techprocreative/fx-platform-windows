import { useState } from 'react';

interface SearchFilterProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onFilterChange?: (filter: string) => void;
  filterOptions?: Array<{ value: string; label: string }>;
}

export const SearchFilter = ({ placeholder = 'Search...', onSearch, onFilterChange, filterOptions }: SearchFilterProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value);
    onFilterChange?.(value);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
      {/* Search Input */}
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 2.5rem',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            color: '#f1f5f9',
            fontSize: '0.875rem',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#334155';
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#64748b',
            fontSize: '1rem',
          }}
        >
          🔍
        </span>
      </div>

      {/* Filter Dropdown */}
      {filterOptions && filterOptions.length > 0 && (
        <select
          value={selectedFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            color: '#f1f5f9',
            fontSize: '0.875rem',
            cursor: 'pointer',
            outline: 'none',
            minWidth: '150px',
          }}
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Clear Button */}
      {searchQuery && (
        <button
          onClick={() => handleSearchChange('')}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#334155',
            border: '1px solid #475569',
            borderRadius: '0.5rem',
            color: '#f1f5f9',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
};
