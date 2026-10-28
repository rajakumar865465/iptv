'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Package, Calendar, Tag, ArrowRight, Loader2, ShieldCheck, Download, Shield, Receipt, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getPublicErrorMessage } from '@/lib/publicApi';
import LicenseKeyDisplay from '@/components/public/LicenseKeyDisplay';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionInfo {
  plan_name: string;
  plan_tier?: string;
  status: string;
  license_key: string;
  start_date: string;
  expiry_date: string;
  remaining_days: number;
  max_devices: number;
  total_active_licenses?: number;
}

interface PurchaseData {
  licenses: any[];
  orders: any[];
  subscription?: SubscriptionInfo | null;
}

export default function MyAccount() {
  const router = useRouter();
  const { user, token: ctxToken } = useAuth();
  const [data, setData] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    const token = ctxToken || localStorage.getItem('adminToken') || localStorage.getItem('userToken');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('/api/auth/my-purchases', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async res => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to load purchases');
        }
        return res.json();
      })
      .then(res => {
        if (res.success) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to load account data');
        }
      })
      .catch(err => {
        setError(getPublicErrorMessage(err, 'Failed to connect to server'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router, ctxToken]);

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-20 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-4 max-w-xl mx-auto text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-500">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const licenses = data?.licenses || [];
  const orders = data?.orders || [];
  const subscription = data?.subscription;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--color-ink)]">My Account</h1>
          <p className="text-[var(--color-ink-muted)] mt-1.5 text-sm sm:text-base">
            Manage your active subscriptions, stacked license keys, and order history.
          </p>
        </div>

        {/* Global Active Subscription Status Banner */}
        {subscription && (
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-brand-600/15 via-brand-500/10 to-[var(--color-surface)] border border-brand-500/30 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Active Subscription Window
                </span>
                {subscription.total_active_licenses && subscription.total_active_licenses > 1 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500 font-semibold border border-brand-500/25">
                    {subscription.total_active_licenses} Stacked Plans
                  </span>
                ) : null}
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)]">
                {subscription.plan_name}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-ink-muted)]">
                Total access valid until{' '}
                <strong className="text-[var(--color-ink)]">
                  {new Date(subscription.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </strong>{' '}
                ({subscription.remaining_days} days remaining &bull; {subscription.max_devices} {subscription.max_devices > 1 ? 'Devices' : 'Device'})
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02]"
              >
                Extend (+30 Days) <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-500" />
              Active Licenses ({licenses.length})
            </h2>

            {licenses.length === 0 ? (
              <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-8 text-center shadow-card">
                <Package className="w-12 h-12 text-[var(--color-ink-subtle)] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">No active subscriptions</h3>
                <p className="text-[var(--color-ink-muted)] mb-6 max-w-sm mx-auto text-sm">
                  You don&apos;t have any active license keys yet. Purchase a plan to get started.
                </p>
                <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20">
                  View Plans <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {licenses.map(license => {
                  const isPaidPro = license.plan_id === 63 || (license.plan_name && license.plan_name.toLowerCase().includes('pro') && !license.plan_name.toLowerCase().includes('trial'));
                  const isTrial = license.plan_id === 64 || (license.plan_name && license.plan_name.toLowerCase().includes('trial'));

                  return (
                    <div key={license.id} className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-5 sm:p-6 relative overflow-hidden group shadow-card hover:shadow-card-hover transition-all">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                        <div className="shrink-0 space-y-1.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-bold text-[var(--color-ink)] whitespace-nowrap">
                              {license.plan_name || 'Custom Plan'}
                            </h3>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${
                              license.status === 'active' ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25' :
                              'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                            }`}>
                              {String(license.status || 'unknown').toUpperCase()}
                            </span>
                            {isPaidPro && (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-brand-500/15 text-brand-500 border border-brand-500/25 whitespace-nowrap">
                                Paid Plan &bull; 2 Devices
                              </span>
                            )}
                            {isTrial && (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
                                Free Trial &bull; 1 Device
                              </span>
                            )}
                          </div>
                          <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap">
                            <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0" /> Max Devices: {license.max_devices}
                          </p>
                          {license.expires_at && (
                            <p className="text-[var(--color-ink-muted)] text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap">
                              <Calendar className="w-4 h-4 text-brand-500 shrink-0" /> Expires: {new Date(license.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 sm:max-w-md">
                          <p className="text-[11px] font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider mb-1.5 md:text-right hidden sm:block">
                            License Key
                          </p>
                          <LicenseKeyDisplay licenseKey={license.license_key} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Orders & Purchases History */}
            {orders.length > 0 && (
              <div className="space-y-4 pt-6">
                <h2 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-brand-500" />
                  Order & Payment History ({orders.length})
                </h2>
                <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl overflow-hidden shadow-card">
                  <div className="divide-y divide-[var(--color-line)]">
                    {orders.map((order) => (
                      <div key={order.order_id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--color-surface-2)]/50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--color-ink)] text-sm sm:text-base">
                              {order.plan_name || 'Pro Plan'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink-muted)] border border-[var(--color-line)]">
                              {order.duration_days ? `${order.duration_days} Days` : '30 Days'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                              order.status === 'paid' ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25' :
                              order.status === 'pending' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25' :
                              'bg-slate-500/15 text-slate-500 border border-slate-500/20'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--color-ink-subtle)] flex items-center gap-2 flex-wrap">
                            <span>Order ID: <code className="text-[var(--color-ink-muted)] font-mono">{order.order_id}</code></span>
                            <span>&bull;</span>
                            <span>{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <div className="font-bold text-base sm:text-lg text-[var(--color-ink)]">
                            {order.amount === 0 ? '₹0 Free' : `₹${order.amount}`}
                          </div>
                          <div className="text-[11px] text-[var(--color-ink-subtle)] uppercase">
                            {order.payment_mode === 'manual' ? 'Manual UPI' : 'Razorpay'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <h2 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-500" />
              Quick Actions
            </h2>
            
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-card">
              {isAdmin && (
                <Link href="/dashboard" className="flex items-center justify-between p-4 bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/30 rounded-xl transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-brand-500 transition-colors">Admin Dashboard</h3>
                      <p className="text-xs text-[var(--color-ink-muted)]">Manage channels, orders & users</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-brand-500 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
              
              <Link href="/pricing" className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)]/80 border border-[var(--color-line)] rounded-xl transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/15 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-brand-500 transition-colors">Extend / Upgrade Plan</h3>
                    <p className="text-xs text-[var(--color-ink-muted)]">+30 Days stacks to existing validity</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--color-ink-subtle)] group-hover:text-brand-500 transition-colors" />
              </Link>
              
              <Link href="/download" className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-2)]/80 border border-[var(--color-line)] rounded-xl transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Download className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-emerald-500 transition-colors">Download App</h3>
                    <p className="text-xs text-[var(--color-ink-muted)]">Install on your Android TV</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--color-ink-subtle)] group-hover:text-emerald-500 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
