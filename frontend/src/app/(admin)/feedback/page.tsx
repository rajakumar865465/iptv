'use client';

import { useEffect, useState, useMemo } from 'react';
import { getFeedback, updateFeedback, getErrorMessage } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquareWarning, Search, X, ChevronDown, CheckCircle2,
  Eye, Clock, Smartphone, Monitor, Globe, RefreshCw,
} from 'lucide-react';

interface DeviceInfo {
  platform?: string;
  os_version?: string;
  device_model?: string;
  sdk?: number;
}

interface FeedbackItem {
  id: number;
  category: string;
  description: string;
  device_info: DeviceInfo | null;
  app_version: string | null;
  platform: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  admin_note: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
}

// ── colours ──────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  pending:  'bg-amber-500/10  text-amber-400  border-amber-500/20',
  reviewed: 'bg-cyan-500/10   text-cyan-400   border-cyan-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const CATEGORY_CLS: Record<string, string> = {
  'App Crash':      'bg-rose-500/10   text-rose-400   border-rose-500/20',
  'Playback Issue': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Login Issue':    'bg-amber-500/10  text-amber-400  border-amber-500/20',
  'Payment Issue':  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Other':          'bg-slate-500/10  text-slate-400  border-slate-500/20',
};

const CATEGORIES = ['All', 'App Crash', 'Playback Issue', 'Login Issue', 'Payment Issue', 'Other'];
const STATUSES   = ['All', 'pending', 'reviewed', 'resolved'];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function PlatformIcon({ platform }: { platform: string | null }) {
  if (platform === 'android' || platform === 'ios') return <Smartphone size={13} className="inline mr-1" />;
  if (platform === 'web') return <Globe size={13} className="inline mr-1" />;
  return <Monitor size={13} className="inline mr-1" />;
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ── detail modal ──────────────────────────────────────────────────────────────

function DetailModal({
  item,
  onClose,
  onUpdate,
}: {
  item: FeedbackItem;
  onClose: () => void;
  onUpdate: (updated: Partial<FeedbackItem>) => void;
}) {
  const [status, setStatus]     = useState(item.status);
  const [note, setNote]         = useState(item.admin_note ?? '');
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState('');
  const [saved, setSaved]       = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaveErr('');
    setSaved(false);
    try {
      await updateFeedback(item.id, { status, admin_note: note });
      onUpdate({ status, admin_note: note });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(getErrorMessage(e, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  const dirty = status !== item.status || note !== (item.admin_note ?? '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
              <MessageSquareWarning className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Report #{item.id}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{fmt(item.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* user info */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-1.5 border border-slate-700/40">
            <p className="text-sm font-semibold text-slate-200">{item.full_name ?? '—'}</p>
            <p className="text-xs text-slate-400">{item.email ?? '—'}</p>
            {item.mobile && <p className="text-xs text-slate-400">{item.mobile}</p>}
          </div>

          {/* category + badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${CATEGORY_CLS[item.category] ?? CATEGORY_CLS['Other']}`}>
              {item.category}
            </span>
            {item.platform && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-slate-700/40 text-slate-300 border-slate-600/40 flex items-center">
                <PlatformIcon platform={item.platform} />
                {item.platform}
              </span>
            )}
            {item.app_version && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-slate-700/40 text-slate-300 border-slate-600/40">
                v{item.app_version}
              </span>
            )}
            {item.device_info?.device_model && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-slate-700/40 text-slate-300 border-slate-600/40">
                {item.device_info.device_model}
              </span>
            )}
            {item.device_info?.os_version && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-slate-700/40 text-slate-300 border-slate-600/40">
                {item.device_info.os_version}
              </span>
            )}
          </div>

          {/* description */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
              {item.description}
            </p>
          </div>

          {/* admin controls */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin Actions</p>

            {/* status select */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedbackItem['status'])}
                className="w-full appearance-none bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* admin note */}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note (optional)…"
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-cyan-500 transition-colors resize-none placeholder:text-slate-500"
            />

            {saveErr && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{saveErr}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || (!dirty && !saved)}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <><RefreshCw size={14} className="animate-spin" /> Saving…</>
              ) : saved ? (
                <><CheckCircle2 size={14} /> Saved</>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [items, setItems]           = useState<FeedbackItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('All');
  const [statusFilter, setStatus]   = useState('All');
  const [selected, setSelected]     = useState<FeedbackItem | null>(null);

  function load() {
    setLoading(true);
    setError('');
    getFeedback()
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []))
      .catch((e) => setError(getErrorMessage(e, 'Failed to load feedback')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((f) => {
      if (catFilter !== 'All' && f.category !== catFilter) return false;
      if (statusFilter !== 'All' && f.status !== statusFilter) return false;
      if (q && !(
        f.description.toLowerCase().includes(q) ||
        (f.full_name ?? '').toLowerCase().includes(q) ||
        (f.email ?? '').toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [items, search, catFilter, statusFilter]);

  const counts = useMemo(() => ({
    total:    items.length,
    pending:  items.filter((f) => f.status === 'pending').length,
    reviewed: items.filter((f) => f.status === 'reviewed').length,
    resolved: items.filter((f) => f.status === 'resolved').length,
  }), [items]);

  function applyUpdate(id: number, patch: Partial<FeedbackItem>) {
    setItems((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
    setSelected((prev) => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }

  return (
    <div className="p-6 space-y-6">
      {/* page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">User Feedback</h1>
          <p className="text-sm text-slate-400 mt-0.5">Reports submitted by users from the app</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total"    value={counts.total}    color="text-slate-100" />
        <StatCard label="Pending"  value={counts.pending}  color="text-amber-400" />
        <StatCard label="Reviewed" value={counts.reviewed} color="text-cyan-400" />
        <StatCard label="Resolved" value={counts.resolved} color="text-emerald-400" />
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, category or description…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* category filter */}
        <div className="relative">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* table */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw size={18} className="animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="text-center py-20 text-rose-400 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">No reports found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  {['#', 'User', 'Category', 'Description', 'Platform', 'Status', 'Date', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <motion.tr
                    key={f.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelected(f)}
                  >
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{f.id}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-semibold leading-tight">{f.full_name ?? '—'}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{f.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_CLS[f.category] ?? CATEGORY_CLS['Other']}`}>
                        {f.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-300 line-clamp-2 text-xs leading-relaxed">{f.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {f.platform ? (
                        <span className="flex items-center gap-1">
                          <PlatformIcon platform={f.platform} />{f.platform}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[f.status]}`}>
                        {f.status === 'pending' ? <><Clock size={10} className="inline mr-1" />Pending</> :
                         f.status === 'reviewed' ? <><Eye size={10} className="inline mr-1" />Reviewed</> :
                         <><CheckCircle2 size={10} className="inline mr-1" />Resolved</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmt(f.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(f); }}
                        className="px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* result count */}
      {!loading && !error && (
        <p className="text-xs text-slate-500 text-right">
          Showing {filtered.length} of {items.length} reports
        </p>
      )}

      {/* detail modal */}
      <AnimatePresence>
        {selected && (
          <DetailModal
            key={selected.id}
            item={selected}
            onClose={() => setSelected(null)}
            onUpdate={(patch) => applyUpdate(selected.id, patch)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
