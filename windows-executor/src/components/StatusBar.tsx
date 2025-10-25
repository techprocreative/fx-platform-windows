
import { useState } from 'react';
import { useAppStore } from '../stores/app.store';
import { StatusIndicator } from './StatusIndicator';

export function StatusBar({ connectionStatus: propConnectionStatus, onNavigate, currentPage: propCurrentPage }: { connectionStatus?: any; onNavigate?: (page: string) => void; currentPage?: string }) {
  const { 
    connectionStatus, 
    config, 
    isTradingEnabled,
    setIsTradingEnabled,
    isEmergencyStopActive 
  } = useAppStore();

  const [showTradingConfirm, setShowTradingConfirm] = useState(false);

  const handleEmergencyStop = () => {
    // This will be handled by the parent component
    window.dispatchEvent(new CustomEvent('emergency-stop-requested'));
  };

  const handleTradingToggle = () => {
    // If turning OFF, show confirmation
    if (isTradingEnabled) {
      setShowTradingConfirm(true);
    } else {
      // Turning ON is safe, do it directly
      setIsTradingEnabled(true);
    }
  };

  const confirmTradingOff = () => {
    setIsTradingEnabled(false);
    setShowTradingConfirm(false);
  };

  return (
    <div className="electron-drag bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center space-x-6">
        {/* App Title */}
        <div className="font-semibold electron-no-drag">
          FX Platform Executor
        </div>

        {/* Connection Status */}
        <div className="flex items-center space-x-4 electron-no-drag">
          <div className="flex items-center space-x-2">
            <StatusIndicator 
              status={connectionStatus.pusher === 'connected' ? 'online' : 'offline'} 
            />
            <span className="text-xs">Platform</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <StatusIndicator 
              status={connectionStatus.mt5 === 'connected' ? 'online' : 'offline'} 
            />
            <span className="text-xs">MT5</span>
          </div>
        </div>

        {/* Executor Info */}
        {config?.executorId && (
          <div className="text-xs electron-no-drag">
            Executor: {config.executorId}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Trading Toggle with Tooltip */}
        <div className="flex items-center space-x-2 electron-no-drag relative group">
          <label className="text-xs">Auto Trading:</label>
          <button
            onClick={handleTradingToggle}
            disabled={isEmergencyStopActive}
            title={isTradingEnabled ? "Click to DISABLE automatic trading" : "Click to ENABLE automatic trading"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              isTradingEnabled ? 'bg-success-600' : 'bg-gray-600'
            } ${isEmergencyStopActive ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isTradingEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${isTradingEnabled ? 'text-success-400' : 'text-gray-400'}`}>
            {isTradingEnabled ? 'ON' : 'OFF'}
          </span>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
            <div className="bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap shadow-lg border border-gray-700">
              <div className="font-semibold mb-1">Master Trading Switch</div>
              <div className="text-gray-300">
                {isTradingEnabled ? (
                  <>• ON: Executor accepts & executes signals</>
                ) : (
                  <>• OFF: All trading paused, no new orders</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Stop Button */}
        <button
          onClick={handleEmergencyStop}
          className="electron-no-drag bg-danger-600 hover:bg-danger-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
        >
          🛑 Emergency
        </button>

        {/* Window Controls */}
        <div className="flex items-center space-x-2 electron-no-drag">
          <button
            onClick={() => window.electronAPI?.minimizeApp?.()}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={() => window.electronAPI?.quitApp?.()}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Trading Disable Confirmation Dialog */}
      {showTradingConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 electron-no-drag">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Disable Auto Trading?</h3>
                <div className="mt-2 text-sm text-gray-500">
                  <p className="mb-2">This will stop all automatic trading activities:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>No new signals will be processed</li>
                    <li>No new orders will be opened</li>
                    <li>Existing positions will remain open</li>
                  </ul>
                  <p className="mt-3 font-medium text-gray-700">
                    Are you sure you want to disable trading?
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowTradingConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmTradingOff}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
              >
                Yes, Disable Trading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
