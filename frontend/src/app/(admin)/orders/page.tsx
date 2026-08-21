'use client';

import { useEffect, useState } from 'react';
import { getOrders, getOrderStats, approveOrder, rejectOrder } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Search, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;
  
  // Reject modal state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchOrders = () => {
    setLoading(true);
    Promise.all([
      getOrders({ page, limit: LIMIT, search, status: statusFilter }),
      getOrderStats()
    ]).then(([ordersData, statsData]) => {
      setOrders(ordersData.data || []);
      setTotal(ordersData.pagination?.total || 0);
      setStats(statsData || {});
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [page, search, statusFilter]);

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to APPROVE this order? This will activate the user\'s subscription.')) return;
    setActionId(id);
    try {
      await approveOrder(id);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve order');
    } finally {
      setActionId(null);
    }
  };

  const handleRejectClick = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setRejectOpen(true);
  };

  const submitReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setActionId(rejectId);
    setRejectOpen(false);
    try {
      await rejectOrder(rejectId, rejectReason);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject order');
    } finally {
      setActionId(null);
      setRejectId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Manual Orders</h1>
          <p className="text-slate-400 mt-1">Review UPI payments sent via WhatsApp</p>
        </div>
        <button onClick={fetchOrders} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending', val: stats.pendingOrders || 0, color: 'text-amber-400', icon: AlertTriangle },
          { label: 'Approved', val: stats.approvedOrders || 0, color: 'text-emerald-400', icon: CheckCircle },
          { label: 'Today Rev', val: `₹${(stats.todayRevenue || 0).toLocaleString('en-IN')}`, color: 'text-cyan-400', icon: CreditCard },
          { label: 'Total Rev', val: `₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}`, color: 'text-indigo-400', icon: CreditCard },
        ].map(c => (
          <div key={c.label} className="relative overflow-hidden rounded-2xl p-4 border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl">
            <div className="relative z-10">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            onKeyDown={(e) => { if(e.key==='Enter') fetchOrders(); }}
            placeholder="Search Order ID, Email, Mobile, UTR..." 
            className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" 
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex justify-center h-48 items-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Contact</th>
                    <th className="px-4 py-4">Plan / Amount</th>
                    <th className="px-4 py-4">UTR Number</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {orders.map((o) => (
                    <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-200">{o.full_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{o.order_id}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-slate-300">{o.mobile}</p>
                        <p className="text-xs text-slate-500">{o.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-slate-300">{o.plan_name}</p>
                        <p className="font-bold text-emerald-400">₹{parseFloat(o.amount).toLocaleString('en-IN')}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-slate-300 bg-slate-800/50 px-2 py-1 rounded inline-block">{o.utr_number}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(o.payment_date).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          o.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          o.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {o.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button disabled={actionId===o.id} onClick={() => handleApprove(o.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-emerald-400 hover:bg-emerald-500/10 border border-slate-700 disabled:opacity-50">
                              <CheckCircle className="w-3.5 h-3.5" />Approve
                            </button>
                            <button disabled={actionId===o.id} onClick={() => handleRejectClick(o.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700 disabled:opacity-50">
                              <XCircle className="w-3.5 h-3.5" />Reject
                            </button>
                          </div>
                        )}
                        {o.status === 'rejected' && o.rejection_reason && (
                           <div className="text-[10px] text-rose-400/80 bg-rose-500/10 p-1.5 rounded max-w-[150px] ml-auto truncate" title={o.rejection_reason}>
                             {o.rejection_reason}
                           </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No orders found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          
          {total > LIMIT && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / LIMIT)} ({total} results)</span>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={() => setPage(page-1)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page>=Math.ceil(total / LIMIT)} onClick={() => setPage(page+1)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700"><XCircle className="w-5 h-5 text-rose-400" /></div>
                <h3 className="text-lg font-bold text-slate-100">Reject Order</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">Are you sure you want to reject this order? Please provide a reason for rejection.</p>
              
              <div className="mb-6">
                <label className="block text-slate-400 text-xs mb-1.5">Reason for rejection (Required)</label>
                <select 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 text-sm mb-3"
                >
                  <option value="">Select a reason...</option>
                  <option value="Invalid UTR Number">Invalid UTR Number</option>
                  <option value="Duplicate Payment Details">Duplicate Payment Details</option>
                  <option value="Payment not received">Payment not received in Bank</option>
                  <option value="Amount mismatch">Amount mismatch</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setRejectOpen(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
                <button 
                  onClick={submitReject} 
                  disabled={!rejectReason}
                  className="flex-1 py-2.5 rounded-xl font-semibold bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
