'use client';

import { useEffect, useState } from 'react';
import { getBrokenChannels } from '@/lib/api';

export default function BrokenChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrokenChannels()
      .then((res) => setChannels(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Broken Channels</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400">Name</th>
              <th className="px-4 py-3 text-left text-gray-400">Health</th>
              <th className="px-4 py-3 text-left text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-gray-400">Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-gray-400">{c.health_status}</td>
                <td className="px-4 py-3 text-gray-400">{c.status}</td>
                <td className="px-4 py-3 text-gray-400">{c.last_checked_at ? new Date(c.last_checked_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {channels.length === 0 && <p className="p-6 text-gray-500 text-center">No broken channels</p>}
      </div>
    </div>
  );
}
