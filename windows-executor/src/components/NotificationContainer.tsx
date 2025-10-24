import { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export default function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  useEffect(() => {
    notifications.forEach(notification => {
      const duration = notification.duration || 5000;
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, duration);

      return () => clearTimeout(timer);
    });
  }, [notifications, onDismiss]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`${getBgColor(notification.type)} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {notification.message}
            </p>
          </div>
          
          <button
            onClick={() => onDismiss(notification.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
