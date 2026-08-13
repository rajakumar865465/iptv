'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudDownload, FileText, RefreshCw, CheckCircle2, XCircle,
  Copy, X, Search, PlayCircle, ShieldAlert, Radio, Link as LinkIcon,
} from 'lucide-react';
import {
  parseM3uSession, startImportSessionScan, getImportSession, getImportSessionItems,
  importSelectedChannels, getErrorMessage,
} from '@/lib/api';

// ---------- Types ----------

interface ImportSession {
  id: number;
  status: string;
  source_type: string;
  source_url: string | null;
  total_found: number;
  total_checked: number;
  total_online: number;
  total_offline: number;
  total_unstable: number;
  total_unknown: number;
  total_duplicate: number;
  total_new: number;
  total_imported: number;
  total_skipped: number;
  error_message?: string | null;
}

interface ImportItem {
  id: number;
  channel_name: string;
  group_title: string | null;
  language: string | null;
  country: string | null;
  stream_url: string;
  status: string; // pending | checking | online | offline | unstable | unknown
  response_time_ms: number | null;
  health_reason: string | null;
  db_status: string; // unknown | new | duplicate
  duplicate_of_channel_id: number | null;
  duplicate_reason: string | null;
  import_status: string;
}

const HEALTH_META: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: 'PENDING', dot: 'bg-slate-500', text: 'text-slate-400' },
  checking: { label: 'CHECKING', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400' },
  online: { label: 'ONLINE', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  offline: { label: 'OFFLINE', dot: 'bg-rose-500', text: 'text-rose-400' },
  unstable: { label: 'UNSTABLE', dot: 'bg-orange-400', text: 'text-orange-400' },
  unknown: { label: 'UNKNOWN', dot: 'bg-slate-400', text: 'text-slate-300' },
};

function HealthDot({ status }: { status: string }) {
  const m = HEALTH_META[status] || HEALTH_META.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${m.text}`}>
      <span className={`w-2 h-2 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

function DbBadge({ item }: { item: ImportItem }) {
  if (item.db_status === 'duplicate') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Copy className="w-3 h-3" /> Exists #{item.duplicate_of_channel_id}
      </span>
    );
  }
  if (item.db_status === 'new') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
        New
      </span>
    );
  }
  return <span className="text-[10px] text-slate-500 uppercase">Unknown</span>;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function ChannelImportPage() {
  // --- Source input state ---
  const [sourceUrl, setSourceUrl] = useState('https://iptv-org.github.io/iptv/languages/hin.m3u');
  const [pastedContent, setPastedContent] = useState('');
  const [language, setLanguage] = useState('Hindi');
  const [country, setCountry] = useState('IN');
  const [sourceLabel, setSourceLabel] = useState('iptv-org Hindi');
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' });

  // --- Session/scan state ---
  const [session, setSession] = useState<ImportSession | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Results table state ---
  const [items, setItems] = useState<ImportItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dbFilter, setDbFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // --- Import confirmation ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skippedDuplicate: number; skippedOther: number } | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPolling(), []);

  // ---------- Step 1: Parse ----------
  const handleFetchAndParse = async () => {
    setParsing(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await parseM3uSession({
        source_type: 'url',
        source_url: sourceUrl,
        source_label: sourceLabel,
        language,
        country,
        source_name: 'iptv-org',
      });
      await loadSessionAndStartScan(res.session_id);
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to fetch/parse M3U') });
    }
    setParsing(false);
  };

  const handleParsePasted = async () => {
    if (!pastedContent.trim()) {
      setMessage({ type: 'error', text: 'Paste some M3U content first' });
      return;
    }
    setParsing(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await parseM3uSession({
        source_type: 'text',
        content: pastedContent,
        source_label: sourceLabel || 'Pasted M3U',
        language,
        country,
        source_name: 'manual-paste',
      });
      await loadSessionAndStartScan(res.session_id);
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to parse M3U content') });
    }
    setParsing(false);
  };

  const loadSessionAndStartScan = async (sessionId: number) => {
    const s = await getImportSession(sessionId);
    setSession(s);
    setScanModalOpen(true);
    setImportResult(null);
    setSelected(new Set());
    await startImportSessionScan(sessionId);
    startPolling(sessionId);
  };

  const startPolling = (sessionId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await getImportSession(sessionId);
        setSession(s);
        if (s.status === 'scanned' || s.status === 'failed' || s.status === 'completed') {
          stopPolling();
          await refreshItems(sessionId);
        }
      } catch {
        stopPolling();
      }
    }, 1500);
  };

  const refreshItems = useCallback(async (sessionId: number) => {
    setItemsLoading(true);
    try {
      const res = await getImportSessionItems(sessionId, { limit: 500 });
      setItems(res.items || []);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // Re-fetch items when filters change (client-side filtering keeps this snappy for MVP sizes)
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (dbFilter !== 'all' && it.db_status !== dbFilter) return false;
      if (search && !it.channel_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, statusFilter, dbFilter, search]);

  const counts = useMemo(() => {
    const c = { all: items.length, online: 0, offline: 0, unstable: 0, unknown: 0, new: 0, duplicate: 0 };
    for (const it of items) {
      if (it.status === 'online') c.online++;
      else if (it.status === 'offline') c.offline++;
      else if (it.status === 'unstable') c.unstable++;
      else c.unknown++;
      if (it.db_status === 'new') c.new++;
      else if (it.db_status === 'duplicate') c.duplicate++;
    }
    return c;
  }, [items]);

  const scanPct = session && session.total_found
    ? Math.round(((session.total_checked || 0) / session.total_found) * 100)
    : 0;

  // ---------- Selection helpers ----------
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllOnlineNew = () => {
    setSelected(new Set(items.filter((i) => i.status === 'online' && i.db_status === 'new').map((i) => i.id)));
  };
  const selectAllVisible = () => {
    setSelected(new Set(filteredItems.map((i) => i.id)));
  };
  const clearSelection = () => setSelected(new Set());

  // ---------- Import ----------
  const openConfirm = () => setConfirmOpen(true);

  const doImport = async () => {
    if (!session) return;
    setImporting(true);
    try {
      const res = await importSelectedChannels(session.id, Array.from(selected));
      setImportResult(res);
      setConfirmOpen(false);
      await refreshItems(session.id);
      const s = await getImportSession(session.id);
      setSession(s);
      setSelected(new Set());
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to import channels') });
      setConfirmOpen(false);
    }
    setImporting(false);
  };

  const selectedSummary = useMemo(() => {
    let dup = 0, offline = 0, ready = 0;
    for (const id of selected) {
      const it = items.find((i) => i.id === id);
      if (!it) continue;
      if (it.db_status === 'duplicate') dup++;
      else if (it.status === 'offline') offline++;
      else ready++;
    }
    return { dup, offline, ready, total: selected.size };
  }, [selected, items]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <CloudDownload className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Import Channels</h1>
          <p className="text-sm text-slate-400">
            Parse an M3U source, scan every stream for health &amp; duplicates, then choose exactly what to save.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`p-3 rounded-lg text-sm border ${message.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          {message.text}
        </div>
      )}

      {/* Source input */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-purple-400" /> M3U URL
          </h2>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://iptv-org.github.io/iptv/languages/hin.m3u"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleFetchAndParse}
            disabled={parsing || !sourceUrl}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {parsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            Fetch &amp; Analyze
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" /> Or Paste M3U Content
          </h2>
          <textarea
            value={pastedContent}
            onChange={(e) => setPastedContent(e.target.value)}
            placeholder={'#EXTM3U\n#EXTINF:-1 tvg-id="..." group-title="Hindi",Channel Name\nhttps://example.com/live/stream.m3u8'}
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleParsePasted}
            disabled={parsing || !pastedContent.trim()}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {parsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Parse Channels
          </button>
        </div>
      </div>

      {/* Metadata defaults */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Source Label</label>
          <input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Default Language</label>
          <input value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Default Country</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500" />
        </div>
      </div>

      {/* Results table (shown once we have items) */}
      {session && items.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3 justify-between bg-slate-800/30">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Radio className="w-4 h-4 text-purple-400" />
              Session #{session.id} &middot; {session.total_found} channels found
              {session.status === 'scanning' && (
                <button onClick={() => setScanModalOpen(true)} className="ml-2 text-xs text-amber-400 underline">
                  view scan progress
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search channels..."
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-3 border-b border-slate-800 flex flex-wrap gap-2">
            {(['all', 'online', 'offline', 'unstable', 'unknown'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase transition-colors ${statusFilter === s ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
              >
                {s} {s === 'all' ? counts.all : (counts as any)[s]}
              </button>
            ))}
            <span className="w-px bg-slate-800 mx-1" />
            {(['all', 'new', 'duplicate'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setDbFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase transition-colors ${dbFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
              >
                {s === 'all' ? 'All DB' : s} {s === 'all' ? '' : (counts as any)[s]}
              </button>
            ))}
          </div>

          {/* Bulk selection shortcuts */}
          <div className="p-3 border-b border-slate-800 flex flex-wrap gap-2 items-center">
            <button onClick={selectAllOnlineNew} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
              Select All Online &amp; New
            </button>
            <button onClick={selectAllVisible} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">
              Select All Visible
            </button>
            <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">
              Clear Selection
            </button>
            <span className="ml-auto text-xs text-slate-400">{selected.size} selected</span>
          </div>

          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium w-10"></th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">DB</th>
                  <th className="px-4 py-3 font-medium">Stream</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {itemsLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">Loading...</td></tr>
                )}
                {!itemsLoading && filteredItems.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-300 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-purple-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-200 max-w-[220px] truncate">{item.channel_name}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{item.group_title || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <HealthDot status={item.status} />
                        {item.response_time_ms != null && (
                          <span className="text-[10px] text-slate-500">{item.response_time_ms}ms</span>
                        )}
                      </div>
                      {item.health_reason && item.status !== 'online' && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.health_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><DbBadge item={item} /></td>
                    <td className="px-4 py-2.5 max-w-[280px] truncate text-slate-500 text-xs font-mono">{item.stream_url}</td>
                  </tr>
                ))}
                {!itemsLoading && filteredItems.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No channels match the current filters</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-800/30">
            <div className="text-xs text-slate-400">
              {importResult && (
                <span className="text-emerald-400 font-semibold">
                  ✅ {importResult.imported} imported &middot; {importResult.skippedDuplicate} duplicates skipped &middot; {importResult.skippedOther} other skipped
                </span>
              )}
            </div>
            <button
              onClick={openConfirm}
              disabled={selected.size === 0 || importing}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 transition-colors disabled:opacity-40"
            >
              <PlayCircle className="w-4 h-4" /> Import Selected: {selected.size}
            </button>
          </div>
        </div>
      )}

      {/* Scan progress modal */}
      <AnimatePresence>
        {scanModalOpen && session && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  Scanning {session.total_found} Channel{session.total_found === 1 ? '' : 's'}
                </h3>
                <button onClick={() => setScanModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Progress: {session.total_checked} / {session.total_found}</span>
                  <span>{scanPct}%</span>
                </div>
                <ProgressBar pct={scanPct} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} label="Online" value={session.total_online} color="text-emerald-400" />
                <StatBox icon={<XCircle className="w-4 h-4 text-rose-400" />} label="Offline" value={session.total_offline} color="text-rose-400" />
                <StatBox icon={<ShieldAlert className="w-4 h-4 text-orange-400" />} label="Unstable" value={session.total_unstable} color="text-orange-400" />
                <StatBox icon={<Copy className="w-4 h-4 text-blue-400" />} label="Duplicate" value={session.total_duplicate} color="text-blue-400" />
              </div>

              {session.status === 'scanning' ? (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Scanning streams in the background — this window updates automatically. You can close it and keep browsing.
                </p>
              ) : (
                <button
                  onClick={() => setScanModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                >
                  View Results
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import confirmation modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5"
            >
              <h3 className="text-lg font-bold text-white">Import Summary</h3>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Ready to import" value={selectedSummary.ready} color="text-emerald-400" />
                <SummaryRow label="Duplicates skipped" value={selectedSummary.dup} color="text-blue-400" />
                <SummaryRow label="Offline / other skipped" value={selectedSummary.offline} color="text-rose-400" />
                <div className="border-t border-slate-800 pt-2 flex justify-between font-semibold text-slate-200">
                  <span>Total selected</span><span>{selectedSummary.total}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold">
                  Cancel
                </button>
                <button
                  onClick={doImport}
                  disabled={importing}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  Import {selectedSummary.total} Channels
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-2">
      {icon}
      <div>
        <div className={`text-lg font-bold leading-none ${color}`}>{value}</div>
        <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between text-slate-400">
      <span>{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
