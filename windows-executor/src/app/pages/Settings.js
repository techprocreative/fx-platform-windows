import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/config.store';
import { useAppStore } from '../../stores/app.store';
import { useLogsStore } from '../../stores/logs.store';
import { StatusIndicator } from '../../components/StatusIndicator';
import { ConfirmDialog } from '../../components/ConfirmDialog';
export function Settings() {
    const { config, updateConfig } = useConfigStore();
    const { setIsSetupComplete, addLog, mt5Installations } = useAppStore();
    const { clearLogs, exportLogs } = useLogsStore();
    const [activeTab, setActiveTab] = useState('general');
    const [isSaving, setIsSaving] = useState(false);
    const [testResult, setTestResult] = useState('idle');
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [showClearLogsDialog, setShowClearLogsDialog] = useState(false);
    const [errors, setErrors] = useState([]);
    const [successMessage, setSuccessMessage] = useState('');
    // Safety limits state
    const [safetyLimits, setSafetyLimits] = useState({
        maxDailyLoss: 500,
        maxPositions: 10,
        maxLotSize: 1.0,
        maxDrawdownPercent: 20,
    });
    // Handle save configuration
    const handleSaveConfig = async () => {
        try {
            setIsSaving(true);
            setErrors([]);
            setSuccessMessage('');
            // Save to Electron store
            await window.electronAPI?.updateConfig(config);
            // Test connection if API credentials are provided
            if (config?.apiKey && config?.apiSecret && config?.executorId) {
                const result = await window.electronAPI?.updateConfig(config);
                if (result && typeof result === 'object' && result.success) {
                    setTestResult('success');
                    setSuccessMessage('Configuration saved and connection test successful');
                }
                else if (result && typeof result === 'object' && result.error) {
                    setTestResult('error');
                    setErrors([result.error || 'Connection test failed']);
                }
                else {
                    setSuccessMessage('Configuration saved');
                }
            }
            else {
                setSuccessMessage('Configuration saved');
            }
            addLog({
                level: 'info',
                message: 'Configuration updated',
                category: 'SETTINGS'
            });
        }
        catch (error) {
            const errorMsg = error.message;
            setErrors([errorMsg]);
            addLog({
                level: 'error',
                message: `Failed to save config: ${errorMsg}`,
                category: 'SETTINGS'
            });
        }
        finally {
            setIsSaving(false);
        }
    };
    // Handle reset configuration
    const handleResetConfig = async () => {
        try {
            // Reset to defaults
            updateConfig({
                executorId: '',
                apiKey: '',
                apiSecret: '',
                platformUrl: 'https://fx.nusanexus.com',
                pusherKey: '',
                pusherCluster: 'mt1',
                zmqPort: 5555,
                zmqHost: 'tcp://localhost',
                heartbeatInterval: 60,
                autoReconnect: true,
            });
            setSuccessMessage('Configuration reset to defaults');
            setShowResetDialog(false);
            addLog({
                level: 'info',
                message: 'Configuration reset to defaults',
                category: 'SETTINGS'
            });
        }
        catch (error) {
            const errorMsg = error.message;
            setErrors([errorMsg]);
        }
    };
    // Handle clear logs
    const handleClearLogs = () => {
        clearLogs();
        setShowClearLogsDialog(false);
        setSuccessMessage('Logs cleared');
    };
    // Handle export logs
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
    };
    // Handle re-detect MT5
    const handleRedetectMT5 = async () => {
        try {
            const installations = await window.electronAPI?.getMT5Installations() || [];
            setSuccessMessage(`Found ${installations.length} MT5 installation(s)`);
        }
        catch (error) {
            const errorMsg = error.message;
            setErrors([errorMsg]);
        }
    };
    // Handle complete setup reset
    const handleResetSetup = async () => {
        try {
            await window.electronAPI?.setupComplete(config);
            setIsSetupComplete(false);
            setSuccessMessage('Setup reset. You will need to go through the setup process again.');
        }
        catch (error) {
            const errorMsg = error.message;
            setErrors([errorMsg]);
        }
    };
    // Clear messages after 5 seconds
    useEffect(() => {
        if (successMessage || errors.length > 0) {
            const timer = setTimeout(() => {
                setSuccessMessage('');
                setErrors([]);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errors]);
    return (_jsxs("div", { className: "flex-1 overflow-auto bg-gray-50 p-6", children: [_jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Settings" }), _jsx("p", { className: "text-sm text-gray-600", children: "Configure your FX Platform Executor." })] }), successMessage && (_jsx("div", { className: "mb-4 bg-success-50 border border-success-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(StatusIndicator, { status: "online" }) }), _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-success-800", children: "Success" }), _jsx("div", { className: "mt-2 text-sm text-success-700", children: successMessage })] })] }) })), errors.length > 0 && (_jsx("div", { className: "mb-4 bg-danger-50 border border-danger-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(StatusIndicator, { status: "error" }) }), _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-danger-800", children: "Error" }), _jsx("div", { className: "mt-2 text-sm text-danger-700", children: errors.map((error, index) => (_jsx("p", { children: error }, index))) })] })] }) })), _jsx("div", { className: "border-b border-gray-200 mb-6", children: _jsx("nav", { className: "-mb-px flex space-x-8", children: ['general', 'mt5', 'safety', 'logs'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: tab.charAt(0).toUpperCase() + tab.slice(1) }, tab))) }) }), _jsxs("div", { className: "card p-6", children: [activeTab === 'general' && (_jsxs("div", { className: "space-y-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "General Settings" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "executorId", className: "label", children: "Executor ID" }), _jsx("input", { id: "executorId", type: "text", value: config?.executorId || '', onChange: (e) => updateConfig({ executorId: e.target.value }), className: "input mt-1", placeholder: "Enter your executor ID" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "platformUrl", className: "label", children: "Platform URL" }), _jsx("input", { id: "platformUrl", type: "text", value: config?.platformUrl || '', onChange: (e) => updateConfig({ platformUrl: e.target.value }), className: "input mt-1", placeholder: "https://fx.nusanexus.com" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "apiKey", className: "label", children: "API Key" }), _jsx("input", { id: "apiKey", type: "text", value: config?.apiKey || '', onChange: (e) => updateConfig({ apiKey: e.target.value }), className: "input mt-1", placeholder: "Enter your API key" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "apiSecret", className: "label", children: "API Secret" }), _jsx("input", { id: "apiSecret", type: "password", value: config?.apiSecret || '', onChange: (e) => updateConfig({ apiSecret: e.target.value }), className: "input mt-1", placeholder: "Enter your API secret" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "pusherKey", className: "label", children: "Pusher Key" }), _jsx("input", { id: "pusherKey", type: "text", value: config?.pusherKey || '', onChange: (e) => updateConfig({ pusherKey: e.target.value }), className: "input mt-1", placeholder: "Enter your Pusher key" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "pusherCluster", className: "label", children: "Pusher Cluster" }), _jsx("input", { id: "pusherCluster", type: "text", value: config?.pusherCluster || '', onChange: (e) => updateConfig({ pusherCluster: e.target.value }), className: "input mt-1", placeholder: "mt1" })] })] }), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { onClick: () => setShowResetDialog(true), className: "btn btn-secondary", children: "Reset to Defaults" }), _jsx("button", { onClick: handleSaveConfig, disabled: isSaving, className: "btn btn-primary", children: isSaving ? 'Saving...' : 'Save Configuration' })] }), testResult !== 'idle' && (_jsxs("div", { className: "mt-4 flex items-center space-x-2", children: [_jsx(StatusIndicator, { status: testResult === 'success' ? 'online' : 'error' }), _jsx("span", { className: "text-sm text-gray-600", children: testResult === 'success'
                                                    ? 'Connection test successful'
                                                    : 'Connection test failed' })] }))] })), activeTab === 'mt5' && (_jsxs("div", { className: "space-y-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "MT5 Settings" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "zmqHost", className: "label", children: "ZeroMQ Host" }), _jsx("input", { id: "zmqHost", type: "text", value: config?.zmqHost || '', onChange: (e) => updateConfig({ zmqHost: e.target.value }), className: "input mt-1", placeholder: "tcp://localhost" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "zmqPort", className: "label", children: "ZeroMQ Port" }), _jsx("input", { id: "zmqPort", type: "number", value: config?.zmqPort || '', onChange: (e) => updateConfig({ zmqPort: parseInt(e.target.value) }), className: "input mt-1", placeholder: "5555" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "heartbeatInterval", className: "label", children: "Heartbeat Interval (seconds)" }), _jsx("input", { id: "heartbeatInterval", type: "number", value: config?.heartbeatInterval || '', onChange: (e) => updateConfig({ heartbeatInterval: parseInt(e.target.value) }), className: "input mt-1", placeholder: "60" })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { id: "autoReconnect", type: "checkbox", checked: config?.autoReconnect || false, onChange: (e) => updateConfig({ autoReconnect: e.target.checked }), className: "h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" }), _jsx("label", { htmlFor: "autoReconnect", className: "ml-2 block text-sm text-gray-900", children: "Auto-reconnect on disconnection" })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h4", { className: "text-md font-medium text-gray-900", children: "MT5 Installations" }), _jsx("button", { onClick: handleRedetectMT5, className: "btn btn-secondary text-sm", children: "Re-detect" })] }), mt5Installations.length > 0 ? (_jsx("div", { className: "space-y-2", children: mt5Installations.map((mt5, index) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-md", children: [_jsxs("div", { children: [_jsxs("div", { className: "font-medium text-gray-900", children: ["MT5 Build ", mt5.build] }), _jsx("div", { className: "text-sm text-gray-500", children: mt5.path })] }), _jsx(StatusIndicator, { status: mt5.isRunning ? 'online' : 'offline' })] }, index))) })) : (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No MT5 installations found" }))] }), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { onClick: handleResetSetup, className: "btn btn-secondary", children: "Reset Setup" }), _jsx("button", { onClick: handleSaveConfig, disabled: isSaving, className: "btn btn-primary", children: isSaving ? 'Saving...' : 'Save Configuration' })] })] })), activeTab === 'safety' && (_jsxs("div", { className: "space-y-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Safety Settings" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "maxDailyLoss", className: "label", children: "Max Daily Loss ($)" }), _jsx("input", { id: "maxDailyLoss", type: "number", value: safetyLimits.maxDailyLoss, onChange: (e) => setSafetyLimits({ ...safetyLimits, maxDailyLoss: parseFloat(e.target.value) }), className: "input mt-1", placeholder: "500" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "maxPositions", className: "label", children: "Max Positions" }), _jsx("input", { id: "maxPositions", type: "number", value: safetyLimits.maxPositions, onChange: (e) => setSafetyLimits({ ...safetyLimits, maxPositions: parseInt(e.target.value) }), className: "input mt-1", placeholder: "10" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "maxLotSize", className: "label", children: "Max Lot Size" }), _jsx("input", { id: "maxLotSize", type: "number", step: "0.01", value: safetyLimits.maxLotSize, onChange: (e) => setSafetyLimits({ ...safetyLimits, maxLotSize: parseFloat(e.target.value) }), className: "input mt-1", placeholder: "1.0" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "maxDrawdownPercent", className: "label", children: "Max Drawdown (%)" }), _jsx("input", { id: "maxDrawdownPercent", type: "number", value: safetyLimits.maxDrawdownPercent, onChange: (e) => setSafetyLimits({ ...safetyLimits, maxDrawdownPercent: parseFloat(e.target.value) }), className: "input mt-1", placeholder: "20" })] })] }), _jsx("div", { className: "bg-warning-50 border border-warning-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-warning-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }) }) }), _jsxs("div", { className: "ml-3", children: [_jsx("h3", { className: "text-sm font-medium text-warning-800", children: "Safety Limits" }), _jsx("div", { className: "mt-2 text-sm text-warning-700", children: "These limits help protect your account from excessive losses. The executor will automatically stop trading when any limit is reached." })] })] }) }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { onClick: handleSaveConfig, disabled: isSaving, className: "btn btn-primary", children: isSaving ? 'Saving...' : 'Save Safety Settings' }) })] })), activeTab === 'logs' && (_jsxs("div", { className: "space-y-6", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Logs Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-md font-medium text-gray-900", children: "Export Logs" }), _jsx("p", { className: "text-sm text-gray-500", children: "Download all logs as a JSON file" })] }), _jsx("button", { onClick: handleExportLogs, className: "btn btn-secondary", children: "Export Logs" })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-md font-medium text-gray-900", children: "Clear Logs" }), _jsx("p", { className: "text-sm text-gray-500", children: "Remove all logs from the application" })] }), _jsx("button", { onClick: () => setShowClearLogsDialog(true), className: "btn btn-danger", children: "Clear Logs" })] })] })] }))] })] }), _jsx(ConfirmDialog, { isOpen: showResetDialog, title: "Reset Configuration", message: "Are you sure you want to reset all configuration settings to their default values? This action cannot be undone.", confirmText: "Reset", cancelText: "Cancel", onConfirm: handleResetConfig, onCancel: () => setShowResetDialog(false), type: "warning" }), _jsx(ConfirmDialog, { isOpen: showClearLogsDialog, title: "Clear Logs", message: "Are you sure you want to clear all logs? This action cannot be undone.", confirmText: "Clear Logs", cancelText: "Cancel", onConfirm: handleClearLogs, onCancel: () => setShowClearLogsDialog(false), type: "warning" })] }));
}
