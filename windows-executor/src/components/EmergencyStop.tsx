import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface EmergencyStopProps {
  onEmergencyStop: () => Promise<void>;
  disabled?: boolean;
}

export const EmergencyStopButton: React.FC<EmergencyStopProps> = ({
  onEmergencyStop,
  disabled = false
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onEmergencyStop();
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Emergency stop failed:', error);
      alert(`❌ Emergency stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || isExecuting}
        className={`
          relative px-6 py-3 rounded-lg font-bold text-lg
          transition-all duration-200
          ${disabled || isExecuting 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
          }
          text-white shadow-lg hover:shadow-xl
          flex items-center gap-2
        `}
        title="Stop all strategies and close all positions immediately"
      >
        <AlertTriangle className="h-5 w-5" />
        {isExecuting ? 'Stopping...' : '🛑 EMERGENCY STOP'}
      </button>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                ⚠️ EMERGENCY STOP
              </h2>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-gray-700 font-semibold">
                This will immediately:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Stop all running strategies</li>
                <li>Close all open positions</li>
                <li>Disconnect from MT5</li>
                <li>Halt all trading operations</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ This action cannot be undone. Are you sure you want to continue?
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={isExecuting}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isExecuting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? 'Stopping...' : 'Yes, Stop Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Compact version for toolbar
export const EmergencyStopCompact: React.FC<EmergencyStopProps> = ({
  onEmergencyStop,
  disabled = false
}) => {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClick = async () => {
    const confirmed = window.confirm(
      '⚠️ EMERGENCY STOP\n\n' +
      'This will:\n' +
      '- Stop all running strategies\n' +
      '- Close all open positions\n' +
      '- Disconnect from MT5\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setIsExecuting(true);
    try {
      await onEmergencyStop();
    } catch (error) {
      console.error('Emergency stop failed:', error);
      alert(`❌ Emergency stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isExecuting}
      className={`
        px-4 py-2 rounded-md font-semibold text-sm
        transition-all duration-200
        ${disabled || isExecuting 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-red-600 hover:bg-red-700'
        }
        text-white shadow hover:shadow-md
        flex items-center gap-2
      `}
      title="Emergency stop all operations"
    >
      <AlertTriangle className="h-4 w-4" />
      {isExecuting ? 'Stopping...' : 'Emergency Stop'}
    </button>
  );
};

export default EmergencyStopButton;
