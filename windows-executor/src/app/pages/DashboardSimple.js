import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Simple Dashboard for Windows Executor
 * Focused on essential information only
 * Full dashboard is on web platform
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/app.store';
import { StatusIndicator } from '../../components/StatusIndicator';
import { RefreshCcw, Activity, TrendingUp, AlertCircle, CheckCircle, XCircle, Zap } from 'lucide-react';
export function DashboardSimple() {
    const { connectionStatus, config, isConfigured, performanceMetrics, recentActivity } = useAppStore();
    const [accountInfo, setAccountInfo] = useState(null);
    const [systemHealth, setSystemHealth] = useState(null);
    const [recentSignals, setRecentSignals] = useState([]);
    const [activeStrategies, setActiveStrategies] = useState([]);
    const [eaAttachments, setEaAttachments] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    // Load data
    useEffect(() => {
        loadDashboardData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            loadDashboardData();
        }, 30000);
        return () => clearInterval(interval);
    }, []);
    const loadDashboardData = async () => {
        console.log('[Dashboard] 🔄 Loading dashboard data...');
        try {
            // Get MT5 account info
            const account = await window.electronAPI?.getMT5AccountInfo?.();
            if (account) {
                setAccountInfo(account);
            }
            // Get system health
            const health = await window.electronAPI?.getSystemHealth?.();
            if (health) {
                setSystemHealth(health);
            }
            // Get recent signals
            const signals = await window.electronAPI?.getRecentSignals?.(10);
            if (signals) {
                setRecentSignals(signals);
            }
            // Get active strategies
            const strategies = await window.electronAPI?.getActiveStrategies?.();
            if (strategies) {
                setActiveStrategies(strategies);
            }
            // Get EA attachments
            const attachments = await window.electronAPI?.getEAAttachments?.();
            if (attachments) {
                console.log('[Dashboard] EA Attachments loaded:', attachments);
                setEaAttachments(attachments);
            }
            else {
                console.log('[Dashboard] No EA attachments found');
            }
            setLastUpdate(new Date());
        }
        catch (error) {
            console.error('[Dashboard] Failed to load data:', error);
        }
    };
    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDashboardData();
        setTimeout(() => setRefreshing(false), 500);
    };
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const isEAAttached = (strategy) => {
        if (!strategy.symbols || strategy.symbols.length === 0) {
            console.log('[EA Check] Strategy has no symbols:', strategy.name);
            return false;
        }
        const timeframe = strategy.timeframe || 'M15';
        // Check if ANY of the strategy's symbols has EA attached
        const hasAttachment = strategy.symbols.some((symbol) => {
            const attached = eaAttachments.some((att) => att.symbol === symbol && att.timeframe === timeframe);
            if (attached) {
                console.log(`[EA Check] ✅ Found attachment for ${symbol} ${timeframe}`);
            }
            return attached;
        });
        if (!hasAttachment) {
            console.log(`[EA Check] ❌ No attachment found for ${strategy.name}`, {
                symbols: strategy.symbols,
                timeframe,
                availableAttachments: eaAttachments
            });
        }
        return hasAttachment;
    };
    const handleNotifyEAAttached = async (strategy) => {
        try {
            if (!strategy.symbols || strategy.symbols.length === 0) {
                alert('Strategy has no symbols defined');
                return;
            }
            // If multiple symbols, let user choose
            let symbol = strategy.symbols[0];
            if (strategy.symbols.length > 1) {
                const choice = prompt(`This strategy has multiple symbols: ${strategy.symbols.join(', ')}\n\nWhich symbol did you attach EA to?`, strategy.symbols[0]);
                if (!choice)
                    return;
                symbol = choice.toUpperCase().trim();
            }
            const timeframe = strategy.timeframe || 'M15';
            // Get account number from account info or prompt
            let accountNumber = accountInfo?.accountNumber || '';
            if (!accountNumber) {
                accountNumber = prompt('Enter MT5 Account Number:') || '';
                if (!accountNumber)
                    return;
            }
            console.log('[EA Attach] Notifying EA attached:', { symbol, timeframe, accountNumber });
            await window.electronAPI?.notifyEAAttached?.({
                symbol,
                timeframe,
                accountNumber,
            });
            // Reload attachments
            await loadDashboardData();
            console.log('[EA Attach] ✅ EA marked as attached successfully');
            alert(`✅ EA marked as attached for ${strategy.name} (${symbol} ${timeframe})`);
        }
        catch (error) {
            console.error('[EA Attach] ❌ Failed to notify EA attached:', error);
            alert('Failed to mark EA as attached');
        }
    };
    const handleNotifyEADetached = async (strategy) => {
        try {
            if (!strategy.symbols || strategy.symbols.length === 0) {
                alert('Strategy has no symbols defined');
                return;
            }
            // Find which symbol has EA attached
            const timeframe = strategy.timeframe || 'M15';
            const attachedSymbols = strategy.symbols.filter((sym) => eaAttachments.some((att) => att.symbol === sym && att.timeframe === timeframe));
            // If multiple symbols attached, let user choose
            let symbol = attachedSymbols[0] || strategy.symbols[0];
            if (attachedSymbols.length > 1) {
                const choice = prompt(`EAs attached to: ${attachedSymbols.join(', ')}\n\nWhich one do you want to detach?`, attachedSymbols[0]);
                if (!choice)
                    return;
                symbol = choice.toUpperCase().trim();
            }
            // Get account number from account info
            let accountNumber = accountInfo?.accountNumber || '';
            if (!accountNumber) {
                accountNumber = prompt('Enter MT5 Account Number:') || '';
                if (!accountNumber)
                    return;
            }
            console.log('[EA Detach] Notifying EA detached:', { symbol, timeframe, accountNumber });
            await window.electronAPI?.notifyEADetached?.({
                symbol,
                timeframe,
                accountNumber,
            });
            // Reload attachments
            await loadDashboardData();
            console.log('[EA Detach] ✅ EA marked as detached successfully');
            alert(`✅ EA marked as detached for ${strategy.name} (${symbol} ${timeframe})`);
        }
        catch (error) {
            console.error('[EA Detach] ❌ Failed to notify EA detached:', error);
            alert('Failed to mark EA as detached');
        }
    };
    return (_jsx("div", { className: "h-full overflow-auto bg-gray-50 p-6", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Windows Executor" }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Monitoring \u2022 Last updated: ", formatTime(lastUpdate)] })] }), _jsxs("button", { onClick: handleRefresh, disabled: refreshing, className: "inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50", children: [_jsx(RefreshCcw, { className: `h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}` }), "Refresh"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-600", children: "Web Platform" }), _jsx(StatusIndicator, { status: connectionStatus.pusher === 'connected' ? 'online' : 'offline', size: "sm" })] }), _jsx("div", { className: "text-xs text-gray-500", children: connectionStatus.pusher === 'connected' ? 'Connected' : 'Disconnected' })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-600", children: "MT5 Terminal" }), _jsx(StatusIndicator, { status: connectionStatus.mt5 === 'connected' ? 'online' : 'offline', size: "sm" })] }), _jsx("div", { className: "text-xs text-gray-500", children: connectionStatus.mt5 === 'connected' ? 'Connected' : 'Disconnected' })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsx("div", { className: "text-sm font-medium text-gray-600 mb-1", children: "Balance" }), _jsx("div", { className: "text-lg font-bold text-gray-900", children: accountInfo ? formatCurrency(accountInfo.balance) : '---' }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Equity: ", accountInfo ? formatCurrency(accountInfo.equity) : '---'] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsx("div", { className: "text-sm font-medium text-gray-600 mb-1", children: "Positions" }), _jsx("div", { className: "text-lg font-bold text-gray-900", children: accountInfo?.openPositions || 0 }), _jsx("div", { className: "text-xs text-gray-500", children: "Active now" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 space-y-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsxs("div", { className: "px-4 py-3 border-b border-gray-200 flex items-center justify-between", children: [_jsxs("h2", { className: "text-sm font-semibold text-gray-900 flex items-center", children: [_jsx(Activity, { className: "h-4 w-4 mr-2 text-blue-500" }), "Active Strategies"] }), _jsxs("span", { className: "text-xs text-gray-500", children: [activeStrategies.length, " running"] })] }), _jsx("div", { className: "p-4", children: activeStrategies.length > 0 ? (_jsx("div", { className: "space-y-3", children: activeStrategies.slice(0, 5).map((strategy) => {
                                                    const eaAttached = isEAAttached(strategy);
                                                    console.log(`[Render] Strategy: ${strategy.name}, EA Attached: ${eaAttached}`, {
                                                        symbols: strategy.symbols,
                                                        timeframe: strategy.timeframe,
                                                    });
                                                    return (_jsxs("div", { className: "border border-gray-200 rounded-lg p-3 bg-white hover:shadow-md transition", children: [_jsx("div", { className: "flex items-start justify-between mb-2", children: _jsxs("div", { className: "flex items-center space-x-3 flex-1", children: [_jsx(StatusIndicator, { status: strategy.status === 'active' ? 'online' : 'warning', size: "sm" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "text-sm font-medium text-gray-900 flex items-center gap-2", children: [strategy.name, eaAttached && (_jsxs("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800", children: [_jsx(Zap, { className: "h-3 w-3 mr-1" }), "EA Attached"] }))] }), _jsxs("div", { className: "text-xs text-gray-500 mt-0.5", children: [strategy.symbols?.slice(0, 3).join(', ') || 'No symbols', strategy.symbols?.length > 3 && ` +${strategy.symbols.length - 3}`, _jsx("span", { className: "mx-1", children: "\u2022" }), strategy.timeframe || 'M15'] })] })] }) }), _jsx("div", { className: "flex gap-2 mt-2 pt-2 border-t border-gray-100", children: !eaAttached ? (_jsxs("button", { onClick: () => handleNotifyEAAttached(strategy), className: "flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition text-xs font-medium", children: [_jsx(CheckCircle, { className: "h-3.5 w-3.5 mr-1.5" }), "Mark EA Attached"] })) : (_jsxs("button", { onClick: () => handleNotifyEADetached(strategy), className: "flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition text-xs font-medium", children: [_jsx(XCircle, { className: "h-3.5 w-3.5 mr-1.5" }), "Mark EA Detached"] })) })] }, strategy.id));
                                                }) })) : (_jsxs("div", { className: "text-center py-8 text-gray-400", children: [_jsx(Activity, { className: "h-8 w-8 mx-auto mb-2 opacity-50" }), _jsx("p", { className: "text-sm", children: "No active strategies" })] })) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsxs("div", { className: "px-4 py-3 border-b border-gray-200 flex items-center justify-between", children: [_jsxs("h2", { className: "text-sm font-semibold text-gray-900 flex items-center", children: [_jsx(TrendingUp, { className: "h-4 w-4 mr-2 text-green-500" }), "Recent Signals"] }), _jsx("span", { className: "text-xs text-gray-500", children: "Last 10" })] }), _jsx("div", { className: "p-4", children: recentSignals.length > 0 ? (_jsx("div", { className: "space-y-2", children: recentSignals.slice(0, 10).map((signal, idx) => (_jsxs("div", { className: "flex items-center justify-between p-2 border-b border-gray-100 last:border-0", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: `px-2 py-1 text-xs font-bold rounded ${signal.type === 'BUY'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-red-100 text-red-700'}`, children: signal.type }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: signal.symbol }), _jsxs("div", { className: "text-xs text-gray-500", children: ["@ ", signal.price?.toFixed(5)] })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-xs text-gray-600", children: formatTime(signal.timestamp) }), _jsxs("div", { className: "text-xs text-gray-500", children: [signal.confidence, "% conf"] })] })] }, idx))) })) : (_jsxs("div", { className: "text-center py-8 text-gray-400", children: [_jsx(TrendingUp, { className: "h-8 w-8 mx-auto mb-2 opacity-50" }), _jsx("p", { className: "text-sm", children: "No recent signals" })] })) })] })] }), _jsxs("div", { className: "lg:col-span-1 space-y-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsx("div", { className: "px-4 py-3 border-b border-gray-200", children: _jsx("h2", { className: "text-sm font-semibold text-gray-900", children: "Performance" }) }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Today P&L" }), _jsxs("span", { className: `text-sm font-bold ${performanceMetrics.dailyPnL >= 0
                                                                ? 'text-green-600'
                                                                : 'text-red-600'}`, children: [performanceMetrics.dailyPnL >= 0 ? '+' : '', formatCurrency(performanceMetrics.dailyPnL)] })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Win Rate" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [performanceMetrics.winRate.toFixed(1), "%"] })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Total Trades" }), _jsx("span", { className: "text-sm font-medium text-gray-900", children: performanceMetrics.totalTrades })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Profit Factor" }), _jsx("span", { className: "text-sm font-medium text-gray-900", children: performanceMetrics.profitFactor.toFixed(2) })] }), _jsx("div", { className: "pt-3 border-t border-gray-200", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Margin Level" }), _jsxs("span", { className: `text-sm font-bold ${(accountInfo?.marginLevel || 0) > 200
                                                                    ? 'text-green-600'
                                                                    : (accountInfo?.marginLevel || 0) > 100
                                                                        ? 'text-yellow-600'
                                                                        : 'text-red-600'}`, children: [accountInfo?.marginLevel?.toFixed(0) || 0, "%"] })] }) })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsxs("div", { className: "px-4 py-3 border-b border-gray-200 flex items-center justify-between", children: [_jsxs("h2", { className: "text-sm font-semibold text-gray-900 flex items-center", children: [_jsx(AlertCircle, { className: "h-4 w-4 mr-2 text-blue-500" }), "System Health"] }), _jsx(StatusIndicator, { status: systemHealth?.healthy ? 'online' : 'warning', size: "sm" })] }), _jsxs("div", { className: "p-4 space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Evaluations/min" }), _jsx("span", { className: "text-sm font-medium text-gray-900", children: systemHealth?.evaluationsPerMinute?.toFixed(1) || '0.0' })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Avg Response" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [systemHealth?.avgEvaluationTime?.toFixed(0) || '0', "ms"] })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Cache Hit Rate" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [systemHealth?.cacheHitRate?.toFixed(0) || '0', "%"] })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Memory Usage" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [systemHealth?.memoryUsage?.toFixed(0) || '0', "MB"] })] }), systemHealth?.issues && systemHealth.issues.length > 0 && (_jsx("div", { className: "pt-3 border-t border-gray-200", children: _jsx("div", { className: "space-y-1", children: systemHealth.issues.map((issue, idx) => (_jsxs("div", { className: "flex items-start text-xs text-yellow-700", children: [_jsx(AlertCircle, { className: "h-3 w-3 mr-1 mt-0.5 flex-shrink-0" }), _jsx("span", { children: issue })] }, idx))) }) }))] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsx("div", { className: "px-4 py-3 border-b border-gray-200", children: _jsx("h2", { className: "text-sm font-semibold text-gray-900", children: "Recent Activity" }) }), _jsx("div", { className: "p-4", children: recentActivity.length > 0 ? (_jsx("div", { className: "space-y-2 max-h-64 overflow-y-auto", children: recentActivity.slice(0, 10).map((activity) => (_jsx("div", { className: "text-xs", children: _jsxs("div", { className: "flex items-start space-x-2", children: [_jsx("span", { className: `inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 ${activity.type === 'ERROR' ? 'bg-red-500' :
                                                                    activity.type === 'INFO' ? 'bg-blue-500' :
                                                                        'bg-green-500'}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-gray-700 truncate", children: activity.message }), _jsx("p", { className: "text-gray-400", children: formatTime(activity.timestamp) })] })] }) }, activity.id))) })) : (_jsx("div", { className: "text-center py-4 text-gray-400", children: _jsx("p", { className: "text-sm", children: "No recent activity" }) })) })] })] })] }), _jsx("div", { className: "mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg", children: _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { className: "flex items-center space-x-4 text-gray-600", children: [_jsxs("span", { children: ["Executor ID: ", _jsx("span", { className: "font-mono text-gray-900", children: config?.executorId || 'N/A' })] }), _jsx("span", { className: "text-gray-300", children: "|" }), _jsxs("span", { children: ["Platform: ", _jsx("span", { className: "font-medium text-gray-900", children: config?.platformUrl || 'N/A' })] })] }), _jsxs("div", { className: "text-gray-600", children: [_jsx("span", { className: "text-blue-600 font-medium", children: "Full Dashboard" }), " available on web platform"] })] }) })] }) }));
}
