"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showFirstLast?: boolean;
  maxVisiblePages?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showFirstLast = true,
  maxVisiblePages = 5,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: number[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let start = Math.max(1, currentPage - halfVisible);
      let end = Math.min(totalPages, start + maxVisiblePages - 1);

      // Adjust start if we're near the end
      if (end - start < maxVisiblePages - 1) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const showLeftEllipsis = visiblePages[0] > 2;
  const showRightEllipsis = visiblePages[visiblePages.length - 1] < totalPages - 1;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="text-sm text-neutral-600">
        Showing page {currentPage} of {totalPages}
      </div>
      
      <div className="flex items-center gap-1">
        {showFirstLast && (
          <Button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            variant="secondary"
            size="sm"
            className="hidden sm:flex"
          >
            First
          </Button>
        )}

        <Button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          variant="secondary"
          size="sm"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>

        {showLeftEllipsis && (
          <>
            <Button
              onClick={() => handlePageChange(1)}
              variant={currentPage === 1 ? "primary" : "secondary"}
              size="sm"
            >
              1
            </Button>
            <span className="px-2 text-neutral-400">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          </>
        )}

        {visiblePages.map((page) => (
          <Button
            key={page}
            onClick={() => handlePageChange(page)}
            variant={currentPage === page ? "primary" : "secondary"}
            size="sm"
          >
            {page}
          </Button>
        ))}

        {showRightEllipsis && (
          <>
            <span className="px-2 text-neutral-400">
              <MoreHorizontal className="h-4 w-4" />
            </span>
            <Button
              onClick={() => handlePageChange(totalPages)}
              variant={currentPage === totalPages ? "primary" : "secondary"}
              size="sm"
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          variant="secondary"
          size="sm"
        >
          <span className="sr-only">Next page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {showFirstLast && (
          <Button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            variant="secondary"
            size="sm"
            className="hidden sm:flex"
          >
            Last
          </Button>
        )}
      </div>
    </div>
  );
}

// Hook for managing pagination state
export function usePagination(initialPage = 1, initialLimit = 20) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const resetPage = () => setPage(1);
  const nextPage = () => setPage(prev => prev + 1);
  const prevPage = () => setPage(prev => Math.max(1, prev - 1));
  const goToPage = (targetPage: number) => setPage(Math.max(1, targetPage));

  return {
    page,
    limit,
    setLimit,
    setPage,
    resetPage,
    nextPage,
    prevPage,
    goToPage,
  };
}

// Enhanced pagination with total items info
interface EnhancedPaginationProps extends PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
}

export function EnhancedPagination({
  totalItems,
  itemsPerPage,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 20, 50, 100],
  ...paginationProps
}: EnhancedPaginationProps) {
  const startItem = (paginationProps.currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(paginationProps.currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="text-sm text-neutral-600">
          Showing {startItem}-{endItem} of {totalItems} items
        </div>
        
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                paginationProps.onPageChange(1); // Reset to first page
              }}
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {itemsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Pagination {...paginationProps} />
    </div>
  );
}

// Server-side pagination utilities
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function createPaginationParams(page: number, limit: number): PaginationParams {
  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)), // Cap at 100 items per page
    offset: Math.max(0, (page - 1) * limit),
  };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const pages = Math.ceil(total / params.limit);

  return {
    data,
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      pages,
      hasNext: params.page < pages,
      hasPrev: params.page > 1,
    },
  };
}