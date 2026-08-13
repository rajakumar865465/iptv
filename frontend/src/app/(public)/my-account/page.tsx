'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Package, Calendar, Tag, ArrowRight, Loader2, ShieldCheck, Download } from 'lucide-react';
import Link from 'next/link';
import { getPublicErrorMessage } from '@/lib/publicApi';

interface PurchaseData {
  licenses: any[];
  orders: any[];
}

export default function MyAccount() {
  const router = useRouter();
  const [data, setData] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        if (res.status === 'success') {
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
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-brand-600 rounded-lg text-white">Retry</button>
        </div>
      </div>
    );
  }

  const licenses = data?.licenses || [];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-extrabold text-white">My Account</h1>
          <p className="text-slate-400 mt-2">Manage your subscriptions and license keys.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-500" />
              Active Licenses
            </h2>

            {licenses.length === 0 ? (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-8 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No active subscriptions</h3>
                <p className="text-slate-400 mb-6 max-w-sm mx-auto">You don't have any active license keys yet. Purchase a plan to get started.</p>
                <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors">
                  View Plans <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {licenses.map(license => (
                  <div key={license.id} className="bg-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white">{license.plan_name || 'Custom Plan'}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            license.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}>
                            {license.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" /> Max Devices: {license.max_devices}
                        </p>
                        {license.expires_at && (
                          <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" /> Expires: {new Date(license.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center sm:text-right shrink-0">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">License Key</p>
                        <p className="font-mono text-lg text-white tracking-widest">{license.license_key}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-500" />
              Quick Actions
            </h2>
            
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
              <Link href="/pricing" className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">Upgrade Plan</h3>
                    <p className="text-xs text-slate-400">Get more devices & validity</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-brand-400 transition-colors" />
              </Link>
              
              <Link href="/download" className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Download className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">Download App</h3>
                    <p className="text-xs text-slate-400">Install on your Android TV</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
