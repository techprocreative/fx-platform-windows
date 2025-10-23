import React, { useState, useRef, useEffect } from 'react';

interface Activity {
  id: string;
  type: 'TRADE' | 'SIGNAL' | 'ERROR' | 'INFO';
  message: string;
  timestamp: Date;
  metadata?: any;
}

interface ActivityLogProps {
  activities: Activity[];
  maxHeight?: string;
  className?: string;
}

export function ActivityLog({ activities, maxHeight = '400px', className = '' }: ActivityLogProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new activities are added
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activities, autoScroll]);

  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'TRADE':
        return (
          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'SIGNAL':
        return (
          <svg className="w-4 h-4 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'ERROR':
        return (
          <svg className="w-4 h-4 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'INFO':
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const clearLog = () => {
    // This would be handled by the parent component
    console.log('Clear log not implemented');
  };

  const exportLog = () => {
    const logData = activities.map(activity => ({
      timestamp: activity.timestamp.toISOString(),
      type: activity.type,
      message: activity.message,
      metadata: activity.metadata,
    }));

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Activity Log</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded ${
              autoScroll 
                ? 'bg-primary-100 text-primary-800' 
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
          </button>
          
          <button
            onClick={exportLog}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            Export
          </button>
        </div>
      </div>

      <div 
        ref={logContainerRef}
        className="overflow-y-auto custom-scrollbar bg-gray-50 rounded-md p-3"
        style={{ maxHeight }}
        onScroll={handleScroll}
      >
        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-2">
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-900 truncate">
                      {activity.message}
                    </p>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                  
                  {activity.metadata && (
                    <details className="text-xs text-gray-500 mt-1">
                      <summary className="cursor-pointer">Details</summary>
                      <pre className="mt-1 bg-white p-2 rounded border overflow-x-auto">
                        {JSON.stringify(activity.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No activity yet
          </div>
        )}
      </div>
    </div>
  );
}