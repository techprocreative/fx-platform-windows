import React, { useState, useRef, useEffect } from 'react';
import { useLogsStore } from '../../stores/logs.store';
import { useAppStore } from '../../stores/app.store';
import { StatusIndicator } from '../../components/StatusIndicator';

export function Logs() {
  const { 
    logs, 
    logLevels, 
    setLogLevels, 
    autoScroll, 
    setAutoScroll, 
    maxLogs, 
    setMaxLogs,
    exportLogs,
    clearLogs 
  } = useLogsStore();
  
  const { addLog } = useAppStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Get unique categories from logs
  const categories = ['all', ...Array.from(new Set(logs.map(log => log.category)))];

  // Filter logs based on search term, log levels, and category
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = logLevels.includes(log.level);
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

  const handleLogLevelToggle = (level: typeof logLevels[0]) => {
    if (logLevels.includes(level)) {
      setLogLevels(logLevels.filter(l => l !== level));
    } else {
      setLogLevels([...logLevels, level]);
    }
  };

  const handleClearLogs = () => {
    clearLogs();
    addLog({
      level: 'info',
      category: 'LOGS',
      message: 'Logs cleared by user',
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
      category: 'LOGS',
      message: 'Logs exported',
    });
  };

  const getLogLevelColor = (level: typeof logLevels[0]) => {
    switch (level) {
      case 'debug': return 'text-gray-600';
      case 'info': return 'text-blue-600';
      case 'warn': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getLogLevelBgColor = (level: typeof logLevels[0]) => {
    switch (level) {
      case 'debug': return 'bg-gray-100';
      case 'info': return 'bg-blue-100';
      case 'warn': return 'bg-yellow-100';
      case 'error': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
            <p className="text-sm text-gray-600">
              View and filter application logs.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Log Count */}
            <div className="text-sm text-gray-500">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
            
            {/* Auto-scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-xs px-3 py-1 rounded-md ${
                autoScroll 
                  ? 'bg-primary-100 text-primary-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
            </button>
            
            {/* Export Button */}
            <button
              onClick={handleExportLogs}
              className="btn btn-secondary text-sm"
            >
              Export
            </button>
            
            {/* Clear Button */}
            <button
              onClick={handleClearLogs}
              className="btn btn-danger text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full"
              />
            </div>
            
            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Log Level Filters */}
            <div>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="btn btn-secondary text-sm flex items-center space-x-2"
              >
                <span>Log Levels</span>
                <svg className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* Max Logs */}
            <div className="flex items-center space-x-2">
              <label htmlFor="maxLogs" className="text-sm text-gray-600">Max Logs:</label>
              <input
                id="maxLogs"
                type="number"
                min="100"
                max="10000"
                step="100"
                value={maxLogs}
                onChange={(e) => setMaxLogs(parseInt(e.target.value))}
                className="input w-20"
              />
            </div>
          </div>
          
          {/* Log Level Filter Dropdown */}
          {isFilterOpen && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {(['debug', 'info', 'warn', 'error'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => handleLogLevelToggle(level)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      logLevels.includes(level)
                        ? `${getLogLevelBgColor(level)} ${getLogLevelColor(level)}`
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Logs Container */}
        <div className="card p-0 overflow-hidden">
          <div 
            ref={logContainerRef}
            className="overflow-y-auto custom-scrollbar bg-gray-900 text-gray-100 font-mono text-sm"
            style={{ height: 'calc(100vh - 300px)' }}
            onScroll={handleScroll}
          >
            {filteredLogs.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="px-4 py-2 hover:bg-gray-800 transition-colors">
                    <div className="flex items-start space-x-3">
                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">
                        <div>{formatDate(log.timestamp)}</div>
                        <div>{formatTime(log.timestamp)}</div>
                      </div>
                      
                      {/* Level */}
                      <div className="flex-shrink-0">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getLogLevelBgColor(log.level)} ${getLogLevelColor(log.level)}`}>
                          {log.level.toUpperCase()}
                        </span>
                      </div>
                      
                      {/* Category */}
                      <div className="flex-shrink-0">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-700 text-gray-300">
                          {log.category}
                        </span>
                      </div>
                      
                      {/* Message */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-100 break-words">{log.message}</div>
                        
                        {/* Metadata */}
                        {log.metadata && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                              Metadata
                            </summary>
                            <pre className="mt-1 text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <StatusIndicator status="offline" />
                  <p className="mt-2">No logs to display</p>
                  <p className="text-xs mt-1">
                    {logs.length === 0 
                      ? 'Logs will appear here as the application runs' 
                      : 'Try adjusting your filters'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}