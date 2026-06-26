'use client';

import { useEffect, useState } from 'react';
import { getDevices, deleteDevice } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { MonitorSmartphone, Search, Trash2, Smartphone, Tablet, Monitor, RefreshCw } from 'lucide-react';

interface Device {
  id: string;
  device_name: string;
  device_id: string;
  user_name: string;
  user_email: string;
  platform: string;
  app_version: string;
  last_active_at: string;
  status: string;
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform?.toLowerCase() || '';
  if (p.includes('android')) return <Smartphone className="w-4 h-4 text-emerald-400" />;
  if (p.includes('ios')) return <Tablet className="w-4 h-4 text-blue-400" />;
  return <Monitor className="w-4 h-4 text-slate-400" />;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDevices = (q = '') => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (q) params.search = q;
    getDevices(params)
      .then((res: any) => {
        // API may return {data, pagination} or just array
        if (Array.isArray(res)) {
          setDevices(res);
          setTotal(res.length);
        } else {
          setDevices(res.data || []);
          setTotal(res.pagination?.total || res.data?.length || 0);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDevices(); }, []);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    fetchDevices(v);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this device from the system?')) return;
    setDeletingId(id);
    try {
      await deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      setTotal((t) => t - 1);
    } catch {
      alert('Failed to remove device');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Devices
          </h1>
          <p className="text-slate-400 mt-1">{total} registered device{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search devices…"
              className="pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-56"
            />
          </div>
          <button
            onClick={() => fetchDevices(search)}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Device</th>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Platform</th>
                  <th className="px-6 py-4 font-semibold">App Version</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Last Active</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                <AnimatePresence>
                  {devices.map((d) => (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <PlatformIcon platform={d.platform} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">{d.device_name || 'Unknown Device'}</p>
                            <p className="text-xs text-slate-500 font-mono">{d.device_id?.slice(0, 16)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-300">{d.user_name || '—'}</p>
                        <p className="text-xs text-slate-500">{d.user_email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={d.platform} />
                          <span className="text-slate-300 capitalize">{d.platform || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{d.app_version || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          d.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-slate-700 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {devices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <MonitorSmartphone className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No devices registered
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
