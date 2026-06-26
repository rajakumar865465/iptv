'use client';

import { useEffect, useState, useRef } from 'react';
import { getScanHistory, triggerScan } from '@/lib/api';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Play, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface ScanJob {
  id: string;
  status: string;
  total_channels: number;
  completed_channels: number;
  failed_channels: number;
  results: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

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
  const [history, setHistory] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ScanJob | null>(null);
  const [scope, setScope] = useState('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = () =>
    getScanHistory()
      .then((data) => setHistory(data || []))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchHistory();
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
          fetchHistory();
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

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Stream Scanner
          </h1>
          <p className="text-slate-400 mt-1">Probe stream URLs and update health status in real time.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={running}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
          >
            <option value="all">All Streams</option>
            <option value="offline">Offline Only</option>
            <option value="unknown">Unknown Only</option>
          </select>
          <button
            onClick={handleScan}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-60"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Scanning…' : 'Start Scan'}
          </button>
        </div>
      </div>

      {/* Live progress card */}
      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Radar className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h3 className="font-bold text-slate-200">Scan in progress…</h3>
              {activeJob && <StatusBadge status={activeJob.status} />}
            </div>
            {activeJob ? (
              <>
                <ProgressBar
                  total={activeJob.total_channels}
                  completed={activeJob.completed_channels}
                  failed={activeJob.failed_channels}
                />
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <span className="text-emerald-400">✓ {activeJob.completed_channels} online</span>
                  <span className="text-rose-400">✗ {activeJob.failed_channels} failed</span>
                  <span>/ {activeJob.total_channels} total</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 animate-pulse">Initialising scan job…</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-200">Scan History</h3>
            <button onClick={fetchHistory} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-3 font-semibold">Job ID</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Progress</th>
                  <th className="px-6 py-3 font-semibold">Online / Failed</th>
                  <th className="px-6 py-3 font-semibold">Started</th>
                  <th className="px-6 py-3 font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {history.map((h) => {
                  const duration = h.started_at && h.completed_at
                    ? Math.round((new Date(h.completed_at).getTime() - new Date(h.started_at).getTime()) / 1000)
                    : null;
                  return (
                    <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-400 text-xs">#{h.id}</td>
                      <td className="px-6 py-4"><StatusBadge status={h.status} /></td>
                      <td className="px-6 py-4 w-36">
                        <ProgressBar
                          total={h.total_channels}
                          completed={h.completed_channels}
                          failed={h.failed_channels}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-emerald-400 font-semibold">{h.completed_channels}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400 font-semibold">{h.failed_channels}</span>
                        <span className="text-slate-500 text-xs ml-1">of {h.total_channels}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{h.started_at ? new Date(h.started_at).toLocaleString() : '—'}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{duration !== null ? `${duration}s` : '—'}</td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Radar className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No scans run yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
