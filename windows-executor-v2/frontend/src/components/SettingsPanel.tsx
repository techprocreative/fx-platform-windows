import { useState, useEffect } from 'react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
}

interface ExecutorSettings {
  apiKey: string;
  apiSecret: string;
  executorId: string;
  refreshInterval: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export const SettingsPanel = ({ isOpen, onClose, backendUrl }: SettingsPanelProps) => {
  const [settings, setSettings] = useState<ExecutorSettings>({
    apiKey: '',
    apiSecret: '',
    executorId: '',
    refreshInterval: 5,
    notificationsEnabled: true,
    soundEnabled: false,
  });

  const [backendStatus, setBackendStatus] = useState({
    backend: 'checking',
    mt5: 'checking',
    pusher: 'checking',
  });

  useEffect(() => {
    if (isOpen) {
      checkBackendStatus();
    }
  }, [isOpen, backendUrl]);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      const data = await response.json();
      
      setBackendStatus({
        backend: data.status === 'ok' ? 'online' : 'offline',
        mt5: data.features?.mt5 ? 'online' : 'offline',
        pusher: 'checking', // Will be updated by Pusher connection
      });
    } catch (error) {
      setBackendStatus({
        backend: 'offline',
        mt5: 'offline',
        pusher: 'offline',
      });
    }
  };

  const handleSave = () => {
    // Save settings logic here
    console.log('Settings saved:', settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Settings Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          backgroundColor: '#1e293b',
          zIndex: 1000,
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* Connections Status */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
              🔌 Connections
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <StatusRow label="Backend" status={backendStatus.backend} />
              <StatusRow label="MT5 Terminal" status={backendStatus.mt5} />
              <StatusRow label="Pusher (Real-time)" status={backendStatus.pusher} />
            </div>
          </section>

          {/* Notifications */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
              🔔 Notifications
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <CheckboxRow
                label="Trade opened/closed"
                checked={settings.notificationsEnabled}
                onChange={(checked) => setSettings({ ...settings, notificationsEnabled: checked })}
              />
              <CheckboxRow
                label="Sound notifications"
                checked={settings.soundEnabled}
                onChange={(checked) => setSettings({ ...settings, soundEnabled: checked })}
              />
            </div>
          </section>

          {/* Data Refresh */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
              📊 Data Refresh
            </h3>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Refresh Interval
              </label>
              <select
                value={settings.refreshInterval}
                onChange={(e) => setSettings({ ...settings, refreshInterval: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '0.5rem',
                  color: '#f1f5f9',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
            </div>
          </section>

          {/* Account Info */}
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>
              🔐 Account
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Executor ID
                </label>
                <input
                  type="text"
                  value={settings.executorId}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#64748b',
                    fontSize: '0.875rem',
                  }}
                  placeholder="Not configured"
                />
              </div>
              <button
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '0.5rem',
                  color: '#f1f5f9',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (window.executor?.openExternal) {
                    window.executor.openExternal('file://' + process.env.LOCALAPPDATA + '/Programs/windows-executor-v2/.env');
                  }
                }}
              >
                📝 Edit Credentials (.env)
              </button>
              <button
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '0.5rem',
                  color: '#f1f5f9',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const logPath = '%LOCALAPPDATA%\\WindowsExecutorV2\\logs\\';
                  alert(`Logs location:\n${logPath}\n\nOpen File Explorer and paste this path.`);
                }}
              >
                📋 View Logs
              </button>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>ℹ️ About</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
              <div>Version: 1.0.0</div>
              <div>Platform: Windows Executor V2</div>
              <div>Backend: Python FastAPI + MT5</div>
              <div>Frontend: React + Electron</div>
              <a
                href="https://fx.nusanexus.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none', marginTop: '0.5rem' }}
              >
                🌐 Open Platform Dashboard
              </a>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1.5rem',
            borderTop: '1px solid #334155',
            display: 'flex',
            gap: '1rem',
          }}
        >
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#334155',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#f1f5f9',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

// Helper Components
const StatusRow = ({ label, status }: { label: string; status: string }) => {
  const colors = {
    online: '#22c55e',
    offline: '#ef4444',
    checking: '#f59e0b',
  };

  const color = colors[status as keyof typeof colors] || '#94a3b8';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem',
        backgroundColor: '#0f172a',
        borderRadius: '0.5rem',
      }}
    >
      <span style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ color, fontSize: '0.875rem', fontWeight: 600 }}>
        {status === 'checking' ? '...' : status.toUpperCase()}
      </span>
    </div>
  );
};

const CheckboxRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: '#0f172a',
        borderRadius: '0.5rem',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: '18px',
          height: '18px',
          cursor: 'pointer',
        }}
      />
      <span style={{ color: '#cbd5e1', fontSize: '0.875rem', flex: 1 }}>{label}</span>
    </label>
  );
};
