import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PerformanceCard({ title, value, subtitle, trend = 'neutral', trendValue, className = '' }) {
    const trendColors = {
        up: 'text-success-600',
        down: 'text-danger-600',
        neutral: 'text-gray-600'
    };
    const trendIcons = {
        up: (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 7l5 5m0 0l-7 7" }) })),
        down: (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 17l5 5m0 0l-7 7" }) })),
        neutral: null
    };
    return (_jsxs("div", { className: `card p-6 ${className}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: title }), trend !== 'neutral' && (_jsxs("div", { className: "flex items-center space-x-1", children: [_jsx("span", { className: "text-xs text-gray-500", children: subtitle }), _jsxs("div", { className: `flex items-center ${trendColors[trend]}`, children: [trendIcons[trend], trendValue && (_jsx("span", { className: "text-xs ml-1", children: trendValue }))] })] }))] }), _jsxs("div", { className: "flex items-baseline", children: [_jsx("div", { className: `text-2xl font-bold text-gray-900 ${trend === 'up' ? 'text-success-600' :
                            trend === 'down' ? 'text-danger-600' :
                                'text-gray-900'}`, children: value }), subtitle && trend === 'neutral' && (_jsx("div", { className: "text-xs text-gray-500 ml-2", children: subtitle }))] })] }));
}
