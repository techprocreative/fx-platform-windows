import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast = ({ toast, onDismiss }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colors = {
    success: { bg: '#22c55e', icon: '✅' },
    error: { bg: '#ef4444', icon: '❌' },
    warning: { bg: '#f97316', icon: '⚠️' },
    info: { bg: '#3b82f6', icon: 'ℹ️' },
  };

  const color = colors[toast.type];

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '0.75rem',
        padding: '1rem',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.5)',
        minWidth: '320px',
        maxWidth: '420px',
        borderLeft: `4px solid ${color.bg}`,
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{color.icon}</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: color.bg }}>{toast.title}</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#cbd5e1' }}>{toast.message}</p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer = ({ toasts, onDismiss }: ToastContainerProps) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage['type'], title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return {
    toasts,
    addToast,
    dismissToast,
    success: (title: string, message: string) => addToast('success', title, message),
    error: (title: string, message: string) => addToast('error', title, message),
    warning: (title: string, message: string) => addToast('warning', title, message),
    info: (title: string, message: string) => addToast('info', title, message),
  };
}
