'use client';
import { useState } from 'react';
import { Key, Search, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { checkLicense } from '@/lib/publicApi';
import type { LicenseCheckResult } from '@/lib/publicApi';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unused: { label: 'Not Activated', color: 'text-amber-400' },
  active: { label: 'Active', color: 'text-green-400' },
  expired: { label: 'Expired', color: 'text-indigo-400' },
  suspended: { label: 'Suspended', color: 'text-orange-400' },
  revoked: { label: 'Revoked', color: 'text-red-500' },
};

export default function LicensePage() {
  const [key, setKey] = useState('');
  const [result, setResult] = useState<LicenseCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setError('');
    setResult(null);
    if (!key.trim()) return setError('Please enter a license key.');
    setLoading(true);
    try {
      const data = await checkLicense({ license_key: key.trim().toUpperCase() });
      setResult(data);
    } catch {
      setError('License key not found. Please check the key and try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusCfg = result ? (STATUS_CONFIG[result.status] || { label: result.status, color: 'text-slate-400' }) : null;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center mx-auto mb-4">
            <Key className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">License Status</h1>
          <p className="text-slate-400 text-sm">Enter your license key to check its current status.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">License Key</label>
          <input
            type="text"
            placeholder="NVT-XXXX-XXXX-XXXX"
            value={key}
            onChange={e => setKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500/50 mb-4"
          />
          <button
            onClick={handleCheck}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Checking...' : 'Check License'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 text-sm px-4 py-3 rounded-xl mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {result && statusCfg && (
          <div className="mt-8 rounded-3xl bg-[#141414] border border-white/10 overflow-hidden shadow-2xl">
            {/* Header section */}
            <div className="p-8 pb-6 border-b border-white/5 flex flex-col items-center justify-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${
                result.status === 'active' ? 'bg-green-500/10 text-green-400' : 
                result.status === 'expired' ? 'bg-red-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {result.status === 'active' ? <CheckCircle className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
              </div>
              <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">License {statusCfg.label}</h2>
              <p className="text-sm text-slate-400 font-mono tracking-wider">{result.license_key || 'UNKNOWN-KEY'}</p>
            </div>
            
            {/* List section */}
            <div className="p-2">
              <ul className="flex flex-col">
                {[
                  { label: 'Subscription Plan', value: result.plan_name || 'Custom Plan' },
                  { label: 'Duration', value: result.duration_days >= 365 ? `${Math.round(result.duration_days/365)} Years` : result.duration_days >= 30 ? `${Math.round(result.duration_days/30)} Months` : `${result.duration_days} Days` },
                  { label: 'Device Usage', value: `${result.devices_used} of ${result.max_devices} Active` },
                  { label: 'Activation Date', value: result.activated_at ? new Date(result.activated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Pending' },
                  { label: 'Expiration Date', value: result.expires_at ? new Date(result.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never' },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors rounded-xl">
                    <span className="text-slate-400 text-sm">{item.label}</span>
                    <span className="text-white font-medium text-sm">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
