'use client';

import { useState } from 'react';
import { 
  User, 
  Palette, 
  Bell, 
  TrendingUp, 
  Layout, 
  Download, 
  Upload, 
  RotateCcw,
  Save,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useUserPreferences, validatePreferences } from '@/contexts/UserPreferencesContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type TabType = 'display' | 'notifications' | 'trading' | 'dashboard' | 'advanced';

export function UserPreferencesPanel() {
  const { 
    preferences, 
    updatePreferences, 
    resetPreferences, 
    exportPreferences, 
    importPreferences, 
    error 
  } = useUserPreferences();
  
  const [activeTab, setActiveTab] = useState<TabType>('display');
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleUpdatePreferences = (updates: any) => {
    updatePreferences(updates);
    setHasChanges(true);
  };

  const handleReset = () => {
    resetPreferences();
    setHasChanges(false);
    setConfirmReset(false);
  };

  const handleExport = () => {
    const data = exportPreferences();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-trade-preferences.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        importPreferences(content);
        setHasChanges(true);
        setImportError(null);
      } catch (err) {
        setImportError('Failed to import preferences. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'display' as TabType, label: 'Display', icon: Palette },
    { id: 'notifications' as TabType, label: 'Notifications', icon: Bell },
    { id: 'trading' as TabType, label: 'Trading', icon: TrendingUp },
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: Layout },
    { id: 'advanced' as TabType, label: 'Advanced', icon: User },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">User Preferences</h1>
          <p className="text-tertiary">Customize your trading experience</p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Unsaved changes
            </div>
          )}
          
          <Button
            variant="secondary"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => document.getElementById('import-preferences')?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <input
            id="import-preferences"
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          
          <Button
            variant="danger"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {importError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {importError}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-primary">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-tertiary hover:text-primary'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'display' && (
          <DisplayPreferencesTab 
            preferences={preferences.display} 
            onUpdate={handleUpdatePreferences} 
          />
        )}
        
        {activeTab === 'notifications' && (
          <NotificationPreferencesTab 
            preferences={preferences.notifications} 
            onUpdate={handleUpdatePreferences} 
          />
        )}
        
        {activeTab === 'trading' && (
          <TradingPreferencesTab 
            preferences={preferences.trading} 
            onUpdate={handleUpdatePreferences} 
          />
        )}
        
        {activeTab === 'dashboard' && (
          <DashboardPreferencesTab 
            preferences={preferences.dashboard} 
            onUpdate={handleUpdatePreferences} 
          />
        )}
        
        {activeTab === 'advanced' && (
          <AdvancedPreferencesTab 
            preferences={preferences} 
            onUpdate={handleUpdatePreferences} 
          />
        )}
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={() => setHasChanges(false)} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}

      {/* Reset Confirmation */}
      <ConfirmDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset Preferences"
        description="Are you sure you want to reset all preferences to default values? This action cannot be undone."
        confirmText="Reset"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

// Display Preferences Tab
function DisplayPreferencesTab({ 
  preferences, 
  onUpdate 
}: { 
  preferences: any; 
  onUpdate: (updates: any) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Appearance</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Theme
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => onUpdate({ display: { ...preferences, theme: e.target.value } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Font Size
              </label>
              <select
                value={preferences.fontSize}
                onChange={(e) => onUpdate({ display: { ...preferences, fontSize: e.target.value } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Language
              </label>
              <select
                value={preferences.language}
                onChange={(e) => onUpdate({ display: { ...preferences, language: e.target.value } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Timezone
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => onUpdate({ display: { ...preferences, timezone: e.target.value } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Accessibility</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.highContrast}
                onChange={(e) => onUpdate({ display: { ...preferences, highContrast: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">High contrast mode</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.showAnimations}
                onChange={(e) => onUpdate({ display: { ...preferences, showAnimations: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Show animations</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.compactMode}
                onChange={(e) => onUpdate({ display: { ...preferences, compactMode: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Compact mode</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Notification Preferences Tab
function NotificationPreferencesTab({ 
  preferences, 
  onUpdate 
}: { 
  preferences: any; 
  onUpdate: (updates: any) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Notification Channels</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.email}
                onChange={(e) => onUpdate({ notifications: { ...preferences, email: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Email notifications</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.push}
                onChange={(e) => onUpdate({ notifications: { ...preferences, push: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Push notifications</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.inApp}
                onChange={(e) => onUpdate({ notifications: { ...preferences, inApp: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">In-app notifications</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.soundEnabled}
                onChange={(e) => onUpdate({ notifications: { ...preferences, soundEnabled: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Sound alerts</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Notification Types</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.tradeAlerts}
                onChange={(e) => onUpdate({ notifications: { ...preferences, tradeAlerts: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Trade alerts</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.strategyAlerts}
                onChange={(e) => onUpdate({ notifications: { ...preferences, strategyAlerts: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Strategy alerts</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.systemUpdates}
                onChange={(e) => onUpdate({ notifications: { ...preferences, systemUpdates: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">System updates</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.marketingEmails}
                onChange={(e) => onUpdate({ notifications: { ...preferences, marketingEmails: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Marketing emails</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Quiet Hours</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.quietHours.enabled}
                onChange={(e) => onUpdate({ 
                  notifications: { 
                    ...preferences, 
                    quietHours: { ...preferences.quietHours, enabled: e.target.checked } 
                  } 
                })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Enable quiet hours</span>
            </label>

            {preferences.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => onUpdate({ 
                      notifications: { 
                        ...preferences, 
                        quietHours: { ...preferences.quietHours, start: e.target.value } 
                      } 
                    })}
                    className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    End time
                  </label>
                  <input
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => onUpdate({ 
                      notifications: { 
                        ...preferences, 
                        quietHours: { ...preferences.quietHours, end: e.target.value } 
                      } 
                    })}
                    className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Trading Preferences Tab
function TradingPreferencesTab({ 
  preferences, 
  onUpdate 
}: { 
  preferences: any; 
  onUpdate: (updates: any) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Default Trading Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Default Order Type
              </label>
              <select
                value={preferences.defaultOrderType}
                onChange={(e) => onUpdate({ trading: { ...preferences, defaultOrderType: e.target.value } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Default Timeframe
              </label>
              <select
                value={preferences.defaultTimeframe}
                onChange={(e) => onUpdate({ trading: { ...preferences, defaultTimeframe: e.target.value } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Default Lot Size
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={preferences.defaultLotSize}
                onChange={(e) => onUpdate({ trading: { ...preferences, defaultLotSize: parseFloat(e.target.value) } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Risk per Trade (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={preferences.riskPerTrade}
                onChange={(e) => onUpdate({ trading: { ...preferences, riskPerTrade: parseFloat(e.target.value) } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Max Daily Loss ($)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={preferences.maxDailyLoss}
                onChange={(e) => onUpdate({ trading: { ...preferences, maxDailyLoss: parseFloat(e.target.value) } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Slippage Tolerance (pips)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={preferences.slippageTolerance}
                onChange={(e) => onUpdate({ trading: { ...preferences, slippageTolerance: parseFloat(e.target.value) } })}
                className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Trading Behavior</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.confirmTrades}
                onChange={(e) => onUpdate({ trading: { ...preferences, confirmTrades: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Confirm trades before execution</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.autoClosePositions}
                onChange={(e) => onUpdate({ trading: { ...preferences, autoClosePositions: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Auto-close positions at market close</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Preferred Currency Pairs</h3>
          
          <div className="space-y-2">
            {['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD'].map(pair => (
              <label key={pair} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={preferences.preferredPairs.includes(pair)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...preferences.preferredPairs, pair]
                      : preferences.preferredPairs.filter((p: string) => p !== pair);
                    onUpdate({ trading: { ...preferences, preferredPairs: updated } });
                  }}
                  className="rounded border-secondary text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-primary">{pair}</span>
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Dashboard Preferences Tab
function DashboardPreferencesTab({ 
  preferences, 
  onUpdate 
}: { 
  preferences: any; 
  onUpdate: (updates: any) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Layout Settings</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.sidebarCollapsed}
                onChange={(e) => onUpdate({ dashboard: { ...preferences, sidebarCollapsed: e.target.checked } })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Collapse sidebar by default</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Sidebar Width (px)
              </label>
              <input
                type="range"
                min="200"
                max="400"
                value={preferences.sidebarWidth}
                onChange={(e) => onUpdate({ dashboard: { ...preferences, sidebarWidth: parseInt(e.target.value) } })}
                className="w-full"
              />
              <div className="text-xs text-tertiary mt-1">{preferences.sidebarWidth}px</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Widget Management</h3>
          <p className="text-sm text-tertiary mb-4">
            Customize your dashboard by adding, removing, and rearranging widgets.
          </p>
          
          <div className="border-2 border-dashed border-secondary rounded-lg p-8 text-center">
            <p className="text-tertiary">Widget customization coming soon</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Advanced Preferences Tab
function AdvancedPreferencesTab({ 
  preferences, 
  onUpdate 
}: { 
  preferences: any; 
  onUpdate: (updates: any) => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Data Management</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg">
              <h4 className="text-sm font-medium text-primary mb-2">Export All Data</h4>
              <p className="text-xs text-tertiary mb-3">
                Download all your trading data, strategies, and settings.
              </p>
              <Button variant="secondary" size="sm">
                Export Data
              </Button>
            </div>

            <div className="p-4 bg-secondary rounded-lg">
              <h4 className="text-sm font-medium text-primary mb-2">Clear Cache</h4>
              <p className="text-xs text-tertiary mb-3">
                Clear cached data to free up storage space.
              </p>
              <Button variant="secondary" size="sm">
                Clear Cache
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Developer Options</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.customSettings.debugMode || false}
                onChange={(e) => onUpdate({ 
                  customSettings: { 
                    ...preferences.customSettings, 
                    debugMode: e.target.checked 
                  } 
                })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Enable debug mode</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.customSettings.verboseLogging || false}
                onChange={(e) => onUpdate({ 
                  customSettings: { 
                    ...preferences.customSettings, 
                    verboseLogging: e.target.checked 
                  } 
                })}
                className="rounded border-secondary text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-primary">Verbose logging</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-primary mb-4">Account Actions</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-700 mb-2">Delete Account</h4>
              <p className="text-xs text-red-600 mb-3">
                Permanently delete your account and all associated data.
              </p>
              <Button variant="danger" size="sm">
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}