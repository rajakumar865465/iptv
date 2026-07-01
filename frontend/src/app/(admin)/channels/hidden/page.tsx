'use client';

import { useState, useEffect } from 'react';
import { getHiddenChannels, restoreChannel } from '@/lib/api';
import { EyeOff, RefreshCw, Undo2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HiddenChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHidden = async () => {
    setLoading(true);
    try {
      const data = await getHiddenChannels();
      setChannels(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHidden();
  }, []);

  const handleRestore = async (id: string) => {
    if (!confirm('Are you sure you want to restore this channel? It will be visible in the app again.')) return;
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
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <EyeOff className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Hidden Channels</h1>
            <p className="text-sm text-slate-400">Channels that are temporarily hidden from the public API</p>
          </div>
        </div>
        <button onClick={fetchHidden} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-200">
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
                <th className="px-4 py-3 font-medium">Hidden Reason</th>
                <th className="px-4 py-3 font-medium">Hidden At</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {channels.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No hidden channels found</td></tr>
              ) : channels.map((c) => (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={c.id} className="text-sm text-slate-300 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? <img src={c.logo_url} alt="" className="w-8 h-8 rounded bg-slate-800 object-contain" /> : <div className="w-8 h-8 rounded bg-slate-800" />}
                      <span className="font-semibold text-slate-200">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-slate-300">{c.category_name}</div>
                    <div className="text-slate-500">{c.language}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-amber-400/80 italic max-w-xs truncate">
                    {c.hidden_reason || 'No reason provided'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.hidden_at ? new Date(c.hidden_at).toLocaleString() : '-'}
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
