import { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
}

export const Tabs = ({ tabs, activeTab, onTabChange, children }: TabsProps) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #1e293b',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '0.75rem 1.25rem',
              background: activeTab === tab.id ? '#1e293b' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab.id ? '#f1f5f9' : '#94a3b8',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              marginBottom: '-2px',
            }}
          >
            {tab.icon && <span style={{ marginRight: '0.5rem' }}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

interface TabPanelProps {
  tabId: string;
  activeTab: string;
  children: ReactNode;
}

export const TabPanel = ({ tabId, activeTab, children }: TabPanelProps) => {
  if (tabId !== activeTab) return null;
  return <div style={{ height: '100%', overflow: 'hidden' }}>{children}</div>;
};
