'use client';

import { useEffect, useState } from 'react';
import { getHiddenChannels, restoreChannel, restoreAllHiddenChannels } from '@/lib/api';
import { Tv, RefreshCw, EyeOff, AlertTriangle } from 'lucide-react';

interface HiddenChannel {
  id: string;
  name: string;
  logo_url: string;
  category_name: string;
  hidden_reason: string;
  admin_note: string;
  hidden_at: string;
}

export default function HiddenChannelsPage() {
  const [channels, setChannels] = useState<HiddenChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoringAll, setRestoringAll] = useState(false);

  const fetchHidden = () => {
    setLoading(true);
    getHiddenChannels()
      .then((data) => setChannels(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHidden(); }, []);

  const handleRestore = async (id: string) => {
    if (!confirm('Restore this channel to public view?')) return;
    setRestoring(id);
    try {
      await restoreChannel(id, true);
      setChannels(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Failed to restore channel');
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreAll = async () => {
    if (!confirm('Are you sure you want to restore ALL hidden channels?')) return;
    setRestoringAll(true);
    try {
      await restoreAllHiddenChannels();
      setChannels([]);
    } catch {
      alert('Failed to restore all channels');
    } finally {
      setRestoringAll(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-purple-400">
            Hidden Channels
          </h1>
          <p className="text-slate-400 mt-1">
            Channels hidden from the API and Website but retained in the database.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {channels.length > 0 && (
            <button 
              onClick={handleRestoreAll} 
              disabled={restoringAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-medium transition-colors disabled:opacity-50"
            >
              {restoringAll ? 'Restoring All...' : 'Restore All'}
            </button>
          )}
          <button onClick={fetchHidden} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Channel</th>
                  <th className="px-6 py-4 font-semibold">Hidden Reason</th>
                  <th className="px-6 py-4 font-semibold">Admin Note</th>
                  <th className="px-6 py-4 font-semibold">Hidden At</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {channels.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" className="w-8 h-8 rounded-md object-contain bg-black/50 p-1" />
                        ) : <Tv className="w-8 h-8 p-1.5 rounded-md bg-slate-800 text-slate-500" />}
                        <div>
                          <div className="font-medium text-slate-200">{c.name}</div>
                          <div className="text-[10px] text-slate-500">{c.category_name || 'Uncategorized'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold uppercase tracking-wide">
                        {c.hidden_reason || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate" title={c.admin_note}>
                      {c.admin_note || '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {c.hidden_at ? new Date(c.hidden_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRestore(c.id)}
                        disabled={restoring === c.id}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-emerald-400 transition-colors disabled:opacity-50"
                      >
                        {restoring === c.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
                {channels.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <EyeOff className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No hidden channels
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
