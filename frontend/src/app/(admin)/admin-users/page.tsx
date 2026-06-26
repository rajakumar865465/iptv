'use client';

import { useEffect, useState } from 'react';
import { getAdminUsers, createAdminUser, updateAdminUser } from '@/lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', mobile: '', password: '', admin_role: 'admin' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    getAdminUsers()
      .then((data) => setUsers(data || []))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminUser(form);
      setShowModal(false);
      fetchUsers();
    } catch {
      alert('Failed');
    }
  };

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Users</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700">+ New Admin</button>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Admin</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400">Name</th>
              <th className="px-4 py-3 text-left text-gray-400">Email</th>
              <th className="px-4 py-3 text-left text-gray-400">Role</th>
              <th className="px-4 py-3 text-left text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3 text-gray-400">{u.admin_role}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-6 text-gray-500 text-center">No admin users</p>}
      </div>
    </div>
  );
}
