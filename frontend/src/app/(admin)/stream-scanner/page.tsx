'use client';

import { useEffect, useState, useRef } from 'react';
import { getScanHistory, triggerScan, getBrokenChannels, fixBrokenChannel, verifyBrokenChannel, bulkActionBrokenChannels } from '@/lib/api';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Play, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Filter, Tv, EyeOff, ShieldCheck, SquareCheck, Search, Link as LinkIcon, Download } from 'lucide-react';
import Image from 'next/image';

const HEALTH_OPTIONS = ['', 'offline', 'unstable', 'error', 'timeout', 'forbidden_403', 'geo_blocked', 'needs_review'];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { cls: string; icon: React.ReactNode }> = {
    pending: { cls: 'bg-slate-800 text-slate-400 border-slate-700', icon: <Clock className="w-3 h-3" /> },
    running: { cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    completed: { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: <XCircle className="w-3 h-3" /> },
  };
  const s = styles[status] || styles.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.cls}`}>
      {s.icon} {status}
    </span>
  );
}

function HealthBadge({ status, needsReview }: { status: string, needsReview?: boolean }) {
  if (needsReview) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
        <ShieldCheck className="w-3 h-3" /> Needs Review
      </span>
    );
  }
  const styles: Record<string, string> = {
    offline: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    unstable: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    timeout: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    forbidden_403: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    geo_blocked: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    online: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status || 'unknown'}
    </span>
  );
}

function ProgressBar({ total, completed, failed }: { total: number; completed: number; failed: number }) {
  if (!total) return null;
  const pct = Math.round(((completed + failed) / total) * 100);
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{pct}%</span>
        <span>{completed + failed}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function StreamScannerPage() {
  const [running, setRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<unknown | null>(null);
  const [scope, setScope] = useState('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [channels, setChannels] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [healthFilter, setHealthFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hide Modal State
  const [hideModalId, setHideModalId] = useState<string | null>(null);
  const [hideReason, setHideReason] = useState('Broken stream');
  const [adminNote, setAdminNote] = useState('');
  const [preventReimport, setPreventReimport] = useState(true);

  // Verify Modal State
  const [verifyModalId, setVerifyModalId] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState('online');
  const [verifyNote, setVerifyNote] = useState('');

  const fetchChannels = (health = healthFilter, q = search) => {
    setLoading(true);
    const params: Record<string, string> = { sort: 'recent' };
    if (health) params.status = health;
    if (q) params.search = q;
    getBrokenChannels(params)
      .then((res) => {
        setChannels(res.data || []);
        setTotal(res.pagination?.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchChannels());
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/scanner/${jobId}`);
        const job = res.data.data;
        setActiveJob(job);
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setRunning(false);
          fetchChannels();
        }
      } catch {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setRunning(false);
      }
    }, 2000);
  };

  const handleScan = async () => {
    setRunning(true);
    try {
      const data = await triggerScan({ scope });
      setActiveJobId(data.jobId);
      setActiveJob(null);
      startPolling(data.jobId);
    } catch {
      alert('Failed to start scan');
      setRunning(false);
    }
  };

  const handleFix = async (id: string) => {
    try {
      await fixBrokenChannel(id);
      setChannels(prev => prev.filter(c => c.id !== id));
    } catch { alert('Failed to mark channel for re-check'); }
  };

  const handleVerifySubmit = async () => {
    if (!verifyModalId) return;
    try {
      await verifyBrokenChannel(verifyModalId, { status: verifyStatus, note: verifyNote });
      setVerifyModalId(null);
      fetchChannels();
    } catch { alert('Failed to verify channel'); }
  };

  const handleHideSubmit = async () => {
    if (!hideModalId) return;
    try {
      await api.post(`/channels/${hideModalId}/hide`, { reason: hideReason, admin_note: adminNote, prevent_reimport: preventReimport });
      setHideModalId(null);
      setChannels(prev => prev.filter(c => c.id !== hideModalId));
    } catch { alert('Failed to hide channel'); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === channels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(channels.map(c => c.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    const reason = prompt(`Enter reason for bulk ${action} (optional):`);
    try {
      await bulkActionBrokenChannels({ ids: Array.from(selectedIds), action, reason });
      setSelectedIds(new Set());
      fetchChannels();
    } catch { alert('Bulk action failed'); }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Status', 'Failures', 'URL'];
    const rows = channels.map(c => [c.id, c.name, c.health_status, c.fail_count, c.stream_url]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'broken-channels.csv';
    a.click();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Scanner Header & Job Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Scanner & Broken Channels
          </h1>
          <p className="text-slate-400 mt-1">Deep-scan channels and manually verify broken streams.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={running}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm focus:outline-none"
          >
            <option value="all">All Channels</option>
            <option value="visible">Visible Only</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
            <option value="unstable">Unstable Only</option>
            <option value="unknown">Unknown Only</option>
          </select>
          <button
            onClick={handleScan}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-all disabled:opacity-60"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Scanning…' : 'Start Deep Scan'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Radar className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h3 className="font-bold text-slate-200">Deep Scan in progress…</h3>
              {activeJob && <StatusBadge status={activeJob.status} />}
            </div>
            {activeJob ? (
              <>
                <ProgressBar total={activeJob.total_channels} completed={activeJob.completed_channels} failed={activeJob.failed_channels} />
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <span className="text-emerald-400">✓ {activeJob.completed_channels} online</span>
                  <span className="text-rose-400">✗ {activeJob.failed_channels} failed</span>
                  <span>/ {activeJob.total_channels} total</span>
                </div>
              </>
            ) : <p className="text-sm text-slate-400 animate-pulse">Initialising scan job…</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broken Channels Data Table */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" /> Action Required ({total})
            </h3>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-slate-400">{selectedIds.size} selected</span>
                <button onClick={() => handleBulkAction('recheck')} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300">Recheck</button>
                <button onClick={() => handleBulkAction('hide')} className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-400">Hide</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => fetchChannels(healthFilter, e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 text-slate-200 w-48"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={healthFilter}
                onChange={(e) => fetchChannels(e.target.value, search)}
                className="bg-transparent text-sm text-slate-300 focus:outline-none pr-1"
              >
                <option value="">All Issues</option>
                {HEALTH_OPTIONS.filter(Boolean).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <button onClick={exportCSV} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors" title="Export CSV">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4"><input type="checkbox" onChange={toggleSelectAll} checked={channels.length > 0 && selectedIds.size === channels.length} className="rounded bg-slate-800 border-slate-600" /></th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Status & Note</th>
                  <th className="px-6 py-4">Failures</th>
                  <th className="px-6 py-4">URL</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {channels.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={(e) => {
                        const newSet = new Set(selectedIds);
                        e.target.checked ? newSet.add(c.id) : newSet.delete(c.id);
                        setSelectedIds(newSet);
                      }} className="rounded bg-slate-800 border-slate-600" />
                    </td>
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
                      <div className="flex flex-col items-start gap-1">
                        <HealthBadge status={c.health_status} needsReview={c.needs_manual_verification} />
                        {c.admin_note && <span className="text-[10px] text-slate-400 max-w-[150px] truncate" title={c.admin_note}>📝 {c.admin_note}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-rose-400 font-semibold">{c.fail_count || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 group/url">
                        <span className="text-slate-500 font-mono text-xs w-32 truncate" title={c.stream_url}>
                          {c.stream_url ? c.stream_url : 'No Stream URL'}
                        </span>
                        {c.stream_url && (
                          <button onClick={() => { navigator.clipboard.writeText(c.stream_url); alert('Copied'); }} className="opacity-0 group-hover/url:opacity-100 p-1 bg-slate-800 rounded hover:bg-slate-700 text-slate-400 transition-all">
                            <LinkIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button onClick={() => handleFix(c.id)} className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" /> Re-check
                      </button>
                      <button onClick={() => setVerifyModalId(c.id)} className="px-2.5 py-1.5 bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 rounded-lg text-xs font-semibold text-indigo-400 flex items-center gap-1.5 transition-colors">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verify
                      </button>
                      <button onClick={() => setHideModalId(c.id)} className="px-2.5 py-1.5 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 rounded-lg text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-colors">
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </button>
                    </td>
                  </tr>
                ))}
                {channels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No channels require attention
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VERIFY MODAL */}
      <AnimatePresence>
        {verifyModalId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-lg text-slate-200">Manual Verification</h3>
                <button onClick={() => setVerifyModalId(null)} className="text-slate-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Verified Status</label>
                  <select value={verifyStatus} onChange={(e) => setVerifyStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none">
                    <option value="online">Online / Working</option>
                    <option value="unstable">Unstable / Buffering</option>
                    <option value="offline">Offline / Broken</option>
                    <option value="geo_blocked">Geo-blocked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Note (Optional)</label>
                  <textarea value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} placeholder="e.g., Works in VLC, but not ExoPlayer" rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none" />
                </div>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                <button onClick={() => setVerifyModalId(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">Cancel</button>
                <button onClick={handleVerifySubmit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors">Save Verification</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIDE MODAL */}
      <AnimatePresence>
        {hideModalId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-lg text-rose-400 flex items-center gap-2"><EyeOff className="w-5 h-5" /> Hide Channel</h3>
                <button onClick={() => setHideModalId(null)} className="text-slate-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-400">Hiding this channel will instantly remove it from the App and Website API, but retain it in the database.</p>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Reason Category</label>
                  <select value={hideReason} onChange={(e) => setHideReason(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none">
                    <option value="Broken stream">Broken stream</option>
                    <option value="Geo-blocked completely">Geo-blocked completely</option>
                    <option value="Duplicate channel">Duplicate channel</option>
                    <option value="Copyright takedown">Copyright takedown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Note (Details)</label>
                  <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Additional context..." rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none" />
                </div>
                <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                  <input type="checkbox" checked={preventReimport} onChange={(e) => setPreventReimport(e.target.checked)} className="rounded bg-slate-900 border-slate-600 w-4 h-4 text-rose-500 focus:ring-rose-500/30" />
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Prevent Re-import</div>
                    <div className="text-xs text-slate-500">{"Add to blocklist so M3U updates don't restore it"}</div>
                  </div>
                </label>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                <button onClick={() => setHideModalId(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">Cancel</button>
                <button onClick={handleHideSubmit} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-colors">Hide Channel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

