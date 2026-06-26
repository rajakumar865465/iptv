'use client';

import { useEffect, useState } from 'react';
import { getDevices, deleteDevice } from '@/lib/api';

interface Device {
  id: string;
  device_name: string;
  user_name: string;
  user_email: string;
  platform: string;
  app_version: string;
  last_active_at: string;
  status: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDevices()
      .then((res) => setDevices(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this device?')) return;
    try {
      await deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert('Failed');
    }
  };

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Devices</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400">Device</th>
              <th className="px-4 py-3 text-left text-gray-400">User</th>
              <th className="px-4 py-3 text-left text-gray-400">Platform</th>
              <th className="px-4 py-3 text-left text-gray-400">Version</th>
              <th className="px-4 py-3 text-left text-gray-400">Last Active</th>
              <th className="px-4 py-3 text-right text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3">{d.device_name}</td>
                <td className="px-4 py-3 text-gray-400">{d.user_name || d.user_email}</td>
                <td className="px-4 py-3 text-gray-400">{d.platform}</td>
                <td className="px-4 py-3 text-gray-400">{d.app_version}</td>
                <td className="px-4 py-3 text-gray-400">{d.last_active_at ? new Date(d.last_active_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(d.id)} className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {devices.length === 0 && <p className="p-6 text-gray-500 text-center">No devices</p>}
      </div>
    </div>
  );
}
