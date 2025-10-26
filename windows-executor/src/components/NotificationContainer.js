import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
export default function NotificationContainer({ notifications, onDismiss }) {
    useEffect(() => {
        notifications.forEach(notification => {
            const duration = notification.duration || 5000;
            const timer = setTimeout(() => {
                onDismiss(notification.id);
            }, duration);
            return () => clearTimeout(timer);
        });
    }, [notifications, onDismiss]);
    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return _jsx(CheckCircle, { className: "w-5 h-5 text-green-500" });
            case 'error':
                return _jsx(XCircle, { className: "w-5 h-5 text-red-500" });
            case 'warning':
                return _jsx(AlertCircle, { className: "w-5 h-5 text-yellow-500" });
            case 'info':
                return _jsx(Info, { className: "w-5 h-5 text-blue-500" });
        }
    };
    const getBgColor = (type) => {
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
    return (_jsx("div", { className: "fixed top-4 right-4 z-50 space-y-2 max-w-sm", children: notifications.map(notification => (_jsxs("div", { className: `${getBgColor(notification.type)} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in`, children: [_jsx("div", { className: "flex-shrink-0 mt-0.5", children: getIcon(notification.type) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-gray-900", children: notification.title }), _jsx("p", { className: "text-sm text-gray-600 mt-1", children: notification.message })] }), _jsx("button", { onClick: () => onDismiss(notification.id), className: "flex-shrink-0 text-gray-400 hover:text-gray-600", children: _jsx(XCircle, { className: "w-4 h-4" }) })] }, notification.id))) }));
}
