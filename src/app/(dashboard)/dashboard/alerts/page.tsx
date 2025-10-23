'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Bell, 
  BellRing, 
  Check, 
  X, 
  Settings, 
  Filter,
  Download,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Plus
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'price' | 'position' | 'risk' | 'system' | 'news';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  read: boolean;
  source?: string;
  metadata?: Record<string, any>;
}

interface AlertRule {
  id: string;
  name: string;
  type: 'price' | 'position' | 'risk' | 'system';
  enabled: boolean;
  conditions: {
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    value: number | string;
  }[];
  actions: {
    type: 'notification' | 'email' | 'sms' | 'webhook';
    enabled: boolean;
  }[];
  createdAt: Date;
  lastTriggered?: Date;
}

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'acknowledged' | 'unacknowledged'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: true,
    sms: false,
    webhook: false
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (status === 'authenticated') {
      fetchAlerts();
      fetchAlertRules();
    }
  }, [status]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.alerts || []);
        setError(null);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setError('Failed to load alerts. Please try again.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertRules = async () => {
    try {
      // TODO: Implement alert rules API endpoint
      // For now, set empty array until API is ready
      setAlertRules([]);
    } catch (error) {
      console.error('Failed to fetch alert rules:', error);
      setAlertRules([]);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged: true, read: true })
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true, read: true }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true })
      });

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, read: true }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    try {
      setAlertRules(prev => prev.map(rule => 
        rule.id === ruleId 
          ? { ...rule, enabled: !rule.enabled }
          : rule
      ));
    } catch (error) {
      console.error('Failed to toggle alert rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      setAlertRules(prev => prev.filter(rule => rule.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete alert rule:', error);
    }
  };

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    if (severity === 'high') return <AlertCircle className="h-5 w-5 text-red-500" />;
    if (severity === 'medium') return <AlertCircle className="h-5 w-5 text-amber-500" />;
    return <Info className="h-5 w-5 text-blue-500" />;
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'price': return 'bg-blue-100 text-blue-800';
      case 'position': return 'bg-green-100 text-green-800';
      case 'risk': return 'bg-amber-100 text-amber-800';
      case 'system': return 'bg-red-100 text-red-800';
      case 'news': return 'bg-purple-100 text-purple-800';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'acknowledged') return alert.acknowledged;
    if (filter === 'unacknowledged') return !alert.acknowledged;
    if (selectedType !== 'all') return alert.type === selectedType;
    return true;
  });

  const unreadCount = alerts.filter(alert => !alert.read).length;
  const unacknowledgedCount = alerts.filter(alert => !alert.acknowledged).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-8 w-8 text-neutral-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Alerts</h1>
            <p className="text-neutral-600 mt-1">
              Manage trading alerts and notifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button variant="secondary" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Total Alerts</span>
            <Bell className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{alerts.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Unread</span>
            <BellRing className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{unreadCount}</p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Unacknowledged</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{unacknowledgedCount}</p>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Active Rules</span>
            <Settings className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {alertRules.filter(rule => rule.enabled).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="all">All Alerts</option>
              <option value="unread">Unread</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="unacknowledged">Unacknowledged</option>
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="all">All Types</option>
              <option value="price">Price</option>
              <option value="position">Position</option>
              <option value="risk">Risk</option>
              <option value="system">System</option>
              <option value="news">News</option>
            </select>
          </div>

          {/* Alerts */}
          {filteredAlerts.length > 0 ? (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <Card 
                  key={alert.id} 
                  className={`p-4 ${!alert.read ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type, alert.severity)}
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-neutral-900">{alert.title}</h3>
                          <p className="text-sm text-neutral-600 mt-1">{alert.message}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${getAlertTypeColor(alert.type)}`}>
                            {alert.type}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            alert.severity === 'high' ? 'bg-red-100 text-red-700' :
                            alert.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {alert.timestamp.toLocaleString()}
                          </span>
                          {alert.source && (
                            <span>Source: {alert.source}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {!alert.read && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMarkAsRead(alert.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          
                          {!alert.acknowledged && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteAlert(alert.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Bell className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No Alerts Found</h3>
              <p className="text-neutral-600">
                {filter === 'all' && selectedType === 'all' 
                  ? "You don't have any alerts at the moment."
                  : `No alerts match the current filters.`
                }
              </p>
            </Card>
          )}
        </div>

        {/* Alert Rules & Settings */}
        <div className="space-y-6">
          {/* Alert Rules */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Alert Rules</h3>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowRuleDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Rule
              </Button>
            </div>
            
            {alertRules.length > 0 ? (
              <div className="space-y-3">
                {alertRules.map((rule) => (
                  <div key={rule.id} className="border-b border-neutral-100 pb-3 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-neutral-900">{rule.name}</h4>
                        <p className="text-xs text-neutral-500">
                          Type: {rule.type} • Created: {rule.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            rule.enabled ? 'bg-primary-600' : 'bg-neutral-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              rule.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingRule(rule);
                            setShowRuleDialog(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {rule.lastTriggered && (
                      <p className="text-xs text-neutral-500">
                        Last triggered: {rule.lastTriggered.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-4">
                No alert rules configured
              </p>
            )}
          </Card>

          {/* Notification Settings */}
          <Card className="p-4">
            <h3 className="font-semibold text-neutral-900 mb-4">Notification Settings</h3>
            
            <div className="space-y-3">
              {[
                { key: 'email', label: 'Email Notifications', icon: '📧' },
                { key: 'push', label: 'Push Notifications', icon: '🔔' },
                { key: 'sms', label: 'SMS Alerts', icon: '📱' },
                { key: 'webhook', label: 'Webhook Integration', icon: '🔗' }
              ].map((setting) => (
                <div key={setting.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{setting.icon}</span>
                    <span className="text-sm font-medium text-neutral-700">{setting.label}</span>
                  </div>
                  
                  <button
                    onClick={() => setNotificationSettings(prev => ({
                      ...prev,
                      [setting.key]: !prev[setting.key as keyof typeof prev]
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notificationSettings[setting.key as keyof typeof notificationSettings] 
                        ? 'bg-primary-600' 
                        : 'bg-neutral-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationSettings[setting.key as keyof typeof notificationSettings] 
                          ? 'translate-x-6' 
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
            
            <Button variant="secondary" size="sm" className="w-full mt-4">
              Configure Advanced Settings
            </Button>
          </Card>
        </div>
      </div>

      {/* Add/Edit Rule Dialog */}
      {showRuleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  defaultValue={editingRule?.name || ''}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter rule name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Alert Type
                </label>
                <select
                  defaultValue={editingRule?.type || ''}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select type</option>
                  <option value="price">Price Alert</option>
                  <option value="position">Position Alert</option>
                  <option value="risk">Risk Alert</option>
                  <option value="system">System Alert</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Conditions
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="Define alert conditions..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRuleDialog(false);
                  setEditingRule(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle save rule logic here
                  setShowRuleDialog(false);
                  setEditingRule(null);
                }}
                className="flex-1"
              >
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}