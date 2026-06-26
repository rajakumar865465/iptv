'use client';

import { useEffect, useState } from 'react';
import { getSystemHealth } from '@/lib/api';

export default function SystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemHealth()
      .then((data) => setHealth(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Health</h1>
      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
            <h3 className="font-semibold mb-2">Database</h3>
            <p className="text-sm text-gray-400">Status: {health.db?.status}</p>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
            <h3 className="font-semibold mb-2">Server</h3>
            <p className="text-sm text-gray-400">Uptime: {Math.round(health.server?.uptime / 3600)}h</p>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
            <h3 className="font-semibold mb-2">Memory</h3>
            <p className="text-sm text-gray-400">RSS: {Math.round(health.server?.memory?.rss / 1024 / 1024)} MB</p>
          </div>
        </div>
      )}
    </div>
  );
}
