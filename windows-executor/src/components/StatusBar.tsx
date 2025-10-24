
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

  const handleEmergencyStop = () => {
    // This will be handled by the parent component
    window.dispatchEvent(new CustomEvent('emergency-stop-requested'));
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
        {/* Trading Toggle */}
        <div className="flex items-center space-x-2 electron-no-drag">
          <label className="text-xs">Trading:</label>
          <button
            onClick={() => setIsTradingEnabled(!isTradingEnabled)}
            disabled={isEmergencyStopActive}
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
    </div>
  );
}
