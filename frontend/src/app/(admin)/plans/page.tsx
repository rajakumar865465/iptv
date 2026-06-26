'use client';

import { useEffect, useState } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, CheckCircle, X, Package, Eye, EyeOff } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  max_devices: number;
  description: string;
  is_visible: boolean;
  status: string;
  sort_order?: number;
}

const emptyForm = { name: '', price: 0, duration_days: 30, max_devices: 1, description: '', is_visible: true, status: 'active', sort_order: 0 };

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPlans = () =>
    getPlans()
      .then((data: any) => setPlans(Array.isArray(data) ? data : (data?.data || [])))
      .finally(() => setLoading(false));

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (p: Plan) => {
    setForm({ name: p.name, price: p.price, duration_days: p.duration_days, max_devices: p.max_devices, description: p.description || '', is_visible: p.is_visible, status: p.status, sort_order: p.sort_order || 0 });
    setEditId(p.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await updatePlan(editId, form);
      } else {
        await createPlan(form);
      }
      setShowModal(false);
      fetchPlans();
    } catch {
      alert('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan? Users with active licenses on this plan will be unaffected, but new licenses cannot use it.')) return;
    setDeletingId(id);
    try {
      await deletePlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Plans</h1>
          <p className="text-slate-400 mt-1">Manage subscription tiers, pricing and device limits.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  {editId ? 'Edit Plan' : 'New Plan'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Monthly Basic" required className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Price (₹)</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} required className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration (days)</label>
                    <input type="number" min="1" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 30 })} required className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Max Devices</label>
                    <input type="number" min="1" value={form.max_devices} onChange={(e) => setForm({ ...form, max_devices: parseInt(e.target.value) || 1 })} required className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's included…" rows={2} className={`${inputCls} resize-none`} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setForm({ ...form, is_visible: !form.is_visible })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.is_visible ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-slate-300">Visible in app</span>
                </label>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                    {saving ? 'Saving…' : editId ? 'Update Plan' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {plans.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -4 }}
                className="relative rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-6 flex flex-col overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-full h-1 ${p.status === 'active' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-slate-700'}`} />
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-100">{p.name}</h3>
                  <div className="flex items-center gap-1.5">
                    {p.is_visible
                      ? <Eye className="w-4 h-4 text-emerald-400" />
                      : <EyeOff className="w-4 h-4 text-slate-500" />}
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-emerald-400 mb-4">₹{p.price}</p>
                <ul className="space-y-2 text-sm text-slate-400 mb-6 flex-1">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{p.duration_days} Days access</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{p.max_devices} Device{p.max_devices > 1 ? 's' : ''}</li>
                  {p.description && <li className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />{p.description}</li>}
                </ul>
                <div className="flex gap-2 pt-4 border-t border-slate-700/50">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-cyan-400 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/30 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {plans.length === 0 && (
            <div className="col-span-full rounded-2xl border border-slate-700/50 bg-slate-900/40 p-12 text-center">
              <Package className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No plans yet. Create your first subscription plan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
