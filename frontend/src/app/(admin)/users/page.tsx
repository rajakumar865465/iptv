'use client';

import { useEffect, useState } from 'react';
import { getUsers, getUser, getDevices, getLicenses, getPayments, updateUserStatus } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCheck, UserX, Shield, Clock, X, MonitorSmartphone, KeyRound, CreditCard, MoreHorizontal, AlertTriangle } from 'lucide-react';

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

interface License { id: string; license_key: string; plan_name: string; status: string; expires_at: string; }

interface Payment { id: string; plan_name: string; amount: number; status: string; created_at: string; }

const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blocked: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

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
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices'|'licenses'|'payments'>('devices');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; confirmText: string; confirmVariant: 'rose'|'emerald'; action: () => void }>({
    title: '', message: '', confirmText: '', confirmVariant: 'rose', action: () => {}
  });

  useEffect(() => {
    Promise.all([getUsers(), getLicenses(), getPayments()])
      .then(([u, l, p]: any) => {
        setUsers(u || []);
        setLicenses(l || []);
        setAllPayments(p || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const openUserDetail = async (u: User) => {
    setSelectedUser(u);
    setLoadingDetail(true);
    setActiveTab('devices');
    try {
      const [userData, devicesData]: any = await Promise.all([getUser(u.id), getDevices({ user_id: u.id })]);
      setUserDevices(devicesData?.data || devicesData || []);
      setUserLicenses(licenses.filter(l => l.user_email?.toLowerCase() === u.email?.toLowerCase()));
      setUserPayments(allPayments.filter(p => p.id && (p as any).email?.toLowerCase() === u.email?.toLowerCase()));
    } catch {
      setUserDevices([]);
      setUserLicenses(licenses.filter(l => l.user_email?.toLowerCase() === u.email?.toLowerCase()));
      setUserPayments([]);
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

  const filteredUsers = users.filter(u => !search || 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.mobile?.includes(search)
  );

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">User Management</h1>
          <p className="text-slate-400 mt-1">{users.length} users — {users.filter(u => u.status === 'active').length} active</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search by name, email, or mobile..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-700 flex items-start justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/20">
                    {selectedUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">{selectedUser.full_name}</h2>
                    <p className="text-sm text-slate-400">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_CLS[selectedUser.status] || STATUS_CLS.blocked}`}>{selectedUser.status}</span>
                      {selectedUser.role === 'admin' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">Admin</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-slate-700 shrink-0">
                {[
                  { id: 'devices', label: 'Devices', icon: MonitorSmartphone, count: userDevices.length },
                  { id: 'licenses', label: 'Licenses', icon: KeyRound, count: userLicenses.length },
                  { id: 'payments', label: 'Payments', icon: CreditCard, count: userPayments.length },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} 
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === tab.id ? 'text-cyan-400 border-cyan-500' : 'text-slate-400 border-transparent hover:text-slate-200'
                    }`}>
                    <tab.icon className="w-4 h-4" />{tab.label}<span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-xs">{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingDetail ? (
                  <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <>
                    {activeTab === 'devices' && (
                      <div className="space-y-2">
                        {userDevices.length === 0 ? <p className="text-center text-slate-500 py-8">No devices found</p> : 
                          userDevices.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700"><MonitorSmartphone className="w-4 h-4 text-slate-400" /></div>
                                <div><p className="text-sm font-medium text-slate-200">{d.device_name}</p><p className="text-xs text-slate-500 capitalize">{d.device_type}</p></div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{d.status}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    {activeTab === 'licenses' && (
                      <div className="space-y-2">
                        {userLicenses.length === 0 ? <p className="text-center text-slate-500 py-8">No licenses found</p> : 
                          userLicenses.map((l) => (
                            <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                              <div className="min-w-0"><p className="font-mono text-xs text-slate-300 truncate">{l.license_key}</p><p className="text-xs text-slate-500">{l.plan_name}</p></div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : l.status === 'unused' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>{l.status}</span>
                            </div>
                          ))}
                      </div>
                    )}
                    {activeTab === 'payments' && (
                      <div className="space-y-2">
                        {userPayments.length === 0 ? <p className="text-center text-slate-500 py-8">No payments found</p> : 
                          userPayments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                              <div><p className="text-sm font-medium text-slate-200">{p.plan_name}</p><p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p></div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-400">₹{Number(p.amount).toLocaleString('en-IN')}</p>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>{p.status}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-700 flex justify-end gap-2 shrink-0">
                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Close</button>
                <button onClick={() => selectedUser && handleStatusChange(selectedUser)}
                  className={`px-4 py-2 rounded-xl font-semibold ${selectedUser?.status === 'active' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'}`}>
                  {selectedUser?.status === 'active' ? 'Block User' : 'Unblock User'}
                </button>
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
                <tr><th className="px-6 py-4 font-semibold">User</th><th className="px-6 py-4 font-semibold">Contact</th><th className="px-6 py-4 font-semibold">Status</th><th className="px-6 py-4 font-semibold">Joined</th><th className="px-6 py-4 font-semibold text-right">Actions</th></tr>
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
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(u); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${u.status === 'active' ? 'bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700' : 'bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 border border-slate-700'}`}>
                          {u.status === 'active' ? <><UserX className="w-3.5 h-3.5" /> Block</> : <><UserCheck className="w-3.5 h-3.5" /> Unblock</>}
                        </button>
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