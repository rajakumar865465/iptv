'use client';

import { useEffect, useState } from 'react';
import { getAdminUsers, createAdminUser, updateAdminUser } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Plus, Pencil, X, UserCog } from 'lucide-react';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  admin_role: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

const emptyForm = { full_name: '', email: '', mobile: '', password: '', admin_role: 'admin' };
const editEmptyForm = { full_name: '', admin_role: 'admin', status: 'active' };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(editEmptyForm);
  const [saving, setSaving] = useState(false);

  const fetchUsers = () =>
    getAdminUsers()
      .then((data) => setUsers(data || []))
      .finally(() => setLoading(false));

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createAdminUser(createForm as Record<string, unknown>);
      setShowCreateModal(false);
      setCreateForm(emptyForm);
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create admin user');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      await updateAdminUser(editUser.id, editForm as Record<string, unknown>);
      setEditUser(null);
      fetchUsers();
    } catch {
      alert('Failed to update admin user');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditForm({ full_name: u.full_name, admin_role: u.admin_role, status: u.status });
    setEditUser(u);
  };

  const ROLE_BADGE: Record<string, string> = {
    super_admin: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    admin: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Admin Users
          </h1>
          <p className="text-slate-400 mt-1">Manage who has access to this dashboard.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Admin
        </button>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-indigo-400" />
                  Create Admin
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="Admin Name" required className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="admin@example.com" required className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mobile (optional)</label>
                  <input value={createForm.mobile} onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })} placeholder="+91..." className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                  <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Strong password" required className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</label>
                  <select value={createForm.admin_role} onChange={(e) => setCreateForm({ ...createForm, admin_role: e.target.value })} className={inputCls}>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold disabled:opacity-50">
                    {saving ? 'Creating…' : 'Create Admin'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Edit modal */}
        {editUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-indigo-400" />
                  Edit Admin
                </h3>
                <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</label>
                    <select value={editForm.admin_role} onChange={(e) => setEditForm({ ...editForm, admin_role: e.target.value })} className={inputCls}>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Admin</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Last Login</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map((u) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow">
                          {u.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">{u.full_name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${ROLE_BADGE[u.admin_role] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        <ShieldCheck className="w-2.5 h-2.5" />
                        {u.admin_role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 border border-slate-700 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <UserCog className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No admin users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
