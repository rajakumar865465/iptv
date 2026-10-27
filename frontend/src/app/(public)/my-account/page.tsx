'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Package, Calendar, Tag, ArrowRight, Loader2, ShieldCheck, Download, Shield } from 'lucide-react';
import Link from 'next/link';
import { getPublicErrorMessage } from '@/lib/publicApi';
import LicenseKeyDisplay from '@/components/public/LicenseKeyDisplay';
import { useAuth } from '@/contexts/AuthContext';

interface PurchaseData {
  licenses: any[];
  orders: any[];
}

export default function MyAccount() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/');
      return;
    }

    fetch('/api/auth/my-purchases', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to load purchases');
        }
      })
      .catch(err => {
        setError(getPublicErrorMessage(err, 'Failed to load purchases'));
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-brand-600 rounded-lg text-white font-medium hover:bg-brand-500 transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  const licenses = data?.licenses || [];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--color-ink)]">My Account</h1>
          <p className="text-[var(--color-ink-muted)] mt-2">Manage your subscriptions and license keys.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-500" />
              Active Licenses
            </h2>

            {licenses.length === 0 ? (
              <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-8 text-center shadow-card">
                <Package className="w-12 h-12 text-[var(--color-ink-subtle)] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">No active subscriptions</h3>
                <p className="text-[var(--color-ink-muted)] mb-6 max-w-sm mx-auto">You don&apos;t have any active license keys yet. Purchase a plan to get started.</p>
                <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20">
                  View Plans <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {licenses.map(license => (
                  <div key={license.id} className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 relative overflow-hidden group shadow-card hover:shadow-card-hover transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-[var(--color-ink)]">{license.plan_name || 'Custom Plan'}</h3>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            license.status === 'active' ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20' :
                            'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                          }`}>
                            {String(license.status || 'unknown').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[var(--color-ink-muted)] text-sm flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-500" /> Max Devices: {license.max_devices}
                        </p>
                        {license.expires_at && (
                          <p className="text-[var(--color-ink-muted)] text-sm flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4 text-brand-500" /> Expires: {new Date(license.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 xl:mt-0 min-w-0 w-full xl:w-auto shrink-0">
                        <p className="text-xs font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider mb-2 xl:text-right hidden xl:block">License Key</p>
                        <div className="overflow-x-auto w-full">
                          <LicenseKeyDisplay licenseKey={license.license_key} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-500" />
              Quick Actions
            </h2>
            
            <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-6 space-y-4 shadow-card">
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
                    <h3 className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-brand-500 transition-colors">Upgrade Plan</h3>
                    <p className="text-xs text-[var(--color-ink-muted)]">Get more devices & validity</p>
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
