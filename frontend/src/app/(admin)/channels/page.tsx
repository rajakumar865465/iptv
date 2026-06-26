'use client';

import { useEffect, useState } from 'react';
import { getChannels, createChannel, updateChannel, deleteChannel } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, Tv, Activity, Globe2, Languages, Signal, X } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  logo_url: string;
  stream_url: string;
  category_name: string;
  language: string;
  quality: string;
  status: string;
  health_status: string;
  is_premium: boolean;
  is_featured: boolean;
}

function HealthBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string, border: string, text: string, icon: React.ReactNode }> = {
    online: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> },
    offline: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: <div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> },
    unstable: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> },
  };
  const conf = configs[status] || { bg: 'bg-slate-800', border: 'border-slate-700', text: 'text-slate-400', icon: <div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${conf.bg} ${conf.border} ${conf.text}`}>
      {conf.icon}
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
      status === 'active' 
        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
        : 'bg-slate-800 text-slate-400 border-slate-700'
    }`}>
      {status}
    </span>
  );
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', stream_url: '', category_id: '', language: 'Hindi', quality: 'HD', status: 'active' });

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = () => {
    getChannels()
      .then((data) => setChannels(data || []))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createChannel(form);
      setShowModal(false);
      setForm({ name: '', stream_url: '', category_id: '', language: 'Hindi', quality: 'HD', status: 'active' });
      fetchChannels();
    } catch {
      alert('Failed to create channel');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    try {
      await deleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed to delete channel');
    }
  };

  const filteredChannels = channels.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.category_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.language?.toLowerCase().includes(search.toLowerCase())
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
    <div className="space-y-6 pb-10 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Channels
          </h1>
          <p className="text-slate-400 mt-1">Manage streams, categories, and monitor health.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 backdrop-blur-xl transition-all"
            />
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Channel</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-cyan-400" />
                  Add New Channel
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Channel Name</label>
                  <input placeholder="e.g., Star Sports" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" required />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stream URL (M3U8)</label>
                  <input placeholder="http://..." value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category ID</label>
                    <input placeholder="e.g., 5" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Language</label>
                    <input placeholder="Hindi" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quality</label>
                  <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none">
                    <option value="SD">SD</option>
                    <option value="HD">HD</option>
                    <option value="FHD">FHD</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 transition-colors border border-slate-700">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all">Create Channel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <th className="px-6 py-4 font-semibold">Channel Details</th>
                  <th className="px-6 py-4 font-semibold">Meta</th>
                  <th className="px-6 py-4 font-semibold">Health & Status</th>
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
                  {filteredChannels.map((c) => (
                    <motion.tr 
                      variants={itemVariants}
                      key={c.id} 
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-400 overflow-hidden shrink-0">
                            {c.logo_url ? (
                              <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain p-1" />
                            ) : (
                              <Tv className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors line-clamp-1">{c.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                {c.quality || 'HD'}
                              </span>
                              {c.is_premium && (
                                <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                  Premium
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Globe2 className="w-3.5 h-3.5 text-slate-500" />
                            {c.category_name || 'Uncategorized'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Languages className="w-3.5 h-3.5 text-slate-500" />
                            {c.language || 'Unknown'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          <HealthBadge status={c.health_status} />
                          <StatusBadge status={c.status} />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleDelete(c.id)} 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-slate-700 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {filteredChannels.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Signal className="w-8 h-8 text-slate-600 mb-2" />
                        <p>No channels found matching "{search}"</p>
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
