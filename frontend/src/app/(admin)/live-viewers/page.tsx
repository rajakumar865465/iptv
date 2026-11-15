'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, Users, Tv, Clock, Smartphone, Globe, RefreshCw, 
  Search, ShieldAlert, Wifi, Eye, ExternalLink, Play
} from 'lucide-react';
import { getLiveStreams, killLiveStream } from '@/lib/api';
import { useLiveStreamTracker } from '@/lib/websocket';

interface LiveStream {
  session_id: number;
  device_id: string;
  device_name?: string;
  device_model?: string;
  platform?: string;
  app_version?: string;
  ip_address?: string;
  started_at: string;
  last_stream_ping_at?: string;
  duration_seconds: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_mobile?: string;
  user_status?: string;
  channel_id: number;
  channel_name: string;
  channel_number?: number;
  logo_url?: string;
  category_name?: string;
  license_key?: string;
  plan_name?: string;
  license_status?: string;
}

interface TopChannel {
  name: string;
  count: number;
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remainingSec = sec % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${remainingSec.toString().padStart(2, '0')}s`;
  }
  return `${mins}m ${remainingSec.toString().padStart(2, '0')}s`;
}

export default function LiveViewersPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [topChannels, setTopChannels] = useState<TopChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [killConfirm, setKillConfirm] = useState<{ open: boolean; stream: LiveStream | null }>({ open: false, stream: null });
  const [killing, setKilling] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ticker, setTicker] = useState(0);

  const fetchStreams = useCallback((isManual = false) => {
    if (isManual) setRefreshing(true);
    getLiveStreams()
      .then((res: any) => {
        if (res) {
          setStreams(res.streams || []);
          setTopChannels(res.top_live_channels || []);
        }
      })
      .catch((err) => console.error('Failed to fetch live streams:', err))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  // Initial fetch and polling every 8s
  useEffect(() => {
    fetchStreams();
    const interval = setInterval(() => {
      if (autoRefresh) fetchStreams();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchStreams, autoRefresh]);

  // Real-time ticking timer (updates duration on screen every 1s smoothly)
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for instant WebSocket updates
  const handleLiveEvent = useCallback(() => {
    fetchStreams();
  }, [fetchStreams]);

  const { isConnected: wsConnected } = useLiveStreamTracker(handleLiveEvent);

  const handleKill = async () => {
    if (!killConfirm.stream) return;
    setKilling(true);
    try {
      const targetId = killConfirm.stream.session_id || killConfirm.stream.device_id;
      await killLiveStream(targetId);
      setKillConfirm({ open: false, stream: null });
      fetchStreams(true);
    } catch (err) {
      console.error('Failed to kill stream:', err);
    } finally {
      setKilling(false);
    }
  };

  // Filter streams
  const filteredStreams = streams.filter((s) => {
    const matchSearch =
      !search ||
      s.user_name.toLowerCase().includes(search.toLowerCase()) ||
      s.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      s.channel_name.toLowerCase().includes(search.toLowerCase()) ||
      s.device_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.device_model?.toLowerCase().includes(search.toLowerCase());

    const matchCategory =
      selectedCategory === 'all' ||
      (s.category_name && s.category_name.toLowerCase() === selectedCategory.toLowerCase());

    return matchSearch && matchCategory;
  });

  const categories = Array.from(new Set(streams.map((s) => s.category_name).filter(Boolean))) as string[];

  // Find longest active stream
  const maxDurationStream = streams.reduce<LiveStream | null>((max, s) => {
    return !max || (s.duration_seconds || 0) > (max.duration_seconds || 0) ? s : max;
  }, null);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Live TV Viewers
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {streams.length} Watching Live
            </span>
          </div>
          <p className="text-slate-400 mt-1 text-sm">
            Monitor real-time concurrent active viewers, playback durations, and streaming devices.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* WS Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
              wsConnected
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800/40 text-amber-300'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{wsConnected ? 'WebSocket Live' : 'Polling (8s)'}</span>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              autoRefresh
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => fetchStreams(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/20 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Live Streamers */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Viewers</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100">{streams.length}</span>
            <span className="text-xs text-emerald-400 font-medium">streaming right now</span>
          </div>
        </motion.div>

        {/* Distinct Channels Being Streamed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Channels</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100">
              {new Set(streams.map((s) => s.channel_id)).size}
            </span>
            <span className="text-xs text-cyan-400 font-medium">distinct channels</span>
          </div>
        </motion.div>

        {/* Top Live Channel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 border border-purple-500/20 bg-gradient-to-br from-purple-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Most Watched Now</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold text-slate-100 truncate">
              {topChannels[0]?.name || 'No active streams'}
            </p>
            <p className="text-xs text-purple-400 font-medium">
              {topChannels[0] ? `${topChannels[0].count} concurrent viewers` : 'Awaiting streams'}
            </p>
          </div>
        </motion.div>

        {/* Longest Active Stream */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-5 border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Longest Session</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold text-slate-100 truncate">
              {maxDurationStream
                ? formatDuration(maxDurationStream.duration_seconds + ticker * 0)
                : '0m'}
            </p>
            <p className="text-xs text-amber-400 font-medium truncate">
              {maxDurationStream ? maxDurationStream.channel_name : 'No active sessions'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, channel, or device..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Genres ({streams.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Viewers Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold text-slate-200">Active Live TV Stream Sessions</h2>
          </div>
          <span className="text-xs text-slate-500">
            Showing {filteredStreams.length} of {streams.length}
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Scanning live stream heartbeats...</p>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
              <Tv className="w-7 h-7 text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-slate-300">No Viewers Streaming Right Now</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              When users open the NivaTV app and start watching a live channel, their active session, channel, and duration will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-950/40">
                  <th className="py-3.5 px-5">User</th>
                  <th className="py-3.5 px-4">Channel Watched</th>
                  <th className="py-3.5 px-4">Watch Duration</th>
                  <th className="py-3.5 px-4">Device & App</th>
                  <th className="py-3.5 px-4">Network / IP</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                <AnimatePresence>
                  {filteredStreams.map((stream) => {
                    const elapsed = Math.max(
                      0,
                      stream.started_at
                        ? Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000)
                        : stream.duration_seconds
                    );

                    return (
                      <motion.tr
                        key={`${stream.device_id}_${stream.session_id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* User Column */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-xs uppercase shadow-md shadow-emerald-950/40">
                                {stream.user_name?.slice(0, 2) || 'TV'}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                                <span>{stream.user_name}</span>
                                {stream.plan_name && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {stream.plan_name}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">{stream.user_email}</div>
                              {stream.user_mobile && (
                                <div className="text-[11px] text-slate-500">{stream.user_mobile}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Channel Column */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                              {stream.logo_url ? (
                                <img
                                  src={stream.logo_url}
                                  alt={stream.channel_name}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Tv className="w-5 h-5 text-slate-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                <span>{stream.channel_name}</span>
                                {stream.channel_number && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                    #{stream.channel_number}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {stream.category_name || 'General'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Watch Duration Column (Live ticking) */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </div>
                            <div>
                              <span className="font-mono font-bold text-emerald-400 text-sm">
                                {formatDuration(elapsed)}
                              </span>
                              <div className="text-[10px] text-slate-500">
                                Started {new Date(stream.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Device Column */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <div>
                              <div className="font-medium text-slate-200">
                                {stream.device_model || stream.device_name || 'Android Device'}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <span className="capitalize">{stream.platform || 'Android'}</span>
                                {stream.app_version && (
                                  <>
                                    <span>&bull;</span>
                                    <span>{stream.app_version}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Network / IP Column */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Wifi className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="font-mono text-[11px]">
                              {stream.ip_address || 'Protected IP'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/users?search=${encodeURIComponent(stream.user_email || stream.user_name)}`}
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                              title="View user details"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => setKillConfirm({ open: true, stream })}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                              title="Disconnect stream session"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disconnect Stream Confirmation Modal */}
      {killConfirm.open && killConfirm.stream && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Disconnect Live Stream?</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Are you sure you want to forcibly disconnect the active stream of{' '}
              <strong className="text-slate-100">{killConfirm.stream.user_name}</strong> watching{' '}
              <strong className="text-emerald-400">{killConfirm.stream.channel_name}</strong>?
            </p>
            <div className="text-xs text-slate-400 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 mb-6 space-y-1">
              <div><strong>Device:</strong> {killConfirm.stream.device_model || killConfirm.stream.device_id}</div>
              <div><strong>Started:</strong> {new Date(killConfirm.stream.started_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setKillConfirm({ open: false, stream: null })}
                disabled={killing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleKill}
                disabled={killing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/30 flex items-center gap-1.5"
              >
                {killing ? 'Disconnecting...' : 'Disconnect Stream'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
