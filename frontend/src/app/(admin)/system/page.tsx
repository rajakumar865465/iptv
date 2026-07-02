'use client';

import { useEffect, useState } from 'react';
import { getSystemHealth } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Database, Server, Cpu, RefreshCw,
  XCircle, Activity, HardDrive, Lock,
} from 'lucide-react';

function MetricCard({ title, value, sub, icon: Icon, color, border }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; border: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 border bg-slate-900/40 backdrop-blur-xl ${border}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

const MAINTENANCE_JOBS = [
  { key: 'dedupe-channels', label: 'Deduplicate Channels', desc: 'Merge channels with identical names' },
  { key: 'activate-channels', label: 'Activate Channels', desc: 'Promote best streams and update health' },
  { key: 'run-migrations', label: 'Run Migrations', desc: 'Apply pending database migrations' },
  { key: 'generate-report', label: 'Generate Report', desc: 'Produce current database health summary' },
  { key: 'run-all', label: 'Run All Jobs', desc: 'Run maintenance sequence on the server' },
];

type SystemHealth = {
  db?: { status?: string; timestamp?: string };
  server?: { uptime?: number; memory?: { heapUsed?: number; heapTotal?: number; rss?: number } };
  os?: { platform?: string; arch?: string; freeMemory?: number; totalMemory?: number };
  timestamp?: string;
};

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    getSystemHealth()
      .then((data) => setHealth(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHealth(); }, []);

  const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
  const uptime = health?.server?.uptime;
  const uptimeStr = uptime
    ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    : '-';

  const heapPct = health?.server?.memory
    ? Math.round(((health.server.memory.heapUsed || 0) / (health.server.memory.heapTotal || 1)) * 100)
    : 0;

  const osFreePct = health?.os
    ? Math.round(((health.os.freeMemory || 0) / (health.os.totalMemory || 1)) * 100)
    : 0;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            System Health
          </h1>
          <p className="text-slate-400 mt-1">Live metrics and server-side maintenance visibility.</p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : health ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Database"
              value={health.db?.status === 'connected' ? 'Connected' : 'Error'}
              sub={health.db?.timestamp ? `Last checked: ${new Date(health.db.timestamp).toLocaleTimeString()}` : undefined}
              icon={health.db?.status === 'connected' ? Database : XCircle}
              color={health.db?.status === 'connected' ? 'text-emerald-400' : 'text-rose-400'}
              border={health.db?.status === 'connected' ? 'border-emerald-500/20' : 'border-rose-500/20'}
            />
            <MetricCard
              title="Uptime"
              value={uptimeStr}
              sub="Node.js process"
              icon={Activity}
              color="text-cyan-400"
              border="border-cyan-500/20"
            />
            <MetricCard
              title="Heap Used"
              value={mb(health.server?.memory?.heapUsed || 0)}
              sub={`${heapPct}% of ${mb(health.server?.memory?.heapTotal || 0)} heap`}
              icon={Cpu}
              color={heapPct > 80 ? 'text-rose-400' : 'text-indigo-400'}
              border={heapPct > 80 ? 'border-rose-500/20' : 'border-indigo-500/20'}
            />
            <MetricCard
              title="System RAM"
              value={mb(health.os?.freeMemory || 0) + ' free'}
              sub={`${osFreePct}% available of ${mb(health.os?.totalMemory || 0)}`}
              icon={HardDrive}
              color={osFreePct < 20 ? 'text-orange-400' : 'text-slate-300'}
              border={osFreePct < 20 ? 'border-orange-500/20' : 'border-slate-700/50'}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/50">
              <Server className="w-4 h-4 text-slate-400" />
              <h3 className="font-bold text-slate-200">Server Info</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
              {[
                { label: 'Platform', value: health.os?.platform || '-' },
                { label: 'Architecture', value: health.os?.arch || '-' },
                { label: 'RSS Memory', value: mb(health.server?.memory?.rss || 0) },
                { label: 'Timestamp', value: health.timestamp ? new Date(health.timestamp).toLocaleString() : '-' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
                  <p className="text-slate-200 font-mono text-sm">{value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/50">
              <Lock className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="font-bold text-slate-200">Maintenance Jobs</h3>
                <p className="text-xs text-slate-500 mt-0.5">Run these from the server or internal endpoint with MAINTENANCE_SECRET.</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MAINTENANCE_JOBS.map((job) => (
                <div
                  key={job.key}
                  className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-200 text-sm">{job.label}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-1">
                      Server only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{job.desc}</p>
                  <p className="text-[11px] text-slate-600 font-mono mt-2">{job.key}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      ) : (
        <div className="text-center text-slate-500 py-16">Failed to load system health</div>
      )}
    </div>
  );
}