'use client';

import { useEffect, useRef, useState } from 'react';
import { getDuplicateChannels, mergeDuplicates } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FileStack, RefreshCw, GitMerge, ChevronDown, ChevronUp, Tv, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface Channel { id: string; name: string; stream_url: string; health_status: string; quality: string; }
interface Group { canonical_name: string; count: number; channels: Channel[]; language?: string; category?: string; }

interface Toast { id: number; message: string; type: 'success' | 'error'; }

const HEALTH_CLS: Record<string, string> = {
  online:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  offline:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  unstable: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

function ConfirmMergeModal({
  open, group, masterId, onConfirm, onCancel,
}: {
  open: boolean; group: Group | null; masterId: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !group) return null;
  const master = group.channels.find(c => c.id === masterId);
  const dupes = group.channels.filter(c => c.id !== masterId);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-blue-600" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Confirm Merge</h3>
              <p className="text-xs text-slate-500">{group.canonical_name}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
              <p className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">Keep as Master</p>
              <div className="flex items-center gap-2">
                <Tv className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <p className="text-sm font-medium text-slate-200 truncate">{master?.name || '—'}</p>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold border ${HEALTH_CLS[master?.health_status || ''] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>{master?.health_status || 'unknown'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-2">Will be merged & removed ({dupes.length})</p>
              <div className="space-y-1.5">
                {dupes.map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <Tv className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <p className="text-xs text-slate-400 truncate">{d.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center">Duplicate channels will be marked merged and their streams migrated to the master.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500">
              Merge {dupes.length} Channel{dupes.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DuplicateChannelsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [masterIds, setMasterIds] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<Group | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const fetchDuplicates = () => {
    setLoading(true);
    getDuplicateChannels()
      .then((data: any) => {
        const g: Group[] = data?.groups || data || [];
        setGroups(g);
        setTotal(data?.total_groups ?? g.length);
        const defaults: Record<string, string> = {};
        g.forEach((gr) => { if (gr.channels?.[0]) defaults[gr.canonical_name] = gr.channels[0].id; });
        setMasterIds(defaults);
      })
      .catch(() => showToast('Failed to load duplicates', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDuplicates(); }, []);

  const requestMerge = (g: Group) => {
    const masterId = masterIds[g.canonical_name];
    const dupes = g.channels.filter(c => c.id !== masterId);
    if (!dupes.length) { showToast('All channels are set as master — change the master selection first', 'error'); return; }
    setConfirmGroup(g);
  };

  const executeMerge = async () => {
    if (!confirmGroup) return;
    const g = confirmGroup;
    setConfirmGroup(null);
    const masterId = masterIds[g.canonical_name] || g.channels[0]?.id;
    const dupIds = g.channels.filter(c => c.id !== masterId).map(c => c.id);
    setMerging(g.canonical_name);
    try {
      await mergeDuplicates({ masterId, duplicateIds: dupIds });
      setGroups(prev => prev.filter(gr => gr.canonical_name !== g.canonical_name));
      setTotal(prev => prev - 1);
      showToast(`"${g.canonical_name}" merged successfully`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Merge failed', 'error');
    } finally { setMerging(null); }
  };

  const toggleExpand = (name: string) =>
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="space-y-6 pb-10">
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              {t.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="text-sm font-medium">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmGroup && (
          <ConfirmMergeModal
            open={!!confirmGroup}
            group={confirmGroup}
            masterId={masterIds[confirmGroup.canonical_name] || confirmGroup.channels[0]?.id}
            onConfirm={executeMerge}
            onCancel={() => setConfirmGroup(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Duplicate Channels</h1>
          <p className="text-slate-400 mt-1">{total} duplicate group{total !== 1 ? 's' : ''} found</p>
        </div>
        <button onClick={fetchDuplicates} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-all self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {groups.map((g) => {
              const isOpen = expanded[g.canonical_name];
              const masterId = masterIds[g.canonical_name];
              const isMerging = merging === g.canonical_name;

              return (
                <motion.div key={g.canonical_name} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden">

                  {/* Group Header */}
                  <div className="flex items-center justify-between p-5 cursor-pointer select-none"
                    onClick={() => toggleExpand(g.canonical_name)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                        <FileStack className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 truncate">{g.canonical_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-rose-400">{g.count} duplicate{g.count !== 1 ? 's' : ''}</span>
                          {g.language && <span className="text-xs text-slate-500">· {g.language}</span>}
                          {g.category && <span className="text-xs text-slate-500">· {g.category}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <button onClick={(e) => { e.stopPropagation(); requestMerge(g); }} disabled={isMerging}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-sm">
                        <GitMerge className={`w-3.5 h-3.5 ${isMerging ? 'animate-spin' : ''}`} />
                        {isMerging ? 'Merging…' : 'Merge'}
                      </button>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>

                  {/* Expanded Channel List */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden border-t border-slate-700/50">
                        <div className="p-4 space-y-2">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Select master — duplicates will be merged into it
                          </p>
                          {g.channels?.map((c) => (
                            <label key={c.id} onClick={(e) => e.stopPropagation()}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                masterId === c.id
                                  ? 'bg-cyan-500/10 border border-cyan-500/30'
                                  : 'bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70'
                              }`}>
                              <input type="radio" name={`master-${g.canonical_name}`} value={c.id}
                                checked={masterId === c.id}
                                onChange={() => setMasterIds(prev => ({ ...prev, [g.canonical_name]: c.id }))}
                                className="accent-cyan-500 shrink-0" />
                              <Tv className="w-4 h-4 text-slate-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                                <p className="text-xs text-slate-500 font-mono truncate">{c.stream_url || 'No stream URL'}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {c.quality && <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{c.quality}</span>}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${HEALTH_CLS[c.health_status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                  {c.health_status || 'unknown'}
                                </span>
                                {masterId === c.id && (
                                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">MASTER</span>
                                )}
                              </div>
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
              <FileStack className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-lg font-semibold text-slate-400 mb-1">Library is clean</p>
              <p className="text-slate-500 text-sm">No duplicate channels found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
