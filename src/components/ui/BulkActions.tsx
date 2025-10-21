'use client';

import { useState, useCallback } from 'react';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Download, 
  Archive, 
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export interface BulkActionItem {
  id: string;
  selected: boolean;
  [key: string]: any;
}

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  disabled?: boolean;
  onClick: (selectedItems: BulkActionItem[]) => Promise<void> | void;
}

interface BulkActionsProps<T extends BulkActionItem> {
  items: T[];
  selectedItems: T[];
  actions: BulkAction[];
  onSelectionChange: (selectedItems: T[]) => void;
  onItemsChange: (items: T[]) => void;
  selectionKey?: string;
  disabled?: boolean;
}

export function BulkActions<T extends BulkActionItem>({
  items,
  selectedItems,
  actions,
  onSelectionChange,
  onItemsChange,
  selectionKey = 'id',
  disabled = false,
}: BulkActionsProps<T>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    action?: BulkAction;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const handleSelectAll = useCallback(() => {
    if (selectedItems.length === items.length) {
      // Deselect all
      const updatedItems = items.map(item => ({ ...item, selected: false }));
      onItemsChange(updatedItems);
      onSelectionChange([]);
    } else {
      // Select all
      const updatedItems = items.map(item => ({ ...item, selected: true }));
      onItemsChange(updatedItems);
      onSelectionChange(updatedItems);
    }
  }, [items, selectedItems, onItemsChange, onSelectionChange]);

  const handleSelectItem = useCallback((item: T) => {
    const updatedItems = items.map(i => 
      i[selectionKey] === item[selectionKey] 
        ? { ...i, selected: !i.selected }
        : i
    );
    
    const newSelectedItems = updatedItems.filter(i => i.selected);
    onItemsChange(updatedItems);
    onSelectionChange(newSelectedItems);
  }, [items, selectionKey, onItemsChange, onSelectionChange]);

  const handleActionClick = useCallback(async (action: BulkAction) => {
    if (action.danger) {
      setConfirmDialog({
        open: true,
        title: `Confirm ${action.label}`,
        description: `Are you sure you want to ${action.label.toLowerCase()} ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}? This action cannot be undone.`,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, open: false }));
          setIsProcessing(true);
          try {
            await action.onClick(selectedItems);
            // Clear selection after successful action
            const updatedItems = items.map(item => ({ ...item, selected: false }));
            onItemsChange(updatedItems);
            onSelectionChange([]);
          } catch (error) {
            console.error('Bulk action failed:', error);
          } finally {
            setIsProcessing(false);
          }
        },
        action,
      });
    } else {
      setIsProcessing(true);
      try {
        await action.onClick(selectedItems);
        // Clear selection after successful action
        const updatedItems = items.map(item => ({ ...item, selected: false }));
        onItemsChange(updatedItems);
        onSelectionChange([]);
      } catch (error) {
        console.error('Bulk action failed:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [selectedItems, items, onItemsChange, onSelectionChange]);

  const isAllSelected = items.length > 0 && selectedItems.length === items.length;
  const isPartiallySelected = selectedItems.length > 0 && selectedItems.length < items.length;

  if (disabled) return null;

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedItems.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-primary border border-primary rounded-lg mb-4 theme-transition">
          <div className="flex items-center gap-4">
            {/* Selection Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="p-1 rounded hover:bg-secondary transition-colors"
                aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
              >
                {isAllSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary-600" />
                ) : isPartiallySelected ? (
                  <div className="h-5 w-5 rounded border-2 border-primary-600 bg-primary-600 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {selectedItems.length}
                    </span>
                  </div>
                ) : (
                  <Square className="h-5 w-5 text-secondary" />
                )}
              </button>
              <span className="text-sm font-medium text-primary">
                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {actions.map((action) => {
                const Icon = action.icon;
                const isDisabled = isProcessing || action.disabled;
                
                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    disabled={isDisabled}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      action.danger
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50'
                        : 'text-primary hover:bg-secondary disabled:opacity-50'
                    }`}
                    aria-label={`${action.label} selected items`}
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-tertiary">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              Processing...
            </div>
          )}
        </div>
      )}

      {/* Selection Checkboxes for each item */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item[selectionKey]}
            className={`flex items-center gap-3 p-3 border border-secondary rounded-lg hover:bg-secondary transition-colors ${
              item.selected ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-600' : ''
            }`}
          >
            <button
              onClick={() => handleSelectItem(item)}
              className="flex-shrink-0"
              aria-label={`Select item ${item[selectionKey]}`}
            >
              {item.selected ? (
                <CheckSquare className="h-5 w-5 text-primary-600" />
              ) : (
                <Square className="h-5 w-5 text-secondary" />
              )}
            </button>
            
            {/* Item content will be rendered by parent component */}
            <div className="flex-1">
              {/* This is a placeholder for item content */}
              {/* Parent component should render the actual item content */}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.action?.danger ? 'danger' : 'info'}
      />
    </>
  );
}

// Default bulk actions
export const defaultBulkActions: BulkAction[] = [
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    danger: true,
    onClick: async (items) => {
      // Implementation will be provided by parent component
      console.log('Deleting items:', items);
    },
  },
  {
    id: 'export',
    label: 'Export',
    icon: Download,
    onClick: async (items) => {
      // Implementation will be provided by parent component
      console.log('Exporting items:', items);
    },
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    onClick: async (items) => {
      // Implementation will be provided by parent component
      console.log('Archiving items:', items);
    },
  },
];

// Progress tracking for bulk operations
export interface BulkOperationProgress {
  total: number;
  completed: number;
  failed: number;
  currentOperation: string;
}

export function BulkOperationProgress({ progress }: { progress: BulkOperationProgress }) {
  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
  
  return (
    <div className="p-4 bg-primary border border-primary rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-primary">{progress.currentOperation}</h3>
        <span className="text-sm text-tertiary">
          {progress.completed} / {progress.total}
        </span>
      </div>
      
      <div className="w-full bg-secondary rounded-full h-2 mb-2">
        <div 
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex items-center gap-4 text-xs text-tertiary">
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-600" />
          <span>{progress.completed} completed</span>
        </div>
        {progress.failed > 0 && (
          <div className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600" />
            <span>{progress.failed} failed</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Undo functionality for bulk actions
export interface BulkActionHistory {
  id: string;
  action: string;
  items: any[];
  timestamp: Date;
  undo: () => Promise<void>;
}

export function BulkActionUndo({ 
  history, 
  onUndo 
}: { 
  history: BulkActionHistory[];
  onUndo: (historyItem: BulkActionHistory) => void;
}) {
  if (history.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="bg-primary border border-primary rounded-lg shadow-lg p-3 max-w-sm">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-medium text-primary">Recent Actions</span>
        </div>
        
        <div className="space-y-2">
          {history.slice(-3).map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="text-xs text-tertiary">
                {item.action} ({item.items.length} items)
              </span>
              <button
                onClick={() => onUndo(item)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}