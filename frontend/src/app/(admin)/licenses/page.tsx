'use client';

import { useEffect, useState } from 'react';
import { getLicenses, getPlans, createLicense, extendLicense, suspendLicense, revokeLicense, getErrorMessage } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, KeyRound, X, Copy, Check, Search, RefreshCw, ChevronLeft, ChevronRight, Download, AlertTriangle } from 'lucide-react';

interface License {
  id: string; license_key: string; plan_name: string; user_email: string;
  status: string; duration_days: number; max_devices: number;
  activated_at: string; expires_at: string; created_at: string;
}

interface Plan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
}

const STATUS_CLS: Record<string, string> = {
  active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  unused:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  expired:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
  suspended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  revoked:   'bg-slate-800 text-slate-400 border-slate-700',
};

function CopyKey({ k }: { k: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(k); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-300 hover:text-cyan-400 transition-colors">
      {k}
      {copied ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 text-slate-500 shrink-0" />}
    </button>
  );
}

function ConfirmModal({ 
  open, title, message, confirmText, confirmVariant, onConfirm, onCancel 
}: { 
  open: boolean; title: string; message: string; confirmText: string; confirmVariant: 'rose'|'amber'|'cyan'; 
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  const btnCls = {
    rose:   'bg-rose-500 hover:bg-rose-600 text-white',
    amber:  'bg-amber-500 hover:bg-amber-600 text-white',
    cyan:   'bg-cyan-500 hover:bg-cyan-600 text-white',
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700"><AlertTriangle className="w-5 h-5 text-amber-400" /></div>
          <h3 className="text-lg font-bold text-slate-100">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-semibold ${btnCls[confirmVariant]}`}>{confirmText}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [bulkCount, setBulkCount] = useState(1);
  const [form, setForm] = useState({ plan_id: '', duration_days: 30, max_devices: 1 });
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1); const PAGE = 20;
  
  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; confirmText: string; confirmVariant: 'rose'|'amber'|'cyan'; action: () => void }>({
    title: '', message: '', confirmText: '', confirmVariant: 'rose', action: () => {}
  });

  useEffect(() => { void Promise.resolve().then(() => fetchAll()); }, []);

  function fetchAll() {
    setLoading(true);
    Promise.all([getLicenses(), getPlans()])
      .then(([licData, plnData]) => {
        setLicenses(Array.isArray(licData) ? licData : []);
        setPlans(Array.isArray(plnData) ? plnData : []);
      })
      .catch(err => {
        console.error('Failed to fetch licenses:', err);
        alert('Error: ' + getErrorMessage(err, 'Failed to load licenses'));
      })
      .finally(() => setLoading(false));
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { plan_id: form.plan_id ? parseInt(form.plan_id) : null, duration_days: form.duration_days, max_devices: form.max_devices };
      for (let i = 0; i < bulkCount; i++) { await createLicense(payload as Record<string, unknown>); }
      setShowModal(false); fetchAll();
    } catch { alert('Failed to create license'); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const headers = ['Key', 'Plan', 'User Email', 'Status', 'Days', 'Devices', 'Expires', 'Created'];
    const rows = filtered.map(l => [
      l.license_key, l.plan_name, l.user_email, l.status, l.duration_days, l.max_devices, 
      l.expires_at ? new Date(l.expires_at).toISOString().split('T')[0] : '', 
      l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `licenses-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const requestConfirm = (title: string, message: string, confirmText: string, confirmVariant: 'rose'|'amber'|'cyan', action: () => void) => {
    setConfirmConfig({ title, message, confirmText, confirmVariant, action });
    setConfirmOpen(true);
  };

  const act = async (fn: Promise<unknown>, id: string) => {
    setActionId(id); try { await fn; fetchAll(); } catch { alert('Action failed'); } finally { setActionId(null); }
  };

  const filtered = licenses.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.license_key?.toLowerCase().includes(q) || l.user_email?.toLowerCase().includes(q) || l.plan_name?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const paginated = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const ic = 'w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm';

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Licenses</h1>
          <p className="text-slate-400 mt-1">{licenses.length} total — {licenses.filter(l=>l.status==='active').length} active</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-sm" title="Export CSV">
            <Download className="w-4 h-4" /><span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={fetchAll} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 transition-all">
            <Plus className="w-4 h-4" />Generate
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><KeyRound className="w-5 h-5 text-emerald-400" />Generate License(s)</h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</label>
                  <select value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} className={ic}>
                    <option value="">Custom (no plan)</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price} / {p.duration_days}d</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Days</label><input type="number" min="1" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value)||30 })} className={ic} /></div>
                  <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Devices</label><input type="number" min="1" value={form.max_devices} onChange={(e) => setForm({ ...form, max_devices: parseInt(e.target.value)||1 })} className={ic} /></div>
                  <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Qty</label><input type="number" min="1" max="100" value={bulkCount} onChange={(e) => setBulkCount(parseInt(e.target.value)||1)} className={ic} /></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold disabled:opacity-50">{saving ? 'Creating…' : `Generate ${bulkCount > 1 ? bulkCount + ' Keys' : 'Key'}`}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        open={confirmOpen} 
        {...confirmConfig} 
        onConfirm={() => { setConfirmOpen(false); confirmConfig.action(); }} 
        onCancel={() => setConfirmOpen(false)} 
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search key, email, plan…" className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" /></div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {['active','unused','expired','suspended','revoked'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-4">License Key</th><th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">User</th><th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Expires</th><th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {paginated.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3"><CopyKey k={l.license_key} /></td>
                      <td className="px-6 py-3 text-slate-400">{l.plan_name || '—'}</td>
                      <td className="px-6 py-3 text-slate-400 text-xs">{l.user_email || <span className="text-slate-600 italic">Unassigned</span>}</td>
                      <td className="px-6 py-3"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${STATUS_CLS[l.status]||STATUS_CLS.revoked}`}>{l.status}</span></td>
                      <td className="px-6 py-3 text-slate-500 text-xs">{l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {['active','unused'].includes(l.status) && <button disabled={actionId===l.id} onClick={() => requestConfirm('Extend License', `Add 30 days to this license?`, 'Extend', 'cyan', () => act(extendLicense(l.id, 30), l.id))} className="px-2 py-1 text-xs rounded-lg bg-slate-800 text-cyan-400 hover:bg-cyan-500/10 border border-slate-700 disabled:opacity-50">+30d</button>}
                          {l.status === 'active' && <button disabled={actionId===l.id} onClick={() => requestConfirm('Suspend License', 'This will temporarily disable the license. You can reactivate it later.', 'Suspend', 'amber', () => act(suspendLicense(l.id), l.id))} className="px-2 py-1 text-xs rounded-lg bg-slate-800 text-amber-400 hover:bg-amber-500/10 border border-slate-700 disabled:opacity-50">Suspend</button>}
                          {!['revoked','expired'].includes(l.status) && <button disabled={actionId===l.id} onClick={() => requestConfirm('Revoke License', 'This will permanently revoke the license. The user will lose access immediately. This cannot be undone.', 'Revoke', 'rose', () => act(revokeLicense(l.id), l.id))} className="px-2 py-1 text-xs rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700 disabled:opacity-50">Revoke</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500"><KeyRound className="w-8 h-8 mx-auto mb-2 text-slate-600" />No licenses found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {pages} ({filtered.length} results)</span>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={() => setPage(page-1)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page>=pages} onClick={() => setPage(page+1)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
