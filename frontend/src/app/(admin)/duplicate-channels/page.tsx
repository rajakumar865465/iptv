'use client';

import { useEffect, useState } from 'react';
import { getDuplicateChannels, mergeDuplicates } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FileStack, RefreshCw, GitMerge, ChevronDown, ChevronUp, Tv } from 'lucide-react';

export default function DuplicateChannelsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [masterIds, setMasterIds] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);

  const fetchDuplicates = () => {
    setLoading(true);
    getDuplicateChannels()
      .then((data: any) => {
        const g = data?.groups || data || [];
        setGroups(g);
        setTotal(data?.total_groups || g.length);
        // Default master = first channel in each group
        const defaults: Record<string, string> = {};
        g.forEach((gr: any) => { if (gr.channels?.[0]) defaults[gr.canonical_name] = gr.channels[0].id; });
        setMasterIds(defaults);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDuplicates(); }, []);

  const handleMerge = async (g: any) => {
    const masterId = masterIds[g.canonical_name] || g.channels[0]?.id;
    const dupIds = g.channels.filter((c: any) => c.id !== masterId).map((c: any) => c.id);
    if (!dupIds.length) return alert('Select a different master — all others will be merged into it.');
    if (!confirm(`Merge ${dupIds.length} duplicate(s) into channel #${masterId}?\nThis marks duplicates as merged and migrates their streams.`)) return;
    setMerging(g.canonical_name);
    try {
      await mergeDuplicates({ masterId, duplicateIds: dupIds });
      setGroups((prev) => prev.filter((gr) => gr.canonical_name !== g.canonical_name));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Merge failed');
    } finally { setMerging(null); }
  };

  const HEALTH_CLS: Record<string, string> = {
    online: 'text-emerald-400', offline: 'text-rose-400', unstable: 'text-amber-400',
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Duplicate Channels</h1>
          <p className="text-slate-400 mt-1">{total} duplicate group{total !== 1 ? 's' : ''} found</p>
        </div>
        <button onClick={fetchDuplicates} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {groups.map((g) => {
              const isOpen = expanded[g.canonical_name];
              const masterId = masterIds[g.canonical_name];
              return (
                <motion.div key={g.canonical_name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                  <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, [g.canonical_name]: !isOpen }))}>
                    <div className="flex items-center gap-3 min-w-0">
                      <FileStack className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 truncate">{g.canonical_name}</p>
                        <p className="text-xs text-slate-500">{g.count} duplicates · {g.language || '—'} · {g.category || 'No category'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMerge(g); }}
                        disabled={merging === g.canonical_name}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        {merging === g.canonical_name ? 'Merging…' : 'Merge'}
                      </button>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-slate-700/50">
                        <div className="p-4 space-y-2">
                          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Select master channel (others will be merged into it)</p>
                          {g.channels?.map((c: any) => (
                            <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${masterId === c.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70'}`}>
                              <input type="radio" name={`master-${g.canonical_name}`} value={c.id} checked={masterId === c.id} onChange={() => setMasterIds(prev => ({ ...prev, [g.canonical_name]: c.id }))} className="accent-cyan-500" />
                              <Tv className="w-4 h-4 text-slate-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                                <p className="text-xs text-slate-500 font-mono truncate">{c.stream_url}</p>
                              </div>
                              <span className={`text-xs font-bold uppercase ${HEALTH_CLS[c.health_status] || 'text-slate-500'}`}>{c.health_status || 'unknown'}</span>
                              {masterId === c.id && <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">MASTER</span>}
                            </label>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {groups.length === 0 && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-12 text-center">
              <FileStack className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No duplicate channels found. Your library is clean!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
