import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function StatusIndicator({ status, size = 'md', showLabel = false, label, className = '' }) {
    const sizeClasses = {
        sm: 'h-2 w-2',
        md: 'h-3 w-3',
        lg: 'h-4 w-4'
    };
    const statusClasses = {
        online: 'bg-success-500',
        offline: 'bg-gray-400',
        warning: 'bg-warning-500',
        error: 'bg-danger-500'
    };
    const statusLabels = {
        online: 'Online',
        offline: 'Offline',
        warning: 'Warning',
        error: 'Error'
    };
    const displayLabel = label || statusLabels[status];
    return (_jsxs("div", { className: `flex items-center space-x-2 ${className}`, children: [_jsx("div", { className: `
        ${sizeClasses[size]} 
        ${statusClasses[status]} 
        rounded-full
        ${status === 'online' ? 'pulse-ring-success' : ''}
      ` }), showLabel && (_jsx("span", { className: "text-xs text-gray-600", children: displayLabel }))] }));
}
