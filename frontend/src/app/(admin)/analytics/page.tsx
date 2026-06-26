'use client';

import { useEffect, useState } from 'react';
import { getUserAnalytics, getRevenueAnalytics, getPlaybackAnalytics } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Users, CreditCard, Tv, Calendar } from 'lucide-react';

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

function SectionCard({ title, children, icon: Icon, color }: {
  title: string; children: React.ReactNode; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden"
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
  const [userData, setUserData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [playbackData, setPlaybackData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = (d: number) => {
    setLoading(true);
    Promise.all([getUserAnalytics(d), getRevenueAnalytics(d), getPlaybackAnalytics()])
      .then(([u, r, p]) => {
        setUserData(u);
        setRevenueData(r || []);
        setPlaybackData(p || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(days); }, [days]);

  // Merge signups + active into one series keyed by date
  const userChartData = (() => {
    if (!userData) return [];
    const map: Record<string, { date: string; signups: number; active: number }> = {};
    (userData.signups || []).forEach((r: any) => {
      const d = r.date?.substring(0, 10);
      if (!map[d]) map[d] = { date: d, signups: 0, active: 0 };
      map[d].signups = Number(r.count);
    });
    (userData.active || []).forEach((r: any) => {
      const d = r.date?.substring(0, 10);
      if (!map[d]) map[d] = { date: d, signups: 0, active: 0 };
      map[d].active = Number(r.count);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    }));
  })();

  const revenueChartData = revenueData.map((r: any) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: parseFloat(r.revenue) || 0,
    txns: parseInt(r.count) || 0,
  }));

  const totalRevenue = revenueData.reduce((s: number, r: any) => s + (parseFloat(r.revenue) || 0), 0);
  const totalSignups = (userData?.signups || []).reduce((s: number, r: any) => s + (parseInt(r.count) || 0), 0);
  const totalActiveUsers = (userData?.active || []).reduce((s: number, r: any) => s + (parseInt(r.count) || 0), 0);

  const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc' };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Analytics</h1>
          <p className="text-slate-400 mt-1">Track growth, revenue and playback trends.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${days === d ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: `New Signups (${days}d)`, value: totalSignups, icon: Users, color: 'text-cyan-400' },
          { label: `Active Users (${days}d)`, value: totalActiveUsers, icon: TrendingUp, color: 'text-purple-400' },
          { label: `Revenue (${days}d)`, value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: CreditCard, color: 'text-emerald-400' },
        ].map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl"
          >
            <div className={`flex items-center gap-2 mb-2 ${card.color}`}>
              <card.icon className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-slate-100">{loading ? '...' : card.value}</p>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* User growth chart */}
          <SectionCard title="User Signups & Daily Active Users" icon={Users} color="text-cyan-400">
            {userChartData.length > 0 ? (
              <div className="h-[280px]">
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
              <p className="text-center text-slate-500 py-10">No user data for this period</p>
            )}
          </SectionCard>

          {/* Revenue chart */}
          <SectionCard title="Revenue" icon={CreditCard} color="text-emerald-400">
            {revenueChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                    <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: '#f8fafc' }} formatter={(v: any) => [`₹${v}`, 'Revenue']} />
                    <Bar dataKey="revenue" name="Revenue (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-10">No revenue data for this period</p>
            )}
          </SectionCard>

          {/* Top channels */}
          <SectionCard title="Top 20 Channels by Plays (Last 30d)" icon={Tv} color="text-pink-400">
            {playbackData.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={playbackData.slice(0, 20).map((r: any) => ({ name: r.name?.length > 18 ? r.name.slice(0, 18) + '…' : r.name, plays: parseInt(r.play_count) || 0 }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={120} />
                    <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: '#f8fafc' }} />
                    <Bar dataKey="plays" name="Plays" fill="#ec4899" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-10">No playback data available. Watch history is recorded as users play channels.</p>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
