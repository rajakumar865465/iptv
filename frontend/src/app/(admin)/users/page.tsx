'use client';

import { useEffect, useState } from 'react';
import { 
  getUsers, getUser, getDevices, getLicenses, getPayments, 
  updateUserStatus, deleteUser, getUserWatchHistory 
} from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, UserCheck, UserX, Shield, Clock, X, MonitorSmartphone, 
  KeyRound, CreditCard, MoreHorizontal, AlertTriangle, Radio, Tv, Play
} from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  status: string;
  role: string;
  created_at: string;
  last_login_at: string;
}

interface Device { id: string; device_name: string; device_type: string; status: string; last_active_at: string; }
interface License { id: string; license_key: string; plan_name: string; status: string; expires_at: string; user_email?: string; }
interface Payment { id: string; plan_name: string; amount: number; status: string; created_at: string; }

interface WatchHistoryState {
  summary?: {
    total_sessions: number;
    total_watch_hours: number;
    total_watch_seconds: number;
    avg_session_minutes: number;
    unique_channels_watched: number;
    top_channels: Array<{ name: string; total_hours: string; logo_url?: string; category_name?: string }>;
  };
  sessions?: Array<{
    id: number;
    channel_name: string;
    logo_url?: string;
    category_name?: string;
    started_at: string;
    ended_at?: string;
    duration_seconds: number;
    is_active: boolean;
    device_model?: string;
    ip_address?: string;
  }>;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const remaining = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${remaining}s`;
  return `${remaining}s`;
}

function ConfirmModal({ open, title, message, confirmText, confirmVariant, onConfirm, onCancel }: { 
  open: boolean; title: string; message: string; confirmText: string; confirmVariant: 'rose'|'emerald'; 
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  const btnCls = confirmVariant === 'rose' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700"><AlertTriangle className="w-5 h-5 text-amber-400" /></div>
          <h3 className="text-lg font-bold text-slate-100">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-semibold text-white ${btnCls}`}>{confirmText}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDevices, setUserDevices] = useState<Device[]>([]);
  const [userLicenses, setUserLicenses] = useState<License[]>([]);
  const [userPayments, setUserPayments] = useState<Payment[]>([]);
  const [userWatchHistory, setUserWatchHistory] = useState<WatchHistoryState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices'|'licenses'|'payments'|'watch'>('devices');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; confirmText: string; confirmVariant: 'rose'|'emerald'; action: () => void }>({
    title: '', message: '', confirmText: '', confirmVariant: 'rose', action: () => {}
  });

  useEffect(() => {
    Promise.all([getUsers(), getLicenses(), getPayments()])
      .then(([u, l, p]) => {
        setUsers(Array.isArray(u) ? u : ((u as any)?.data || []));
        setLicenses(Array.isArray(l) ? l : ((l as any)?.data || []));
        setAllPayments(Array.isArray(p) ? p : ((p as any)?.data || []));
      })
      .finally(() => setLoading(false));
  }, []);

  const openUserDetail = async (u: User) => {
    setSelectedUser(u);
    setLoadingDetail(true);
    setActiveTab('devices');
    try {
      const [userData, devicesData, watchData]: any = await Promise.all([
        getUser(u.id), 
        getDevices({ user_id: u.id }),
        getUserWatchHistory(u.id).catch(() => null)
      ]);
      setUserDevices(devicesData?.data || devicesData || []);
      setUserLicenses(licenses.filter(l => l.user_email?.toLowerCase() === u.email?.toLowerCase()));
      setUserPayments(allPayments.filter(p => p.id && (p as any).email?.toLowerCase() === u.email?.toLowerCase()));
      setUserWatchHistory(watchData || null);
    } catch {
      setUserDevices([]);
      setUserLicenses(licenses.filter(l => l.user_email?.toLowerCase() === u.email?.toLowerCase()));
      setUserPayments([]);
      setUserWatchHistory(null);
    }
    setLoadingDetail(false);
  };

  const requestConfirm = (title: string, message: string, confirmText: string, confirmVariant: 'rose'|'emerald', action: () => void) => {
    setConfirmConfig({ title, message, confirmText, confirmVariant, action });
    setConfirmOpen(true);
  };

  const handleStatusChange = async (u: User) => {
    const newStatus = u.status === 'active' ? 'blocked' : 'active';
    requestConfirm(
      newStatus === 'blocked' ? 'Block User' : 'Unblock User',
      newStatus === 'blocked' ? 'This will prevent the user from logging in to their account.' : 'This will restore the user\'s access.',
      newStatus === 'blocked' ? 'Block' : 'Unblock',
      newStatus === 'blocked' ? 'rose' : 'emerald',
      async () => {
        try {
          await updateUserStatus(u.id, newStatus);
          setUsers(prev => prev.map(user => user.id === u.id ? { ...user, status: newStatus } : user));
          if (selectedUser?.id === u.id) setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
        } catch { alert('Failed to update status'); }
      }
    );
  };

  const handleDeleteUser = async (u: User) => {
    requestConfirm(
      'Delete User',
      'Are you sure you want to permanently delete this user? This action cannot be undone and will delete all their licenses, devices, and history.',
      'Delete',
      'rose',
      async () => {
        try {
          await deleteUser(u.id);
          setUsers(prev => prev.filter(user => user.id !== u.id));
          if (selectedUser?.id === u.id) setSelectedUser(null);
        } catch { alert('Failed to delete user'); }
      }
    );
  };

  const filteredUsers = users.filter(u => !search || 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.mobile?.includes(search)
  );

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Users</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage user accounts, subscriptions, devices, and view stream watch activity.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* User Details Drawer Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-end z-50">
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-slate-900 border-l border-slate-800 w-full max-w-lg h-full flex flex-col shadow-2xl">
              
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {selectedUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">{selectedUser.full_name}</h3>
                    <p className="text-xs text-slate-400">{selectedUser.email}</p>
                    {selectedUser.mobile && <p className="text-xs text-slate-500">{selectedUser.mobile}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 px-6 gap-2">
                {[
                  { id: 'devices', label: `Devices (${userDevices.length})`, icon: MonitorSmartphone },
                  { id: 'licenses', label: `Licenses (${userLicenses.length})`, icon: KeyRound },
                  { id: 'payments', label: `Orders (${userPayments.length})`, icon: CreditCard },
                  { id: 'watch', label: 'Watch Activity', icon: Radio },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`py-3 px-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      activeTab === t.id
                        ? 'border-emerald-400 text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Devices Tab */}
                    {activeTab === 'devices' && (
                      <div className="space-y-2">
                        {userDevices.length === 0 ? <p className="text-center text-slate-500 py-8">No devices registered</p> : 
                          userDevices.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                              <div>
                                <p className="font-medium text-slate-200 text-sm">{d.device_name || 'Android Device'}</p>
                                <p className="text-[11px] text-slate-500 font-mono">{d.id}</p>
                              </div>
                              <span className="text-xs text-slate-400">{d.last_active_at ? new Date(d.last_active_at).toLocaleDateString() : 'Never'}</span>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Licenses Tab */}
                    {activeTab === 'licenses' && (
                      <div className="space-y-2">
                        {userLicenses.length === 0 ? <p className="text-center text-slate-500 py-8">No licenses linked</p> : 
                          userLicenses.map((l) => (
                            <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                              <div className="min-w-0">
                                <p className="font-mono text-xs text-slate-300 truncate">{l.license_key}</p>
                                <p className="text-xs text-slate-500">{l.plan_name}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : l.status === 'unused' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>{l.status}</span>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Payments Tab */}
                    {activeTab === 'payments' && (
                      <div className="space-y-2">
                        {userPayments.length === 0 ? <p className="text-center text-slate-500 py-8">No payments found</p> : 
                          userPayments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                              <div>
                                <p className="text-sm font-medium text-slate-200">{p.plan_name}</p>
                                <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-400">₹{Number(p.amount).toLocaleString('en-IN')}</p>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>{p.status}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Watch Activity Tab */}
                    {activeTab === 'watch' && (
                      <div className="space-y-4">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <span className="text-[10px] uppercase font-semibold text-slate-400">Total Watch Time</span>
                            <p className="text-xl font-extrabold text-emerald-400 mt-1">
                              {userWatchHistory?.summary?.total_watch_hours || 0} hrs
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {userWatchHistory?.summary?.total_sessions || 0} sessions
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <span className="text-[10px] uppercase font-semibold text-slate-400">Avg Session</span>
                            <p className="text-xl font-extrabold text-cyan-400 mt-1">
                              {userWatchHistory?.summary?.avg_session_minutes || 0} mins
                            </p>
                            <span className="text-[10px] text-slate-500">
                              {userWatchHistory?.summary?.unique_channels_watched || 0} channels
                            </span>
                          </div>
                        </div>

                        {/* Top Channels */}
                        {userWatchHistory?.summary?.top_channels && userWatchHistory.summary.top_channels.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-300">Top Watched Channels</span>
                            <div className="space-y-1">
                              {userWatchHistory.summary.top_channels.map((ch, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center p-0.5">
                                      {ch.logo_url ? <img src={ch.logo_url} alt="" className="w-full h-full object-contain" /> : <Tv className="w-3 h-3 text-slate-500" />}
                                    </div>
                                    <span className="font-semibold text-slate-200">{ch.name}</span>
                                  </div>
                                  <span className="font-mono text-emerald-400 font-bold">{ch.total_hours}h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Viewing Sessions Log */}
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-bold text-slate-300">Recent Stream Sessions</span>
                          {(!userWatchHistory?.sessions || userWatchHistory.sessions.length === 0) ? (
                            <p className="text-center text-slate-500 py-6 text-xs">No stream history recorded yet for this user.</p>
                          ) : (
                            <div className="space-y-2">
                              {userWatchHistory.sessions.map((sess) => (
                                <div key={sess.id} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                                      <Tv className="w-3.5 h-3.5 text-cyan-400" />
                                      {sess.channel_name || 'Channel'}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-400">
                                      {formatDuration(sess.duration_seconds)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>{new Date(sess.started_at).toLocaleString()}</span>
                                    <span>{sess.device_model || 'Android'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700 text-xs">Close</button>
                {selectedUser?.role !== 'admin' && (
                  <>
                    <button onClick={() => selectedUser && handleDeleteUser(selectedUser)}
                      className="px-4 py-2 rounded-xl font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 text-xs">
                      Delete User
                    </button>
                    <button onClick={() => selectedUser && handleStatusChange(selectedUser)}
                      className={`px-4 py-2 rounded-xl font-semibold text-xs ${selectedUser?.status === 'active' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'}`}>
                      {selectedUser?.status === 'active' ? 'Block User' : 'Unblock User'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal open={confirmOpen} {...confirmConfig} onConfirm={() => { setConfirmOpen(false); confirmConfig.action(); }} onCancel={() => setConfirmOpen(false)} />

      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Contact</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Joined</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show" className="divide-y divide-slate-700/50">
                <AnimatePresence>
                  {filteredUsers.map((u) => (
                    <motion.tr variants={itemVariants} key={u.id} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => openUserDetail(u)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">{u.full_name?.charAt(0)?.toUpperCase() || 'U'}</div>
                          <div><p className="font-semibold text-slate-200">{u.full_name}</p><p className="text-xs text-slate-500">ID: {u.id}</p></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-300">{u.email}<div className="text-xs text-slate-500">{u.mobile}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{u.status}</span>
                        {u.role === 'admin' && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">Admin</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {u.role !== 'admin' && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusChange(u); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${u.status === 'active' ? 'bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700' : 'bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 border border-slate-700'}`}>
                            {u.status === 'active' ? <><UserX className="w-3.5 h-3.5" /> Block</> : <><UserCheck className="w-3.5 h-3.5" /> Unblock</>}
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredUsers.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500"><Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />No users found</td></tr>}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
