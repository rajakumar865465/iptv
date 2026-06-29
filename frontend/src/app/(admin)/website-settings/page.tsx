'use client';
import { useEffect, useState } from 'react';
import { Save, Globe, Loader2, CheckCircle } from 'lucide-react';
import { getWebsiteSettings, updateWebsiteSettings } from '@/lib/api';

const FIELDS = [
  { key: 'app_name', label: 'App Name', placeholder: 'IPTV Live', type: 'text' },
  { key: 'hero_title', label: 'Hero Title', placeholder: 'Watch Live TV Anytime', type: 'text' },
  { key: 'hero_subtitle', label: 'Hero Subtitle', placeholder: 'Premium IPTV Live TV App...', type: 'text' },
  { key: 'stats_channels_count', label: 'Stats: Channel Count', placeholder: '500+', type: 'text' },
  { key: 'stats_categories_count', label: 'Stats: Category Count', placeholder: '20+', type: 'text' },
  { key: 'stats_users_count', label: 'Stats: User Count', placeholder: '10,000+', type: 'text' },
  { key: 'support_whatsapp', label: 'WhatsApp Number (with country code)', placeholder: '+919999999999', type: 'text' },
  { key: 'support_phone', label: 'Phone Number', placeholder: '+919999999999', type: 'text' },
  { key: 'support_email', label: 'Support Email', placeholder: 'support@example.com', type: 'email' },
  { key: 'telegram_url', label: 'Telegram Group URL', placeholder: 'https://t.me/...', type: 'url' },
  { key: 'upi_id', label: 'UPI ID (for manual payments)', placeholder: 'yourname@upi', type: 'text' },
  { key: 'payment_qr_url', label: 'Payment QR Code Image URL', placeholder: 'https://...', type: 'url' },
  { key: 'apk_download_url', label: 'APK Direct Download URL (fallback)', placeholder: 'https://...', type: 'url' },
];

export default function WebsiteSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getWebsiteSettings()
      .then((data: Record<string, string>) => setValues(data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateWebsiteSettings(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Website Settings</h1>
            <p className="text-slate-400 text-sm">Control the text and links shown on the public landing page.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading settings...</div>
      ) : (
        <div className="space-y-4">
          {FIELDS.map(f => (
            <div key={f.key} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={values[f.key] || ''}
                onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-600"
              />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

      {!loading && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
