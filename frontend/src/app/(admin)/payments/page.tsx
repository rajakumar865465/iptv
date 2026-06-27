'use client';

import { useEffect, useState } from 'react';
import { getPayments, updatePaymentStatus } from '@/lib/api';
import { motion } from 'framer-motion';
import { CreditCard, Search, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface Payment {
  id: string; full_name: string; email: string; plan_name: string;
  amount: number; status: string; payment_method: string; created_at: string; transaction_id: string;
}

const STATUS_CLS: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  failed:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
  refunded:  'bg-slate-800 text-slate-400 border-slate-700',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1); const PAGE = 50;

  const fetchPayments = () => {
    setLoading(true);
    getPayments().then((d) => setPayments(d || [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayments(); }, []);

  const handleUpdate = async (id: string, status: string, label: string) => {
    if (!confirm(`${label} this payment?`)) return;
    setActionId(id);
    try { await updatePaymentStatus(id, status); setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status } : p)); }
    catch { alert('Failed to update payment'); }
    finally { setActionId(null); }
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const ms = !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.plan_name?.toLowerCase().includes(q) || p.transaction_id?.toLowerCase().includes(q);
    const mf = !statusFilter || p.status === statusFilter;
    return ms && mf;
  });

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (parseFloat(p.amount as any) || 0), 0);
  const pending = payments.filter(p => p.status === 'pending').length;

  const paginated = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Payments</h1>
          <p className="text-slate-400 mt-1">{payments.length} total — ₹{totalRevenue.toLocaleString('en-IN')} collected — <span className="text-amber-400">{pending} pending</span></p>
        </div>
        <button onClick={fetchPayments} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 self-start"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', val: `₹${totalRevenue.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
          { label: 'Pending Approval', val: pending, color: 'text-amber-400' },
          { label: 'Total Payments', val: payments.length, color: 'text-cyan-400' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search user, plan, txn ID…" className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none" /></div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {['pending','completed','failed','refunded'].map(s => <option key={s}>{s}</option>)}
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
                    <th className="px-6 py-4">User</th><th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">Amount</th><th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4">Status</th><th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {paginated.map((p) => (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-200">{p.full_name || '—'}</p>
                        <p className="text-xs text-slate-500">{p.email}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{p.plan_name || '—'}</td>
                      <td className="px-6 py-4 font-bold text-emerald-400">₹{parseFloat(p.amount as any).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-slate-400 capitalize text-xs">{p.payment_method || 'manual'}</td>
                      <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${STATUS_CLS[p.status]||STATUS_CLS.refunded}`}>{p.status}</span></td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === 'pending' && (
                            <>
                              <button disabled={actionId===p.id} onClick={() => handleUpdate(p.id, 'completed', 'Approve')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 border border-slate-700 disabled:opacity-50">
                                <CheckCircle className="w-3.5 h-3.5" />Approve
                              </button>
                              <button disabled={actionId===p.id} onClick={() => handleUpdate(p.id, 'failed', 'Reject')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700 disabled:opacity-50">
                                <XCircle className="w-3.5 h-3.5" />Reject
                              </button>
                            </>
                          )}
                          {p.status === 'completed' && (
                            <button disabled={actionId===p.id} onClick={() => handleUpdate(p.id, 'refunded', 'Refund')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 disabled:opacity-50">Refund</button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {paginated.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500"><CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-600" />No payments found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {pages}</span>
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
