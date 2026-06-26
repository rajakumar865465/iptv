'use client';

import { useEffect, useState } from 'react';
import { Users, MonitorSmartphone, KeyRound, CreditCard, AlertTriangle, Globe } from 'lucide-react';
import { getDashboardStats } from '@/lib/api';

interface Stats {
  users: { total: number; active: number; blocked: number; new_last_30d: number };
  devices: { total: number };
  channels: { total: number; active: number; online: number; offline: number; unstable: number };
  licenses: { total: number; active: number; unused: number; expired: number; suspended: number };
  payments: { total: number; total_revenue: number; completed: number; pending: number };
  recentUsers: any[];
  recentPayments: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then((data) => setStats(data as Stats))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading stats...</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.users.total, icon: Users, color: 'text-blue-400' },
    { label: 'Active Users', value: stats.users.active, icon: Users, color: 'text-green-400' },
    { label: 'Total Devices', value: stats.devices.total, icon: MonitorSmartphone, color: 'text-purple-400' },
    { label: 'Total Channels', value: stats.channels.total, icon: Globe, color: 'text-cyan-400' },
    { label: 'Online Channels', value: stats.channels.online, icon: Globe, color: 'text-green-400' },
    { label: 'Total Licenses', value: stats.licenses.total, icon: KeyRound, color: 'text-yellow-400' },
    { label: 'Active Licenses', value: stats.licenses.active, icon: KeyRound, color: 'text-green-400' },
    { label: 'Total Revenue', value: `₹${stats.payments.total_revenue || 0}`, icon: CreditCard, color: 'text-emerald-400' },
    { label: 'Pending Payments', value: stats.payments.pending, icon: AlertTriangle, color: 'text-orange-400' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <card.icon className={`w-8 h-8 ${card.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Recent Users</h3>
          <div className="space-y-3">
            {stats.recentUsers?.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm border-b border-gray-700 pb-2">
                <span>{u.full_name}</span>
                <span className="text-gray-400">{u.email}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${u.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                  {u.status}
                </span>
              </div>
            )) || <p className="text-gray-500 text-sm">No recent users</p>}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {stats.recentPayments?.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-gray-700 pb-2">
                <span>{p.full_name || 'Unknown'}</span>
                <span className="text-gray-400">₹{p.amount}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'completed' ? 'bg-green-900 text-green-300' : p.status === 'pending' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                  {p.status}
                </span>
              </div>
            )) || <p className="text-gray-500 text-sm">No recent payments</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
