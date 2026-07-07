'use client';

import { useEffect, useState } from 'react';
import { getBrokenChannels, fixBrokenChannel } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Filter, Tv } from 'lucide-react';

const HEALTH_OPTIONS = ['', 'offline', 'unstable', 'error', 'timeout', 'forbidden_403', 'geo_blocked'];

function HealthBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    offline: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    unstable: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    timeout: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    forbidden_403: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    geo_blocked: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status || 'unknown'}
    </span>
  );
}

interface BrokenChannel {
  id: string;
  name: string;
  health_status: string;
  status: string;
  fail_count: number;
  last_checked_at: string | null;
  stream_count: number;
}

export default function BrokenChannelsPage() {
  const [channels, setChannels] = useState<BrokenChannel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [healthFilter, setHealthFilter] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  const fetchChannels = (health = healthFilter) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (health) params.status = health;
    getBrokenChannels(params)
      .then((res) => {
        setChannels(res.data || []);
        setTotal(res.pagination?.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchChannels(); }, []);

  const handleFilter = (v: string) => {
    setHealthFilter(v);
    fetchChannels(v);
  };

  const handleFix = async (id: string) => {
    setFixing(id);
    try {
      await fixBrokenChannel(id);
      setFixedIds((prev) => new Set([...prev, id]));
      // Remove from list after short delay
      setTimeout(() => {
        setChannels((prev) => prev.filter((c) => c.id !== id));
      }, 800);
    } catch {
      alert('Failed to mark channel for re-check');
    } finally {
      setFixing(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-orange-400">
            Broken Channels
          </h1>
          <p className="text-slate-400 mt-1">
            {total} channel{total !== 1 ? 's' : ''} with streaming issues.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={healthFilter}
              onChange={(e) => handleFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-300 focus:outline-none pr-1"
            >
              <option value="">All issues</option>
              {HEALTH_OPTIONS.filter(Boolean).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fetchChannels()}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Channel</th>
                  <th className="px-6 py-4 font-semibold">Health</th>
                  <th className="px-6 py-4 font-semibold">Failures</th>
                  <th className="px-6 py-4 font-semibold">Streams</th>
                  <th className="px-6 py-4 font-semibold">Last Checked</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                <AnimatePresence>
                  {channels.map((c) => (
                    <motion.tr
                      key={c.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: fixedIds.has(c.id) ? 0.4 : 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Tv className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="font-medium text-slate-200">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><HealthBadge status={c.health_status} /></td>
                      <td className="px-6 py-4">
                        <span className="text-rose-400 font-semibold">{c.fail_count || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{c.stream_count || 0}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {c.last_checked_at ? new Date(c.last_checked_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleFix(c.id)}
                          disabled={fixing === c.id || fixedIds.has(c.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 border border-slate-700 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${fixing === c.id ? 'animate-spin' : ''}`} />
                          {fixedIds.has(c.id) ? 'Queued' : 'Re-check'}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {channels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No broken channels found{healthFilter ? ` with filter "${healthFilter}"` : ''}
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
