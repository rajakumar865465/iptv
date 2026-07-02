'use client';

import { useState, useEffect } from 'react';
import { getRemovedChannels, restoreChannel } from '@/lib/api';
import { Trash, RefreshCw, Undo2 } from 'lucide-react';
import { motion } from 'framer-motion';

type RemovedChannel = {
  id: string;
  name: string;
  logo_url?: string;
  category_name?: string;
  language?: string;
  removed_reason?: string;
  removed_at?: string;
};
export default function RemovedChannelsPage() {
  const [channels, setChannels] = useState<RemovedChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRemoved = async () => {
    setLoading(true);
    try {
      const data = await getRemovedChannels();
      setChannels((data || []) as RemovedChannel[]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchRemoved());
  }, []);

  const handleRestore = async (id: string) => {
    if (!confirm('Are you sure you want to restore this removed channel? It will be visible in the app again.')) return;
    try {
      await restoreChannel(id, true);
      setChannels(channels.filter(c => c.id !== id));
    } catch (err) {
      alert('Failed to restore channel');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
            <Trash className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Removed Channels</h1>
            <p className="text-sm text-slate-400">Channels soft-deleted from the public API and prevented from auto-import</p>
          </div>
        </div>
        <button onClick={fetchRemoved} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-200">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Category / Lang</th>
                <th className="px-4 py-3 font-medium">Removed Reason</th>
                <th className="px-4 py-3 font-medium">Removed At</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {channels.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No removed channels found</td></tr>
              ) : channels.map((c) => (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={c.id} className="text-sm text-slate-300 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? <img src={c.logo_url} alt="" className="w-8 h-8 rounded bg-slate-800 object-contain opacity-50 grayscale" /> : <div className="w-8 h-8 rounded bg-slate-800 opacity-50" />}
                      <span className="font-semibold text-slate-200 line-through opacity-70">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs opacity-70">
                    <div className="text-slate-300">{c.category_name}</div>
                    <div className="text-slate-500">{c.language}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-rose-400/80 italic max-w-xs truncate">
                    {c.removed_reason || 'No reason provided'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.removed_at ? new Date(c.removed_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRestore(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition-colors">
                      <Undo2 className="w-3.5 h-3.5" /> Restore
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

