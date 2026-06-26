'use client';

import { useEffect, useState } from 'react';
import { getDuplicateChannels, mergeDuplicates } from '@/lib/api';

export default function DuplicateChannelsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDuplicateChannels()
      .then((data) => setGroups(data.groups || []))
      .finally(() => setLoading(false));
  }, []);

  const handleMerge = async (masterId: string, dupIds: string[]) => {
    try {
      await mergeDuplicates({ masterId, duplicateIds: dupIds });
      alert('Merged');
    } catch {
      alert('Failed');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Duplicate Channels</h1>
      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading...</div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.canonical_name} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{g.canonical_name} ({g.count} duplicates)</h3>
                <button onClick={() => handleMerge(g.channels[0]?.id, g.channels.slice(1).map((c: any) => c.id))} className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white">Merge</button>
              </div>
              <div className="text-sm text-gray-400">
                {g.channels.map((c: any) => (
                  <div key={c.id}>{c.name} — {c.health_status}</div>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-gray-500">No duplicates found</p>}
        </div>
      )}
    </div>
  );
}
