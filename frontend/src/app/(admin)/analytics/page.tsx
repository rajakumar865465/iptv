'use client';

import { useEffect, useState } from 'react';
import { 
  getUserAnalytics, getRevenueAnalytics, getPlaybackAnalytics, getWatchTimeAnalytics 
} from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Users, CreditCard, Tv, Clock, Radio, Flame, Sparkles } from 'lucide-react';

const DAYS_OPTIONS = [7, 14, 30, 60, 90];
const CATEGORY_COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6', '#14b8a6'];

type CountRow = { date: string; count: string | number };
type RevenueRow = CountRow & { revenue: string | number };
type PlaybackRow = { name?: string; play_count?: string | number };
type UserAnalytics = { signups?: CountRow[]; active?: CountRow[] };

interface WatchTimeData {
  summary: {
    total_watch_hours: number;
    total_sessions: number;
    unique_viewers: number;
    avg_session_minutes: number;
    avg_hours_per_user: number;
  };
  daily_trend: Array<{ name: string; date: string; watch_hours: number; sessions: number; viewers: number }>;
  peak_hours: Array<{ hour: number; label: string; watch_hours: number; sessions: number }>;
  top_channels: Array<{ id: number; name: string; logo_url?: string; category_name?: string; session_count: number; unique_viewers: number; watch_hours: number }>;
  category_share: Array<{ category_name: string; watch_hours: number; session_count: number }>;
}

function SectionCard({ title, children, icon: Icon, color }: {
  title: string; children: React.ReactNode; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-xl"
    >
      <div className="flex items-center gap-3 p-5 border-b border-slate-700/50">
        <div className={`p-2 rounded-xl bg-slate-800 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-base font-bold text-slate-200">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [userData, setUserData] = useState<UserAnalytics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueRow[]>([]);
  const [playbackData, setPlaybackData] = useState<PlaybackRow[]>([]);
  const [watchTimeData, setWatchTimeData] = useState<WatchTimeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = (d: number) => {
    setLoading(true);
    Promise.all([
      getUserAnalytics(d),
      getRevenueAnalytics(d),
      getPlaybackAnalytics(),
      getWatchTimeAnalytics(d)
    ])
      .then(([u, r, p, w]) => {
        setUserData((u || {}) as UserAnalytics);
        setRevenueData((r || []) as RevenueRow[]);
        setPlaybackData((p || []) as PlaybackRow[]);
        setWatchTimeData((w || null) as WatchTimeData | null);
      })
      .catch((err) => console.error('Failed to load analytics:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchData(days));
  }, [days]);

  // Merge signups + active into one series keyed by date
  const userChartData = (() => {
    if (!userData) return [];
    const map: Record<string, { date: string; signups: number; active: number }> = {};
    (userData.signups || []).forEach((r) => {
      const d = r.date?.substring(0, 10);
      if (!map[d]) map[d] = { date: d, signups: 0, active: 0 };
      map[d].signups = Number(r.count);
    });
    (userData.active || []).forEach((r) => {
      const d = r.date?.substring(0, 10);
      if (!map[d]) map[d] = { date: d, signups: 0, active: 0 };
      map[d].active = Number(r.count);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    }));
  })();

  const revenueChartData = revenueData.map((r) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: Number(r.revenue) || 0,
    txns: Number(r.count) || 0,
  }));

  const totalRevenue = revenueData.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalSignups = (userData?.signups || []).reduce((s, r) => s + (Number(r.count) || 0), 0);
  const totalActiveUsers = (userData?.active || []).reduce((s, r) => s + (Number(r.count) || 0), 0);

  const tooltipStyle = { 
    backgroundColor: '#0f172a', 
    border: '1px solid #334155', 
    borderRadius: '0.75rem', 
    color: '#f8fafc',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Analytics & Watch Time
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Track real-time streaming engagement, user watch hours, revenue, and platform trends.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 shadow-lg">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                days === d
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Watch Time */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Watch Time ({days}d)
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-100">
              {loading ? '...' : `${watchTimeData?.summary.total_watch_hours || 0}h`}
            </p>
            <span className="text-xs text-emerald-400 font-medium">streamed</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {watchTimeData?.summary.total_sessions || 0} viewing sessions
          </p>
        </motion.div>

        {/* Avg Session Length */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-2 text-cyan-400">
            <Radio className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Avg Session Length
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-100">
              {loading ? '...' : `${watchTimeData?.summary.avg_session_minutes || 0}m`}
            </p>
            <span className="text-xs text-cyan-400 font-medium">per session</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ~{watchTimeData?.summary.avg_hours_per_user || 0}h per active viewer
          </p>
        </motion.div>

        {/* Active Viewers & Users */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 border border-purple-500/20 bg-gradient-to-br from-purple-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-2 text-purple-400">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Viewers ({days}d)
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-100">
              {loading ? '...' : watchTimeData?.summary.unique_viewers || totalActiveUsers}
            </p>
            <span className="text-xs text-purple-400 font-medium">streamers</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            +{totalSignups} new signups in period
          </p>
        </motion.div>

        {/* Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-5 border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-slate-900/50 to-slate-900/40 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Revenue ({days}d)
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-100">
              {loading ? '...' : `₹${totalRevenue.toLocaleString('en-IN')}`}
            </p>
            <span className="text-xs text-amber-400 font-medium">gross</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {revenueData.reduce((s, r) => s + (Number(r.count) || 0), 0)} completed payments
          </p>
        </motion.div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Aggregating watch time analytics...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily Watch Time Trend Chart */}
          <SectionCard title="Daily Watch Time Trend (Hours Streamed)" icon={Clock} color="text-emerald-400">
            {watchTimeData && watchTimeData.daily_trend?.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={watchTimeData.daily_trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gWatchHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                    <RechartsTooltip 
                      contentStyle={tooltipStyle} 
                      formatter={(v) => [`${v} hours`, 'Watch Time']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="watch_hours" 
                      name="Watch Hours" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#gWatchHours)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                No session data yet for this period. As users stream live channels, watch hours will accumulate here.
              </div>
            )}
          </SectionCard>

          {/* Peak Viewing Hours & Category Share */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Viewing Hours (24h) */}
            <SectionCard title="Peak Viewing Hours (IST 24-Hour Distribution)" icon={Flame} color="text-amber-400">
              {watchTimeData && watchTimeData.peak_hours?.length > 0 ? (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={watchTimeData.peak_hours} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} interval={2} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                      <RechartsTooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} hrs`, 'Volume']} />
                      <Bar dataKey="watch_hours" name="Watch Hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-12 text-xs">No hourly session logs yet</p>
              )}
            </SectionCard>

            {/* Category Share */}
            <SectionCard title="Watch Time by Genre / Category" icon={Tv} color="text-cyan-400">
              {watchTimeData && watchTimeData.category_share?.length > 0 ? (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={watchTimeData.category_share.slice(0, 6)} 
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                      <YAxis type="category" dataKey="category_name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                      <RechartsTooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} hours`, 'Watch Time']} />
                      <Bar dataKey="watch_hours" name="Hours" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-12 text-xs">No category streaming data yet</p>
              )}
            </SectionCard>
          </div>

          {/* Top Channels Ranked by Duration */}
          <SectionCard title="Top Channels Ranked by Actual Watch Hours" icon={Sparkles} color="text-purple-400">
            {watchTimeData && watchTimeData.top_channels?.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={watchTimeData.top_channels.slice(0, 15).map((r) => ({
                      name: r.name && r.name.length > 20 ? r.name.slice(0, 20) + '...' : r.name || 'Unknown',
                      hours: Number(r.watch_hours) || 0,
                      viewers: r.unique_viewers || 0
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={130} />
                    <RechartsTooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} hours`, 'Duration']} />
                    <Bar dataKey="hours" name="Watch Hours" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : playbackData.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={playbackData.slice(0, 15).map((r) => ({
                      name: r.name && r.name.length > 18 ? r.name.slice(0, 18) + '...' : r.name || 'Unknown',
                      plays: Number(r.play_count) || 0
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={120} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="plays" name="Plays" fill="#ec4899" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-10 text-xs">No channel streaming data available yet.</p>
            )}
          </SectionCard>

          {/* User Signups & DAU */}
          <SectionCard title="User Signups & Daily Active Users" icon={Users} color="text-cyan-400">
            {userChartData.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: '#f8fafc' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
                    <Area type="monotone" dataKey="signups" name="New Signups" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#gSignups)" />
                    <Area type="monotone" dataKey="active" name="Active Users" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#gActive)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-10 text-xs">No user data for this period</p>
            )}
          </SectionCard>

          {/* Revenue chart */}
          <SectionCard title="Revenue Growth" icon={CreditCard} color="text-emerald-400">
            {revenueChartData.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <RechartsTooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${v ?? 0}`, 'Revenue']} />
                    <Bar dataKey="revenue" name="Revenue (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-10 text-xs">No revenue data for this period</p>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
