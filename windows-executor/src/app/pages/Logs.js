import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useLogsStore } from '../../stores/logs.store';
import { useAppStore } from '../../stores/app.store';
import { StatusIndicator } from '../../components/StatusIndicator';
export function Logs() {
    const { logs, logLevels, setLogLevels, autoScroll, setAutoScroll, maxLogs, setMaxLogs, exportLogs, clearLogs } = useLogsStore();
    const { addLog } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const logContainerRef = useRef(null);
    // Get unique categories from logs
    const categories = ['all', ...Array.from(new Set(logs.map(log => log.category || 'uncategorized').filter(Boolean)))];
    // Filter logs based on search term, log levels, and category
    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchTerm === '' ||
            log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.category && log.category.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesLevel = logLevels[log.level] === true;
        const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
        return matchesSearch && matchesLevel && matchesCategory;
    });
    // Auto-scroll to bottom when new logs are added
    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);
    const handleScroll = () => {
        if (logContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
            setAutoScroll(isAtBottom);
        }
    };
    const handleLogLevelToggle = (level) => {
        setLogLevels({
            ...logLevels,
            [level]: !logLevels[level]
        });
    };
    const handleClearLogs = () => {
        clearLogs();
        addLog({
            level: 'info',
            message: 'Logs cleared by user',
            category: 'LOGS',
        });
    };
    const handleExportLogs = () => {
        const logData = exportLogs();
        const blob = new Blob([logData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fx-executor-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog({
            level: 'info',
            message: 'Logs exported',
            category: 'LOGS',
        });
    };
    const getLogLevelColor = (level) => {
        switch (level) {
            case 'debug': return 'text-gray-600';
            case 'info': return 'text-blue-600';
            case 'warn': return 'text-yellow-600';
            case 'error': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };
    const getLogLevelBgColor = (level) => {
        switch (level) {
            case 'debug': return 'bg-gray-100';
            case 'info': return 'bg-blue-100';
            case 'warn': return 'bg-yellow-100';
            case 'error': return 'bg-red-100';
            default: return 'bg-gray-100';
        }
    };
    const formatTime = (date) => {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };
    const formatDate = (date) => {
        return date.toLocaleDateString();
    };
    return (_jsx("div", { className: "flex-1 overflow-auto bg-gray-50 p-6", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Logs" }), _jsx("p", { className: "text-sm text-gray-600", children: "View and filter application logs." })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "text-sm text-gray-500", children: ["Showing ", filteredLogs.length, " of ", logs.length, " logs"] }), _jsx("button", { onClick: () => setAutoScroll(!autoScroll), className: `text-xs px-3 py-1 rounded-md ${autoScroll
                                        ? 'bg-primary-100 text-primary-800'
                                        : 'bg-gray-100 text-gray-800'}`, children: autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off' }), _jsx("button", { onClick: handleExportLogs, className: "btn btn-secondary text-sm", children: "Export" }), _jsx("button", { onClick: handleClearLogs, className: "btn btn-danger text-sm", children: "Clear" })] })] }), _jsxs("div", { className: "card p-4 mb-6", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsx("div", { className: "flex-1 min-w-64", children: _jsx("input", { type: "text", placeholder: "Search logs...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "input w-full" }) }), _jsx("div", { children: _jsx("select", { value: selectedCategory, onChange: (e) => setSelectedCategory(e.target.value), className: "input", children: categories.map(category => (_jsx("option", { value: category, children: category === 'all' ? 'All Categories' : category }, category))) }) }), _jsx("div", { children: _jsxs("button", { onClick: () => setIsFilterOpen(!isFilterOpen), className: "btn btn-secondary text-sm flex items-center space-x-2", children: [_jsx("span", { children: "Log Levels" }), _jsx("svg", { className: `w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })] }) }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("label", { htmlFor: "maxLogs", className: "text-sm text-gray-600", children: "Max Logs:" }), _jsx("input", { id: "maxLogs", type: "number", min: "100", max: "10000", step: "100", value: maxLogs, onChange: (e) => setMaxLogs(parseInt(e.target.value)), className: "input w-20" })] })] }), isFilterOpen && (_jsx("div", { className: "mt-4 pt-4 border-t border-gray-200", children: _jsx("div", { className: "flex flex-wrap gap-2", children: ['debug', 'info', 'warn', 'error'].map(level => (_jsx("button", { onClick: () => handleLogLevelToggle(level), className: `px-3 py-1 rounded-md text-sm font-medium transition-colors ${logLevels[level]
                                        ? `${getLogLevelBgColor(level)} ${getLogLevelColor(level)}`
                                        : 'bg-gray-100 text-gray-600'}`, children: level.toUpperCase() }, level))) }) }))] }), _jsx("div", { className: "card p-0 overflow-hidden", children: _jsx("div", { ref: logContainerRef, className: "overflow-y-auto custom-scrollbar bg-gray-900 text-gray-100 font-mono text-sm", style: { height: 'calc(100vh - 300px)' }, onScroll: handleScroll, children: filteredLogs.length > 0 ? (_jsx("div", { className: "divide-y divide-gray-800", children: filteredLogs.map((log) => (_jsx("div", { className: "px-4 py-2 hover:bg-gray-800 transition-colors", children: _jsxs("div", { className: "flex items-start space-x-3", children: [_jsxs("div", { className: "flex-shrink-0 text-xs text-gray-500 whitespace-nowrap", children: [_jsx("div", { children: formatDate(log.timestamp) }), _jsx("div", { children: formatTime(log.timestamp) })] }), _jsx("div", { className: "flex-shrink-0", children: _jsx("span", { className: `px-2 py-1 text-xs font-medium rounded ${getLogLevelBgColor(log.level)} ${getLogLevelColor(log.level)}`, children: log.level.toUpperCase() }) }), log.category && (_jsx("div", { className: "flex-shrink-0", children: _jsx("span", { className: "px-2 py-1 text-xs font-medium rounded bg-gray-700 text-gray-300", children: log.category }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-gray-100 break-words", children: log.message }), log.metadata && (_jsxs("details", { className: "mt-1", children: [_jsx("summary", { className: "text-xs text-gray-500 cursor-pointer hover:text-gray-400", children: "Metadata" }), _jsx("pre", { className: "mt-1 text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto", children: JSON.stringify(log.metadata, null, 2) })] }))] })] }) }, log.id))) })) : (_jsx("div", { className: "flex items-center justify-center h-64 text-gray-500", children: _jsxs("div", { className: "text-center", children: [_jsx(StatusIndicator, { status: "offline" }), _jsx("p", { className: "mt-2", children: "No logs to display" }), _jsx("p", { className: "text-xs mt-1", children: logs.length === 0
                                            ? 'Logs will appear here as the application runs'
                                            : 'Try adjusting your filters' })] }) })) }) })] }) }));
}
