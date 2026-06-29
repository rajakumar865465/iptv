'use client';
import { useEffect, useState } from 'react';
import { Plus, Package, CheckCircle, Edit2, AlertTriangle } from 'lucide-react';
import { getAppReleases, createAppRelease, updateAppRelease } from '@/lib/api';

interface Release {
  id: string;
  version: string;
  version_code: number;
  apk_url: string;
  file_size: string;
  release_notes: string[];
  minimum_android_version: string;
  is_latest: boolean;
  force_update: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  version: '',
  version_code: '',
  apk_url: '',
  file_size: '',
  release_notes: '',
  minimum_android_version: '7.0',
  is_latest: true,
  force_update: false,
};

export default function AppReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    getAppReleases()
      .then((data: Release[]) => setReleases(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (r: Release) => {
    setEditing(r);
    setForm({
      version: r.version,
      version_code: String(r.version_code),
      apk_url: r.apk_url,
      file_size: r.file_size || '',
      release_notes: (r.release_notes || []).join('\n'),
      minimum_android_version: r.minimum_android_version || '7.0',
      is_latest: r.is_latest,
      force_update: r.force_update,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.version || !form.version_code || !form.apk_url) {
      return setError('Version, version code, and APK URL are required.');
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        version: form.version,
        version_code: parseInt(form.version_code),
        apk_url: form.apk_url,
        file_size: form.file_size || undefined,
        release_notes: form.release_notes.split('\n').map(s => s.trim()).filter(Boolean),
        minimum_android_version: form.minimum_android_version,
        is_latest: form.is_latest,
        force_update: form.force_update,
      };
      if (editing) {
        await updateAppRelease(editing.id, payload);
      } else {
        await createAppRelease(payload);
      }
      setShowModal(false);
      load();
    } catch {
      setError('Failed to save release.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">App Releases</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage APK versions for the public download page.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Release
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : releases.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-12 text-center">
          <Package className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No releases yet. Create the first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map(r => (
            <div key={r.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold">v{r.version}</span>
                    {r.is_latest && (
                      <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Latest
                      </span>
                    )}
                    {r.force_update && (
                      <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Force Update
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Code: {r.version_code} &bull; Android {r.minimum_android_version}+ {r.file_size ? `· ${r.file_size}` : ''}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5 break-all">{r.apk_url}</p>
                  {r.release_notes && r.release_notes.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.release_notes.slice(0, 3).map((n, i) => (
                        <li key={i} className="text-slate-500 text-xs">&bull; {n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button
                onClick={() => openEdit(r)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Release' : 'New Release'}</h2>

            <div className="space-y-4">
              {[
                { name: 'version', label: 'Version (e.g. 1.0.5)', type: 'text', placeholder: '1.0.5' },
                { name: 'version_code', label: 'Version Code (integer)', type: 'number', placeholder: '105' },
                { name: 'apk_url', label: 'APK Download URL', type: 'url', placeholder: 'https://...' },
                { name: 'file_size', label: 'File Size (e.g. 28 MB)', type: 'text', placeholder: '28 MB' },
                { name: 'minimum_android_version', label: 'Min Android Version', type: 'text', placeholder: '7.0' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.name as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Release Notes (one per line)</label>
                <textarea
                  rows={4}
                  placeholder="Improved player stability&#10;New channels added&#10;Bug fixes"
                  value={form.release_notes}
                  onChange={e => setForm(p => ({ ...p, release_notes: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {[
                { name: 'is_latest', label: 'Mark as Latest (shown on download page)' },
                { name: 'force_update', label: 'Force Update (show warning to old users)' },
              ].map(f => (
                <label key={f.name} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[f.name as 'is_latest' | 'force_update']}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-slate-300 text-sm">{f.label}</span>
                </label>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {saving ? 'Saving...' : 'Save Release'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
