'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCopy, Eye, EyeOff, Globe, Loader2, RefreshCw, Search,
  Shield, ShieldAlert, ShieldOff, Star, Trash2, Wrench, XCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChannelHealth {
  id: number;
  name: string;
  health_status: string;
  health_score: number | null;
  health_reason: string | null;
  fail_count: number | null;
  last_failure_at: string | null;
  last_success_at: string | null;
  last_checked_at: string | null;
  failure_reason: string | null;
  is_featured: boolean;
  is_popular: boolean;
  is_premium: boolean;
  is_paid: boolean;
  is_hidden: boolean;
  is_removed: boolean;
  is_visible_app: boolean;
  is_visible_website: boolean;
  needs_manual_verification: boolean;
  admin_note: string | null;
  channel_stream_url: string | null;
  channel_playback_mode: string | null;
  backup_stream_url: string | null;
  category_name: string | null;
  // Primary stream
  stream_id: number | null;
  primary_stream_url: string | null;
  final_url: string | null;
  stream_quality: string | null;
  stream_health: string | null;
  stream_score: number | null;
  stream_health_reason: string | null;
  stream_fail_count: number | null;
  stream_success_count: number | null;
  stream_last_failed_at: string | null;
  stream_last_success_at: string | null;
  stream_last_checked_at: string | null;
  headers_json: Record<string, string> | null;
  stream_user_agent: string | null;
  stream_referer: string | null;
  vlc_playable: boolean | null;
  android_playable: boolean | null;
  license_type: string | null;
  resolution_height: number | null;
  bitrate: number | null;
  stream_is_primary: boolean | null;
  total_streams: number;
  recent_reports_7d: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  online:                   'bg-green-900/40 text-green-300 border border-green-700',
  unstable:                 'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  needs_review:             'bg-blue-900/40 text-blue-300 border border-blue-700',
  likely_broken:            'bg-orange-900/40 text-orange-300 border border-orange-700',
  offline:                  'bg-red-900/40 text-red-300 border border-red-700',
  dead:                     'bg-red-900/60 text-red-200 border border-red-600',
  requires_licensed_source: 'bg-purple-900/40 text-purple-300 border border-purple-700',
  drm_or_unsupported:       'bg-purple-900/40 text-purple-300 border border-purple-700',
  geo_blocked:              'bg-pink-900/40 text-pink-300 border border-pink-700',
  forbidden_403:            'bg-pink-900/40 text-pink-300 border border-pink-700',
  unknown:                  'bg-gray-700/40 text-gray-400 border border-gray-600',
};

const SCORE_COLOR = (score: number | null) => {
  const s = score ?? 0;
  if (s >= 80) return 'text-green-400';
  if (s >= 50) return 'text-yellow-400';
  if (s >= 20) return 'text-orange-400';
  return 'text-red-400';
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function copyText(text: string | null) {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StreamHealthPage() {
  const [channels, setChannels] = useState<ChannelHealth[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [noteChannel, setNoteChannel] = useState<ChannelHealth | null>(null);
  const [noteText, setNoteText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (filter === 'needs_check') params.needs_check = 'true';
      else if (filter !== 'all') params.status = filter;
      if (search) params.search = search;

      const res = await api.get('/stream-health', { params });
      setChannels(res.data.data || []);
      setPagination(res.data.pagination || { page, limit: 50, total: 0, hasMore: false });
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      showToast(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => { void Promise.resolve().then(() => fetchData()); }, [fetchData]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const doMark = async (channelId: number, action: string, note?: string) => {
    setActionLoading(channelId);
    try {
      await api.post(`/stream-health/${channelId}/mark`, { action, note });
      showToast(`Done: ${action.replace(/_/g, ' ')}`);
      fetchData();
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      showToast(`Error: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const doRecheck = async (channelId: number) => {
    setActionLoading(channelId);
    showToast('Rechecking stream...');
    try {
      const res = await api.post(`/stream-health/${channelId}/recheck`);
      const { health_status, health_score } = res.data.data || res.data;
      showToast(`Recheck done: ${health_status} (score ${health_score ?? '?'})`);
      fetchData();
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Recheck failed';
      showToast(`Error: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  const saveNote = async () => {
    if (!noteChannel) return;
    await doMark(noteChannel.id, 'set_note', noteText);
    setNoteChannel(null);
    setNoteText('');
  };

  // ── Filter tabs ──────────────────────────────────────────────────────────────
  const FILTERS = [
    { key: 'all',                     label: 'All' },
    { key: 'online',                  label: 'Working' },
    { key: 'unstable',                label: 'Unstable' },
    { key: 'likely_broken',           label: 'Broken' },
    { key: 'needs_check',             label: 'Needs Verification' },
    { key: 'requires_licensed_source', label: 'Requires License' },
    { key: 'offline',                 label: 'Offline' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-sm text-gray-100 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-red-400" />
            Stream Health
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Monitor, verify, and manage channel health. {pagination.total} channels total.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by channel name..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900 text-gray-500 text-left">
              <th className="px-3 py-2.5 font-medium">Channel</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Score</th>
              <th className="px-3 py-2.5 font-medium">Fails</th>
              <th className="px-3 py-2.5 font-medium">Last Fail</th>
              <th className="px-3 py-2.5 font-medium">Last OK</th>
              <th className="px-3 py-2.5 font-medium">Reports 7d</th>
              <th className="px-3 py-2.5 font-medium">Flags</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  <Loader2 size={18} className="animate-spin inline mr-2" />
                  Loading...
                </td>
              </tr>
            )}
            {!loading && channels.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  No channels match this filter.
                </td>
              </tr>
            )}
            {!loading && channels.map(ch => (
              <>
                <tr
                  key={ch.id}
                  className={`hover:bg-gray-900/60 cursor-pointer transition-colors ${expanded === ch.id ? 'bg-gray-900/60' : ''}`}
                  onClick={() => setExpanded(expanded === ch.id ? null : ch.id)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                        background: ch.health_score != null && ch.health_score >= 80
                          ? '#22c55e' : ch.health_score != null && ch.health_score >= 40
                          ? '#eab308' : '#ef4444',
                      }} />
                      <div>
                        <div className="font-medium text-white flex items-center gap-1">
                          {ch.name}
                          {ch.is_featured && <Star size={10} className="text-yellow-400 fill-yellow-400" />}
                          {ch.is_premium && <Shield size={10} className="text-purple-400" />}
                          {ch.needs_manual_verification && (
                            <span className="ml-1 px-1 py-0.5 bg-orange-900/50 text-orange-300 rounded text-[9px] border border-orange-700">
                              VERIFY
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 text-[10px]">{ch.category_name || 'Uncategorized'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[ch.health_status] || STATUS_COLORS.unknown}`}>
                      {ch.health_status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`font-bold ${SCORE_COLOR(ch.health_score)}`}>
                      {ch.health_score ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-red-400">
                    {ch.fail_count ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{fmtDate(ch.last_failure_at)}</td>
                  <td className="px-3 py-2.5 text-gray-400">{fmtDate(ch.last_success_at)}</td>
                  <td className="px-3 py-2.5">
                    {ch.recent_reports_7d > 0 ? (
                      <span className="text-orange-400 font-medium">{ch.recent_reports_7d}</span>
                    ) : (
                      <span className="text-gray-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {ch.is_hidden && <span title="Hidden from app"><EyeOff size={11} className="text-red-400" /></span>}
                      {!ch.is_visible_website && <span title="Hidden from website"><Globe size={11} className="text-orange-400" /></span>}
                      {ch.is_premium && <span title="Premium"><Shield size={11} className="text-purple-400" /></span>}
                      {ch.android_playable === false && <span title="Not Android playable"><XCircle size={11} className="text-red-500" /></span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {actionLoading === ch.id ? (
                        <Loader2 size={13} className="animate-spin text-gray-400" />
                      ) : (
                        <>
                          <button
                            title="Recheck stream"
                            onClick={() => doRecheck(ch.id)}
                            className="p-1 rounded hover:bg-blue-900/40 text-blue-400"
                          >
                            <RefreshCw size={12} />
                          </button>
                          <button
                            title="Mark working"
                            onClick={() => doMark(ch.id, 'mark_working')}
                            className="p-1 rounded hover:bg-green-900/40 text-green-400"
                          >
                            <CheckCircle2 size={12} />
                          </button>
                          <button
                            title="Hide from app"
                            onClick={() => doMark(ch.id, 'hide_app')}
                            className="p-1 rounded hover:bg-red-900/40 text-red-400"
                          >
                            <EyeOff size={12} />
                          </button>
                          <button
                            title="Restore channel"
                            onClick={() => doMark(ch.id, 'restore')}
                            className="p-1 rounded hover:bg-gray-700 text-gray-400"
                          >
                            <Eye size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* ── Expanded detail row ── */}
                {expanded === ch.id && (
                  <tr key={`${ch.id}-detail`} className="bg-gray-900/80">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="space-y-4">

                        {/* Stream URLs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <UrlField label="Stream URL" value={ch.primary_stream_url || ch.channel_stream_url} />
                          <UrlField label="Final URL (resolved)" value={ch.final_url} />
                          {ch.backup_stream_url && <UrlField label="Backup URL" value={ch.backup_stream_url} />}
                        </div>

                        {/* Headers */}
                        {(ch.stream_user_agent || ch.stream_referer || ch.headers_json) && (
                          <div className="space-y-1">
                            <div className="text-gray-500 text-[10px] uppercase tracking-wider">Headers</div>
                            <div className="bg-gray-800 rounded p-2 font-mono text-[10px] text-gray-300 space-y-0.5">
                              {ch.stream_user_agent && <div><span className="text-gray-500">User-Agent:</span> {ch.stream_user_agent}</div>}
                              {ch.stream_referer && <div><span className="text-gray-500">Referer:</span> {ch.stream_referer}</div>}
                              {ch.headers_json && Object.entries(ch.headers_json).map(([k, v]) => (
                                <div key={k}><span className="text-gray-500">{k}:</span> {v}</div>
                              ))}
                            </div>
                            <button
                              onClick={() => copyText(JSON.stringify({ 'User-Agent': ch.stream_user_agent, 'Referer': ch.stream_referer, ...ch.headers_json }, null, 2))}
                              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 mt-1"
                            >
                              <ClipboardCopy size={10} /> Copy headers as JSON
                            </button>
                          </div>
                        )}

                        {/* Stream health details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          <Stat label="Stream Quality" value={ch.stream_quality || '—'} />
                          <Stat label="Resolution" value={ch.resolution_height ? `${ch.resolution_height}p` : '—'} />
                          <Stat label="Bitrate" value={ch.bitrate ? `${ch.bitrate} kbps` : '—'} />
                          <Stat label="License" value={ch.license_type || '—'} />
                          <Stat label="Stream Fails" value={String(ch.stream_fail_count ?? '—')} />
                          <Stat label="Stream Success" value={String(ch.stream_success_count ?? '—')} />
                          <Stat label="Stream Score" value={String(ch.stream_score ?? '—')} />
                          <Stat label="Total Streams" value={String(ch.total_streams)} />
                          <Stat label="VLC Playable" value={ch.vlc_playable === true ? 'Yes' : ch.vlc_playable === false ? 'No' : '—'} />
                          <Stat label="Android Playable" value={ch.android_playable === true ? 'Yes' : ch.android_playable === false ? 'No' : '—'} />
                          <Stat label="Stream Status" value={ch.stream_health || '—'} />
                          <Stat label="Stream Last OK" value={fmtDate(ch.stream_last_success_at)} />
                        </div>

                        {/* Health reason */}
                        {(ch.health_reason || ch.stream_health_reason) && (
                          <div className="text-[10px] text-gray-400 bg-gray-800 rounded p-2">
                            <span className="text-gray-500">Health reason: </span>
                            {ch.health_reason || ch.stream_health_reason}
                          </div>
                        )}

                        {/* Admin note */}
                        {ch.admin_note && (
                          <div className="text-[10px] text-yellow-300 bg-yellow-900/20 border border-yellow-700/40 rounded p-2">
                            <span className="text-yellow-500">Admin note: </span>
                            {ch.admin_note}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <ActionBtn icon={<RefreshCw size={11} />} label="Recheck" color="blue" onClick={() => doRecheck(ch.id)} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<CheckCircle2 size={11} />} label="Mark Working" color="green" onClick={() => doMark(ch.id, 'mark_working')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<AlertTriangle size={11} />} label="Mark Unstable" color="yellow" onClick={() => doMark(ch.id, 'mark_unstable')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<ShieldAlert size={11} />} label="Requires License" color="purple" onClick={() => doMark(ch.id, 'requires_licensed_source')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<EyeOff size={11} />} label="Hide App" color="orange" onClick={() => doMark(ch.id, 'hide_app')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<Globe size={11} />} label="Hide Website" color="orange" onClick={() => doMark(ch.id, 'hide_website')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<ShieldOff size={11} />} label="Hide Everywhere" color="red" onClick={() => doMark(ch.id, 'hide_everywhere')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<Eye size={11} />} label="Restore" color="green" onClick={() => doMark(ch.id, 'restore')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<Trash2 size={11} />} label="Clear Verify Flag" color="gray" onClick={() => doMark(ch.id, 'clear_verification')} disabled={actionLoading === ch.id} />
                          <ActionBtn icon={<Wrench size={11} />} label="Add Note" color="gray" onClick={() => { setNoteChannel(ch); setNoteText(ch.admin_note || ''); }} disabled={actionLoading === ch.id} />
                        </div>

                        {/* Copy buttons */}
                        <div className="flex flex-wrap gap-2">
                          <CopyBtn label="Copy Stream URL" value={ch.primary_stream_url || ch.channel_stream_url} />
                          <CopyBtn label="Copy Final URL" value={ch.final_url} />
                          <CopyBtn label="Copy Headers JSON" value={JSON.stringify({ 'User-Agent': ch.stream_user_agent, 'Referer': ch.stream_referer, ...ch.headers_json })} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">
            Page {pagination.page} · {pagination.total} total channels
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={!pagination.hasMore}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add note modal */}
      {noteChannel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-5 space-y-4">
            <h2 className="text-white font-semibold">Admin Note — {noteChannel.name}</h2>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Enter admin note..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNoteChannel(null)}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-600 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50 max-w-xs">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function UrlField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1.5">
        <span className="font-mono text-[10px] text-gray-300 truncate flex-1">{value}</span>
        <button onClick={() => copyText(value)} className="flex-shrink-0 text-gray-500 hover:text-white">
          <ClipboardCopy size={11} />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded px-2 py-1.5">
      <div className="text-gray-500 text-[9px] uppercase tracking-wider">{label}</div>
      <div className="text-gray-200 font-medium mt-0.5">{value}</div>
    </div>
  );
}

function ActionBtn({
  icon, label, color, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'red' | 'gray';
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorMap = {
    blue:   'bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border-blue-700',
    green:  'bg-green-900/40 hover:bg-green-800/60 text-green-300 border-green-700',
    yellow: 'bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-300 border-yellow-700',
    purple: 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border-purple-700',
    orange: 'bg-orange-900/40 hover:bg-orange-800/60 text-orange-300 border-orange-700',
    red:    'bg-red-900/40 hover:bg-red-800/60 text-red-300 border-red-700',
    gray:   'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-600',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-medium transition-colors disabled:opacity-40 ${colorMap[color]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function CopyBtn({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyText(value ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      disabled={!value}
      className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-400 disabled:opacity-30 transition-colors"
    >
      <ClipboardCopy size={10} />
      {copied ? 'Copied!' : label}
    </button>
  );
}

