'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, MonitorSmartphone, KeyRound, CreditCard, AlertTriangle, Globe, Activity, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { getDashboardStats } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface Stats {
  users: { total: number; active: number; blocked: number; new_last_30d: number };
  devices: { total: number };
  channels: { total: number; active: number; online: number; offline: number; unstable: number };
  licenses: { total: number; active: number; unused: number; expired: number; suspended: number };
  payments: { total: number; total_revenue: number; completed: number; pending: number };
  recentUsers: any[];
  recentPayments: any[];
  revenueSeries: any[];
  deviceBreakdown: any[];
}

const COLORS = ['#10b981', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899'];
const REFRESH_INTERVAL = 60000; // 60 seconds

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback((showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    getDashboardStats()
      .then((data) => { setStats(data as Stats); setLastUpdate(new Date()); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(() => fetchStats(), REFRESH_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-emerald-400 font-medium tracking-widest animate-pulse">LOADING DASHBOARD...</div>
        </div>
      </div>
    );
  }

  // Format revenue series data to ensure numbers
  const chartData = stats.revenueSeries?.map(d => ({
    name: d.name,
    revenue: parseFloat(d.revenue) || 0,
    users: parseInt(d.users) || 0,
  })) || [];

  const deviceData = stats.deviceBreakdown?.map(d => ({
    name: d.name,
    value: parseInt(d.value) || 0,
  })) || [];

  const statCards = [
    { label: 'Total Revenue', value: `₹${Number(stats.payments.total_revenue || 0).toLocaleString('en-IN')}`, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', trend: `${stats.payments.completed} paid`, isUp: true },
    { label: 'Active Users', value: stats.users.active, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', trend: `+${stats.users.new_last_30d} this month`, isUp: true },
    { label: 'Total Devices', value: stats.devices.total, icon: MonitorSmartphone, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', trend: `${stats.users.total} users`, isUp: true },
    { label: 'Online Channels', value: stats.channels.online, icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', trend: `${stats.channels.offline} offline`, isUp: stats.channels.offline === 0 },
    { label: 'Active Licenses', value: stats.licenses.active, icon: KeyRound, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', trend: `${stats.licenses.expired} expired`, isUp: stats.licenses.expired === 0 },
    { label: 'Pending Payments', value: stats.payments.pending, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', trend: stats.payments.pending > 0 ? 'Needs Action' : 'All clear', isUp: stats.payments.pending === 0 },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="space-y-8 pb-10"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Overview
          </h1>
          <p className="text-slate-400 mt-1">Here's what's happening with your NivaTV service today.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 backdrop-blur-sm">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-300">Live</span>
          {lastUpdate && <span className="text-xs text-slate-500 ml-1">· {lastUpdate.toLocaleTimeString()}</span>}
          <button onClick={() => fetchStats(true)} disabled={refreshing} className="ml-1 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, idx) => (
          <motion.div 
            key={card.label} 
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`relative overflow-hidden rounded-2xl p-5 border backdrop-blur-xl bg-slate-900/40 ${card.border}`}
          >
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl ${card.bg}`} />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${card.isUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                  {card.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {card.trend}
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{card.value}</p>
                <p className="text-sm text-slate-400 font-medium">{card.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2 rounded-2xl p-6 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-200">Revenue & User Growth (14 Days)</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area yAxisId="right" type="monotone" dataKey="users" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-2xl p-6 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl">
          <h3 className="text-lg font-bold text-slate-200 mb-6">Device Breakdown</h3>
          <div className="h-[300px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '0.5rem', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-slate-200">{stats.devices.total}</span>
              <span className="text-xs text-slate-500 font-medium">TOTAL</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200">Recent Users</h3>
            <button className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors">View All</button>
          </div>
          <div className="p-2 flex-1">
            {stats.recentUsers?.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {u.status}
                </span>
              </div>
            )) || <p className="p-4 text-slate-500 text-sm text-center">No recent users</p>}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200">Recent Payments</h3>
            <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">View All</button>
          </div>
          <div className="p-2 flex-1">
            {stats.recentPayments?.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-emerald-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{p.full_name || 'Unknown User'}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400">₹{p.amount}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : p.status === 'pending' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            )) || <p className="p-4 text-slate-500 text-sm text-center">No recent payments</p>}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
