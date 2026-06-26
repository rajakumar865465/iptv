'use client';

import { useEffect, useState } from 'react';
import { getAppSettings, updateAppSettings } from '@/lib/api';

export default function AppSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppSettings()
      .then((data) => setSettings(data || {}))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await updateAppSettings(settings);
      alert('Saved');
    } catch {
      alert('Failed');
    }
  };

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">App Settings</h1>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
        {Object.entries(settings).map(([key, value]) => (
          <div key={key} className="flex items-center gap-4">
            <label className="w-48 text-sm font-medium text-gray-300">{key}</label>
            <input
              value={value}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              className="flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100"
            />
          </div>
        ))}
        <button onClick={handleSave} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Save</button>
      </div>
    </div>
  );
}
