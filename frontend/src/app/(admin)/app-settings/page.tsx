'use client';

import { useEffect, useState } from 'react';
import { getAppSettings, updateAppSettings } from '@/lib/api';
import { motion } from 'framer-motion';
import { Settings, Save, Plus, Trash2, CheckCircle, X } from 'lucide-react';

// Human-readable labels and descriptions for known setting keys
const KNOWN_SETTINGS: Record<string, { label: string; desc: string; type: 'bool' | 'number' | 'text' }> = {
  maintenance_mode:      { label: 'Maintenance Mode',       desc: 'Show maintenance screen to all users',        type: 'bool'   },
  allow_unknown_streams: { label: 'Allow Unknown Streams',  desc: 'Show channels with unchecked stream health',  type: 'bool'   },
  force_update:          { label: 'Force App Update',       desc: 'Block old app versions from using the API',   type: 'bool'   },
  minimum_app_version:   { label: 'Minimum App Version',    desc: 'e.g. 1.0.5 — older versions get blocked',     type: 'text'   },
  latest_app_version:    { label: 'Latest App Version',     desc: 'Latest release version string',               type: 'text'   },
  max_devices_per_user:  { label: 'Max Devices Per User',   desc: 'Default device limit (overridden by plan)',    type: 'number' },
  app_name:              { label: 'App Name',               desc: 'Displayed in notifications and splash screen', type: 'text'   },
  support_email:         { label: 'Support Email',          desc: 'Shown in the app help/contact section',        type: 'text'   },
  support_whatsapp:      { label: 'Support WhatsApp',       desc: 'WhatsApp number for user support',             type: 'text'   },
};

function isBoolString(v: string) { return v === 'true' || v === 'false'; }

export default function AppSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchSettings = () => {
    setLoading(true);
    getAppSettings()
      .then((d) => { setSettings(d || {}); setOriginal(d || {}); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAppSettings(settings as unknown as Record<string, unknown>);
      setOriginal({ ...settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    setSettings((prev) => ({ ...prev, [newKey.trim()]: newVal }));
    setNewKey(''); setNewVal(''); setShowAdd(false);
  };

  const handleDelete = (key: string) => {
    if (!confirm(`Remove setting "${key}"?`)) return;
    setSettings((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const setVal = (key: string, val: string) => setSettings((prev) => ({ ...prev, [key]: val }));

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original);

  const sortedKeys = Object.keys(settings).sort((a, b) => {
    const aKnown = a in KNOWN_SETTINGS; const bKnown = b in KNOWN_SETTINGS;
    if (aKnown && !bKnown) return -1; if (!aKnown && bKnown) return 1; return a.localeCompare(b);
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">App Settings</h1>
          <p className="text-slate-400 mt-1">Configure global app behaviour, versioning and support info.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-all">
            <Plus className="w-4 h-4" />Add Key
          </button>
          <button onClick={handleSave} disabled={saving || !isDirty} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all">
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Key</label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g., my_custom_key" className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
          </div>
          <div className="flex-1 min-w-48"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Value</label>
            <input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="value" className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
          </div>
          <button onClick={handleAddKey} className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-400">Add</button>
          <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center h-48 items-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {sortedKeys.map((key) => {
            const meta = KNOWN_SETTINGS[key];
            const val = settings[key] ?? '';
            const isBool = meta?.type === 'bool' || (!meta && isBoolString(val));
            const isNum = meta?.type === 'number';
            return (
              <motion.div key={key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <p className="font-semibold text-slate-200 text-sm">{meta?.label || key}</p>
                    {!meta && <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{key}</span>}
                  </div>
                  {meta?.desc && <p className="text-xs text-slate-500 mt-0.5 ml-5">{meta.desc}</p>}
                </div>
                <div className="shrink-0 w-64">
                  {isBool ? (
                    <div className="flex items-center gap-3">
                      <div onClick={() => setVal(key, val === 'true' ? 'false' : 'true')} className={`w-11 h-6 rounded-full cursor-pointer transition-colors relative ${val === 'true' ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${val === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                      <span className={`text-sm font-semibold ${val === 'true' ? 'text-emerald-400' : 'text-slate-500'}`}>{val === 'true' ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  ) : (
                    <input
                      type={isNum ? 'number' : 'text'}
                      value={val}
                      onChange={(e) => setVal(key, e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  )}
                </div>
                {!meta && (
                  <button onClick={() => handleDelete(key)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/30 transition-all shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
          {sortedKeys.length === 0 && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-12 text-center">
              <Settings className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No settings yet. Click "Add Key" to create one.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
