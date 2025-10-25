/**
 * Simple Test Dashboard
 * Minimal version to verify rendering
 */

export function DashboardTest() {
  return (
    <div className="h-full w-full bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          FX Platform Executor - Dashboard
        </h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">
            ✅ Dashboard is Working!
          </h2>
          <p className="text-blue-700">
            This confirms the React app is rendering correctly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm font-medium text-green-900">Status</div>
            <div className="text-2xl font-bold text-green-700">Online</div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-900">Strategies</div>
            <div className="text-2xl font-bold text-blue-700">0</div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm font-medium text-purple-900">Signals</div>
            <div className="text-2xl font-bold text-purple-700">0</div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm font-medium text-orange-900">Trades</div>
            <div className="text-2xl font-bold text-orange-700">0</div>
          </div>
        </div>

        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>• Windows Executor v1.0.0</div>
            <div>• All services initialized</div>
            <div>• Ready for trading</div>
            <div>• 22 services active (11 core + 11 live trading)</div>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This is a test dashboard. The full dashboard will be loaded once you complete setup.
          </p>
        </div>
      </div>
    </div>
  );
}
