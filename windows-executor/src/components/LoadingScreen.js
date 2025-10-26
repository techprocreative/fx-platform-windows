import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function LoadingScreen({ message = 'Loading...', progress }) {
    const [dots, setDots] = useState('');
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);
    return (_jsx("div", { className: "fixed inset-0 bg-gray-900 flex items-center justify-center z-50", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mb-4", children: _jsx("div", { className: "inline-block", children: _jsxs("svg", { className: "animate-spin h-12 w-12 text-blue-500", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }) }) }), _jsxs("div", { className: "text-white text-xl font-semibold mb-2", children: [message, dots] }), typeof progress === 'number' && (_jsxs("div", { className: "w-64 mx-auto", children: [_jsx("div", { className: "bg-gray-700 rounded-full h-2 overflow-hidden", children: _jsx("div", { className: "bg-blue-500 h-full transition-all duration-300", style: { width: `${progress}%` } }) }), _jsxs("div", { className: "text-gray-400 text-sm mt-2", children: [progress, "%"] })] }))] }) }));
}
