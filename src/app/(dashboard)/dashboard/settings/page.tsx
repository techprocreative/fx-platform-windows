'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import toast from 'react-hot-toast';
import { Settings, Bell, Lock, User } from 'lucide-react';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    theme: 'light',
    timezone: 'UTC',
  });

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        toast.success('Preferences saved');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-600 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account Information */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-5 w-5 text-neutral-600" />
          <h2 className="text-lg font-bold text-neutral-900">Account Information</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-600">Email</p>
            <p className="font-medium text-neutral-900">{session?.user?.email}</p>
          </div>

          <div>
            <p className="text-sm text-neutral-600">Name</p>
            <p className="font-medium text-neutral-900">{session?.user?.name}</p>
          </div>

          <button className="mt-4 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium">
            Change Password
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-5 w-5 text-neutral-600" />
          <h2 className="text-lg font-bold text-neutral-900">Notifications</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  emailNotifications: e.target.checked,
                })
              }
              className="w-4 h-4 rounded"
            />
            <span className="text-neutral-700">Email notifications</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.pushNotifications}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  pushNotifications: e.target.checked,
                })
              }
              className="w-4 h-4 rounded"
            />
            <span className="text-neutral-700">Push notifications</span>
          </label>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-5 w-5 text-neutral-600" />
          <h2 className="text-lg font-bold text-neutral-900">Preferences</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Theme</label>
            <select
              value={preferences.theme}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  theme: e.target.value,
                })
              }
              className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Timezone</label>
            <select
              value={preferences.timezone}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  timezone: e.target.value,
                })
              }
              className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="UTC">UTC</option>
              <option value="EST">EST</option>
              <option value="CST">CST</option>
              <option value="MST">MST</option>
              <option value="PST">PST</option>
            </select>
          </div>

          <button
            onClick={handleSavePreferences}
            disabled={loading}
            className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-primary-600/50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="h-5 w-5 text-neutral-600" />
          <h2 className="text-lg font-bold text-neutral-900">Security</h2>
        </div>

        <div className="space-y-4">
          <button className="w-full px-4 py-2 text-left text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium">
            Enable Two-Factor Authentication
          </button>

          <button className="w-full px-4 py-2 text-left text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium">
            View Active Sessions
          </button>

          <button className="w-full px-4 py-2 text-left text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
