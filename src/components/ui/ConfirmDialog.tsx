"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';
import { useModalFocus, useKeyboardShortcuts } from '@/hooks/useKeyboardNavigation';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
  className?: string;
}

const icons = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const colors = {
  danger: {
    icon: 'text-red-600',
    border: 'border-red-200',
    bg: 'bg-red-50',
    title: 'text-red-900',
    description: 'text-red-700',
    confirm: 'danger',
  },
  warning: {
    icon: 'text-yellow-600',
    border: 'border-yellow-200',
    bg: 'bg-yellow-50',
    title: 'text-yellow-900',
    description: 'text-yellow-700',
    confirm: 'primary',
  },
  info: {
    icon: 'text-blue-600',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    title: 'text-blue-900',
    description: 'text-blue-700',
    confirm: 'primary',
  },
  success: {
    icon: 'text-green-600',
    border: 'border-green-200',
    bg: 'bg-green-50',
    title: 'text-green-900',
    description: 'text-green-700',
    confirm: 'primary',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  className,
}: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const colorScheme = colors[variant];
  const Icon = icons[variant];
  
  const { modalRef: focusRef, open, close } = useModalFocus({
    escapeDeactivates: true,
    onEscape: onClose
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'Escape': onClose,
    'Enter': () => {
      if (!isLoading) {
        onConfirm();
      }
    }
  }, { target: document });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
      open();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
      if (isOpen) {
        close();
      }
    };
  }, [isOpen, onClose, open, close]);

  // Combine refs
  const combinedRef = (element: HTMLDivElement | null) => {
    modalRef.current = element;
    (focusRef as any).current = element;
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={combinedRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        className={cn(
          "relative max-w-md w-full rounded-lg border shadow-lg",
          colorScheme.border,
          colorScheme.bg,
          className
        )}
      >
        <Card className="border-0 shadow-none">
          <CardContent className="p-6">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            {/* Icon and content */}
            <div className="flex items-start gap-4">
              <div className={cn("flex-shrink-0", colorScheme.icon)} aria-hidden="true">
                <Icon className="h-6 w-6" />
              </div>
              
              <div className="flex-1">
                <h3
                  id="dialog-title"
                  className={cn("text-lg font-semibold", colorScheme.title)}
                >
                  {title}
                </h3>
                <p
                  id="dialog-description"
                  className={cn("text-sm mt-2", colorScheme.description)}
                >
                  {description}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6" role="group" aria-label="Dialog actions">
              <Button
                onClick={onClose}
                variant="secondary"
                disabled={isLoading}
                className="flex-1"
                announcement="Dialog cancelled"
              >
                {cancelText}
              </Button>
              <Button
                onClick={onConfirm}
                variant={colorScheme.confirm as any}
                loading={isLoading}
                disabled={isLoading}
                className="flex-1"
                announcement="Dialog confirmed"
              >
                {confirmText}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Hook for using confirm dialogs
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmDialogProps['variant'];
    onConfirm?: () => void;
    onCancel?: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const confirm = ({
    title,
    description,
    confirmText,
    cancelText,
    variant = 'warning',
  }: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmDialogProps['variant'];
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        title,
        description,
        confirmText,
        cancelText,
        variant,
        onConfirm: async () => {
          setIsLoading(true);
          resolve(true);
        },
        onCancel: () => {
          resolve(false);
        },
        isLoading,
      });
    });
  };

  const handleClose = () => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    setDialog(prev => ({ ...prev, isOpen: false }));
    setIsLoading(false);
  };

  const handleConfirm = async () => {
    if (dialog.onConfirm) {
      await dialog.onConfirm();
    }
    setDialog(prev => ({ ...prev, isOpen: false }));
    setIsLoading(false);
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={dialog.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={dialog.title}
      description={dialog.description}
      confirmText={dialog.confirmText}
      cancelText={dialog.cancelText}
      variant={dialog.variant}
      isLoading={isLoading}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}

// Preset confirmation dialogs for common actions
export const confirmDelete = (itemName: string) => ({
  title: `Delete ${itemName}?`,
  description: `This action cannot be undone. The ${itemName.toLowerCase()} will be permanently deleted.`,
  confirmText: 'Delete',
  cancelText: 'Cancel',
  variant: 'danger' as const,
});

export const confirmArchive = (itemName: string) => ({
  title: `Archive ${itemName}?`,
  description: `The ${itemName.toLowerCase()} will be archived and moved to the archived section. You can restore it later if needed.`,
  confirmText: 'Archive',
  cancelText: 'Cancel',
  variant: 'warning' as const,
});

export const confirmStop = (itemName: string) => ({
  title: `Stop ${itemName}?`,
  description: `The ${itemName.toLowerCase()} will be stopped immediately. Any ongoing operations will be interrupted.`,
  confirmText: 'Stop',
  cancelText: 'Cancel',
  variant: 'warning' as const,
});

export const confirmReset = (itemName: string) => ({
  title: `Reset ${itemName}?`,
  description: `All settings and data for the ${itemName.toLowerCase()} will be reset to default values. This action cannot be undone.`,
  confirmText: 'Reset',
  cancelText: 'Cancel',
  variant: 'danger' as const,
});

export const confirmDiscard = () => ({
  title: 'Discard Changes?',
  description: 'You have unsaved changes that will be lost if you continue.',
  confirmText: 'Discard',
  cancelText: 'Keep Editing',
  variant: 'warning' as const,
});