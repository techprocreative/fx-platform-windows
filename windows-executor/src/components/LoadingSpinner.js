import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function LoadingSpinner({ size = 'md', className = '', text }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    };
    return (_jsxs("div", { className: `flex flex-col items-center justify-center ${className}`, children: [_jsx("div", { className: `${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-primary-600` }), text && (_jsx("p", { className: "mt-2 text-sm text-gray-600", children: text }))] }));
}
