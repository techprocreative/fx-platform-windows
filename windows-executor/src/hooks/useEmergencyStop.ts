/**
 * Hook for emergency stop functionality
 * Provides a safe way to stop all operations
 */

import { useState, useCallback } from 'react';

interface EmergencyStopResult {
  execute: () => Promise<void>;
  isExecuting: boolean;
  error: Error | null;
}

interface EmergencyStopOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useEmergencyStop = (
  commandService: any,
  strategyService: any,
  zeroMQService: any,
  options?: EmergencyStopOptions
): EmergencyStopResult => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setIsExecuting(true);
    setError(null);

    try {
      console.log('🚨 EMERGENCY STOP INITIATED');

      // Step 1: Stop all strategies
      console.log('⏸️ Stopping all strategies...');
      if (strategyService && typeof strategyService.stopAll === 'function') {
        await strategyService.stopAll();
      }

      // Step 2: Close all open positions
      console.log('🔴 Closing all positions...');
      if (commandService && typeof commandService.closeAllPositions === 'function') {
        try {
          await commandService.closeAllPositions();
        } catch (positionError) {
          console.error('Failed to close some positions:', positionError);
          // Continue with emergency stop even if position closing fails
        }
      }

      // Step 3: Stop command processing
      console.log('🛑 Stopping command processor...');
      if (commandService && typeof commandService.stopProcessing === 'function') {
        commandService.stopProcessing();
      }

      // Step 4: Disconnect from MT5
      console.log('🔌 Disconnecting from MT5...');
      if (zeroMQService && typeof zeroMQService.disconnect === 'function') {
        try {
          await zeroMQService.disconnect();
        } catch (disconnectError) {
          console.error('Failed to disconnect cleanly:', disconnectError);
          // Continue even if disconnect fails
        }
      }

      console.log('✅ EMERGENCY STOP COMPLETED');

      // Call success callback
      if (options?.onSuccess) {
        options.onSuccess();
      }

      // Show success notification
      alert('✅ Emergency stop completed successfully.\n\nAll operations have been halted.');

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Emergency stop failed');
      console.error('❌ EMERGENCY STOP FAILED:', error);
      setError(error);

      // Call error callback
      if (options?.onError) {
        options.onError(error);
      }

      // Show error notification
      alert(
        '❌ Emergency stop encountered errors:\n\n' +
        error.message +
        '\n\nPlease check the console and manually verify all positions are closed.'
      );

      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, [commandService, strategyService, zeroMQService, options]);

  return {
    execute,
    isExecuting,
    error,
  };
};

export default useEmergencyStop;
