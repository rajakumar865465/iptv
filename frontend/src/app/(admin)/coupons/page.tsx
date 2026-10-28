'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Tag, Plus, Search, Trash2, Edit2, CheckCircle2, XCircle, AlertCircle,
  Copy, Check, Calendar, ArrowUpRight, Percent, IndianRupee, RefreshCw
} from 'lucide-react';
import {
  getAdminCoupons, createAdminCoupon, updateAdminCoupon, deleteAdminCoupon,
  type AdminCoupon
} from '@/lib/api';
import { getPublicPlans, type Plan } from '@/lib/publicApi';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    plan_id: '',
    max_uses: '',
    expires_at: '',
    is_active: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cData, pData] = await Promise.all([
        getAdminCoupons(),
        getPublicPlans().catch(() => []),
      ]);
      setCoupons(cData || []);
      setPlans(pData || []);
    } catch (err) {
      console.error('Failed to load coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount_amount: '',
      plan_id: '',
      max_uses: '',
      expires_at: '',
      is_active: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (c: AdminCoupon) => {
    setEditingCoupon(c);
    setFormData({
      code: c.code,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order_amount: c.min_order_amount ? String(c.min_order_amount) : '',
      max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount) : '',
      plan_id: c.plan_id ? String(c.plan_id) : '',
      max_uses: c.max_uses ? String(c.max_uses) : '',
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().split('T')[0] : '',
      is_active: c.is_active,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleToggleActive = async (c: AdminCoupon) => {
    try {
      const updated = await updateAdminCoupon(c.id, { is_active: !c.is_active });
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: updated.is_active } : x));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (c: AdminCoupon) => {
    if (!confirm(`Are you sure you want to delete coupon "${c.code}"?`)) return;
    try {
      await deleteAdminCoupon(c.id);
      setCoupons(prev => prev.filter(x => x.id !== c.id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete coupon');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.code.trim()) {
      return setFormError('Coupon code is required');
    }
    const val = Number(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      return setFormError('Please enter a valid discount value');
    }
    if (formData.discount_type === 'percentage' && val > 100) {
      return setFormError('Percentage discount cannot exceed 100%');
    }

    setSubmitting(true);
    try {
      const payload: Partial<AdminCoupon> = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        discount_type: formData.discount_type,
        discount_value: val,
        min_order_amount: formData.min_order_amount ? Number(formData.min_order_amount) : 0,
        max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
        plan_id: formData.plan_id ? Number(formData.plan_id) : null,
        max_uses: formData.max_uses ? Number(formData.max_uses) : null,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        const updated = await updateAdminCoupon(editingCoupon.id, payload);
        setCoupons(prev => prev.map(x => x.id === editingCoupon.id ? updated : x));
      } else {
        const created = await createAdminCoupon(payload);
        setCoupons(prev => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCoupons = useMemo(() => {
    return coupons.filter(c => {
      const matchSearch = !search || c.code.toLowerCase().includes(search.toLowerCase()) || (c.description || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && c.is_active) || (statusFilter === 'inactive' && !c.is_active);
      return matchSearch && matchStatus;
    });
  }, [coupons, search, statusFilter]);

  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter(c => c.is_active).length;
    const totalUsed = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0);
    return { total, active, totalUsed };
  }, [coupons]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-brand-500" />
            Coupons & Discounts
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Create and manage promotional discount codes linked to Razorpay checkout.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Coupons</p>
          <p className="text-2xl font-extrabold text-white mt-1.5">{stats.total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Active Promotions</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1.5">{stats.active}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Redemptions</p>
          <p className="text-2xl font-extrabold text-brand-400 mt-1.5">{stats.totalUsed}</p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search coupon code or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh coupons"
            className="p-2.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/60 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Code & Description</th>
                <th className="px-5 py-3.5 font-semibold">Discount</th>
                <th className="px-5 py-3.5 font-semibold">Applies To</th>
                <th className="px-5 py-3.5 font-semibold">Redemptions</th>
                <th className="px-5 py-3.5 font-semibold">Valid Until</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading && coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    Loading coupons...
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    No coupons found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCoupons.map(c => {
                  const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                  return (
                    <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                      {/* Code */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white bg-brand-500/10 border border-brand-500/25 px-2.5 py-1 rounded-lg text-xs tracking-wide">
                            {c.code}
                          </span>
                          <button
                            onClick={() => handleCopy(c.code)}
                            title="Copy code"
                            className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer p-1"
                          >
                            {copiedCode === c.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {c.description && (
                          <p className="text-gray-400 text-xs mt-1 max-w-xs truncate">{c.description}</p>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-1 font-bold text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          {c.discount_type === 'percentage' ? (
                            <>
                              <Percent className="w-3 h-3" />
                              <span>{c.discount_value}% OFF</span>
                            </>
                          ) : (
                            <>
                              <IndianRupee className="w-3 h-3" />
                              <span>₹{c.discount_value} OFF</span>
                            </>
                          )}
                        </div>
                        {c.max_discount_amount && Number(c.max_discount_amount) > 0 && (
                          <p className="text-gray-500 text-[11px] mt-0.5">Max ₹{c.max_discount_amount}</p>
                        )}
                      </td>

                      {/* Applies To */}
                      <td className="px-5 py-4">
                        <div className="text-gray-300 text-xs">
                          {c.plan_name ? (
                            <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-medium">
                              {c.plan_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">All Plans</span>
                          )}
                        </div>
                        {c.min_order_amount > 0 && (
                          <p className="text-gray-500 text-[11px] mt-0.5">Min: ₹{c.min_order_amount}</p>
                        )}
                      </td>

                      {/* Redemptions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="font-semibold text-white">{c.used_count}</span>
                          <span className="text-gray-500">/ {c.max_uses ? c.max_uses : '∞'}</span>
                        </div>
                        {c.max_uses && (
                          <div className="w-20 bg-gray-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className="bg-brand-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (c.used_count / c.max_uses) * 100)}%` }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="px-5 py-4 text-xs">
                        {c.expires_at ? (
                          <div className={isExpired ? 'text-red-400 font-medium' : 'text-gray-300'}>
                            {new Date(c.expires_at).toLocaleDateString()}
                            {isExpired && <span className="block text-[10px] uppercase font-bold text-red-500">Expired</span>}
                          </div>
                        ) : (
                          <span className="text-gray-500">No Expiry</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleActive(c)}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            c.is_active && !isExpired
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                          }`}
                        >
                          {c.is_active && !isExpired ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-400" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(c)}
                            title="Edit Coupon"
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            title="Delete Coupon"
                            className="p-1.5 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SAVE20"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  disabled={!!editingCoupon}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 uppercase disabled:opacity-50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. 20% discount on Annual Plus plan"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Discount Type *
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={e => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={formData.discount_type === 'percentage' ? '10' : '50'}
                    value={formData.discount_value}
                    onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.min_order_amount}
                    onChange={e => setFormData({ ...formData, min_order_amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="Optional cap"
                    value={formData.max_discount_amount}
                    onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Plan Restriction & Max Uses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Restrict to Plan
                  </label>
                  <select
                    value={formData.plan_id}
                    onChange={e => setFormData({ ...formData, plan_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">All Plans (No restriction)</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Max Usage Limit
                  </label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={formData.max_uses}
                    onChange={e => setFormData({ ...formData, max_uses: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Expiration Date & Active Toggle */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-gray-950 border-gray-800"
                    />
                    <span>Active and Redeemable</span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-500/25 cursor-pointer flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
