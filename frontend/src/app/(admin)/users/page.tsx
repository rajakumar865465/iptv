'use client';

import { useEffect, useState } from 'react';
import { getUsers, updateUserStatus } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCheck, UserX, Shield, Clock } from 'lucide-react';

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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getUsers()
      .then((data) => setUsers(data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateUserStatus(id, status);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
    } catch {
      alert('Failed to update status');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.mobile?.includes(search)
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            User Management
          </h1>
          <p className="text-slate-400 mt-1">Manage all registered users, roles, and access statuses.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 backdrop-blur-xl transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Status & Role</th>
                  <th className="px-6 py-4 font-semibold">Joined Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody 
                variants={containerVariants} 
                initial="hidden" 
                animate="show"
                className="divide-y divide-slate-700/50"
              >
                <AnimatePresence>
                  {filteredUsers.map((u) => (
                    <motion.tr 
                      variants={itemVariants}
                      key={u.id} 
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
                            {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">{u.full_name}</p>
                            <p className="text-xs text-slate-500">ID: {u.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-300">{u.email}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.mobile}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            u.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {u.status}
                          </span>
                          {u.role === 'admin' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                              <Shield className="w-3 h-3" /> Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleStatusChange(u.id, u.status === 'active' ? 'blocked' : 'active')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            u.status === 'active'
                              ? 'bg-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-slate-700'
                              : 'bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-slate-700'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <><UserX className="w-3.5 h-3.5" /> Block</>
                          ) : (
                            <><UserCheck className="w-3.5 h-3.5" /> Unblock</>
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 text-slate-600 mb-2" />
                        <p>No users found matching "{search}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
