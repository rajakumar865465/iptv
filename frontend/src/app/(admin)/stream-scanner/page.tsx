'use client';

import { useEffect, useState } from 'react';
import { getScanHistory, triggerScan } from '@/lib/api';

export default function StreamScannerPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScanHistory()
      .then((data) => setHistory(data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleScan = async () => {
    try {
      await triggerScan();
      alert('Scan triggered');
    } catch {
      alert('Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stream Scanner</h1>
        <button onClick={handleScan} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700">Run Scan</button>
      </div>
      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading...</div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray- overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-gray-400">ID</th>
                <th className="px-4 py-3 text-left text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-gray-400">Total</th>
                <th className="px-4 py-3 text-left text-gray-400">Completed</th>
                <th className="px-4 py-3 text-left text-gray-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="px-4 py-3">{h.id}</td>
                  <td className="px-4 py-3 text-gray-400">{h.status}</td>
                  <td className="px-4 py-3 text-gray-400">{h.total_channels}</td>
                  <td className="px-4 py-3 text-gray-400">{h.completed_channels}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <p className="p-6 text-gray-500 text-center">No scan history</p>}
        </div>
      )}
    </div>
  );
}
