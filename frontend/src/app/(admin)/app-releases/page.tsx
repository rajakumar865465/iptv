'use client';
import { useEffect, useState } from 'react';
import { Plus, Package, CheckCircle, Edit2, Trash2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { getAppReleases, createAppRelease, updateAppRelease, deleteAppRelease, getErrorMessage } from '@/lib/api';

interface Release {
  id: string | number;
  version: string;
  version_code: number;
  apk_url: string;
  file_size?: string;
  release_notes?: string[] | string;
  minimum_android_version?: string;
  is_latest: boolean;
  force_update: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  version: '1.2.1',
  version_code: '12',
  apk_url: '/downloads/app-release.apk',
  file_size: '96.5 MB',
  release_notes: 'Latest stable IPTV release\nUltra-low latency streaming\n500+ Live Indian channels',
  minimum_android_version: '7.0',
  is_latest: true,
  force_update: false,
};

export default function AppReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    getAppReleases()
      .then((data: Release[]) => {
        setReleases(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setLoadError(getErrorMessage(err, 'Failed to fetch releases from server'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (r: Release) => {
    setEditing(r);
    const notesStr = Array.isArray(r.release_notes)
      ? r.release_notes.join('\n')
      : typeof r.release_notes === 'string'
      ? r.release_notes
      : '';

    setForm({
      version: r.version || '',
      version_code: String(r.version_code || ''),
      apk_url: r.apk_url || '',
      file_size: r.file_size || '',
      release_notes: notesStr,
      minimum_android_version: r.minimum_android_version || '7.0',
      is_latest: !!r.is_latest,
      force_update: !!r.force_update,
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this release version?')) return;
    setDeletingId(id);
    try {
      await deleteAppRelease(String(id));
      load();
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete release'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (!form.version || !form.version_code || !form.apk_url) {
      return setError('Version, version code, and APK URL are required.');
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        version: form.version.trim(),
        version_code: parseInt(form.version_code),
        apk_url: form.apk_url.trim(),
        file_size: form.file_size?.trim() || undefined,
        release_notes: form.release_notes
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        minimum_android_version: form.minimum_android_version?.trim() || '7.0',
        is_latest: form.is_latest,
        force_update: form.force_update,
      };

      if (editing) {
        await updateAppRelease(String(editing.id), payload);
      } else {
        await createAppRelease(payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save release.'));
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
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh releases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30"
          >
            <Plus className="w-4 h-4" /> New Release
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 p-4 rounded-xl bg-red-900/30 border border-red-700/50 flex items-center justify-between text-red-300 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{loadError}</span>
          </div>
          <button onClick={load} className="underline hover:text-white font-medium">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-sm gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading app releases...</span>
        </div>
      ) : releases.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-1">No releases published yet</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Add your APK details so users can download it directly from the public download page.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Publish First Release
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map((r) => {
            const notes = Array.isArray(r.release_notes)
              ? r.release_notes
              : typeof r.release_notes === 'string'
              ? [r.release_notes]
              : [];

            return (
              <div
                key={r.id}
                className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-5 flex items-start justify-between gap-4 transition-all hover:border-slate-600"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-base">v{r.version}</span>
                      {r.is_latest && (
                        <span className="flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" /> Latest
                        </span>
                      )}
                      {r.force_update && (
                        <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-medium">
                          <AlertTriangle className="w-3 h-3" /> Force Update
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      Code: <span className="text-slate-300 font-mono">{r.version_code}</span> &bull; Android {r.minimum_android_version || '7.0'}+ {r.file_size ? `· ${r.file_size}` : ''}
                    </p>
                    <p className="text-slate-500 text-xs mt-1 font-mono break-all bg-slate-950/40 px-2 py-1 rounded border border-slate-800/80 inline-block">
                      {r.apk_url}
                    </p>
                    {notes.length > 0 && (
                      <ul className="mt-2.5 space-y-1">
                        {notes.slice(0, 4).map((n, i) => (
                          <li key={i} className="text-slate-400 text-xs flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-medium transition-colors border border-red-800/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">{editing ? 'Edit Release' : 'New App Release'}</h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setForm(EMPTY_FORM)}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Fill Defaults
                </button>
              )}
            </div>

            <div className="space-y-4">
              {[
                { name: 'version', label: 'Version Name (e.g. 2.7 or 1.2.1)', type: 'text', placeholder: '2.7' },
                { name: 'version_code', label: 'Version Code (integer, e.g. 27)', type: 'number', placeholder: '27' },
                { name: 'apk_url', label: 'APK URL (Direct link, Google Drive link, or /downloads/app-release.apk)', type: 'text', placeholder: 'https://drive.google.com/file/d/...' },
                { name: 'file_size', label: 'File Size (e.g. 96.5 MB)', type: 'text', placeholder: '96.5 MB' },
                { name: 'minimum_android_version', label: 'Min Android Version', type: 'text', placeholder: '7.0' },
              ].map((f) => (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-300">{f.label}</label>
                    {f.name === 'apk_url' && form.apk_url.includes('drive.usercontent.google.com') && (
                      <span className="text-[11px] text-emerald-400 font-medium">✓ Direct Google Drive Link</span>
                    )}
                  </div>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.name as keyof typeof form] as string}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (f.name === 'apk_url') {
                        const driveFileMatch = val.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
                        if (driveFileMatch && driveFileMatch[1]) {
                          val = `https://drive.usercontent.google.com/download?id=${driveFileMatch[1]}&export=download&authuser=0`;
                        }
                        const driveIdMatch = val.match(/drive\.google\.com\/(?:open|uc)\?.*id=([a-zA-Z0-9_-]+)/i);
                        if (driveIdMatch && driveIdMatch[1]) {
                          val = `https://drive.usercontent.google.com/download?id=${driveIdMatch[1]}&export=download&authuser=0`;
                        }
                      }
                      setForm((p) => ({ ...p, [f.name]: val }));
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                  {f.name === 'apk_url' && (
                    <p className="text-slate-500 text-[11px] mt-1">
                      Paste your Google Drive sharing link here — it will automatically convert to an instant direct download!
                    </p>
                  )}
                </div>
              ))}


              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Release Notes (one per line)</label>
                <textarea
                  rows={4}
                  placeholder="Improved player stability&#10;500+ Indian channels&#10;Ultra-low latency streaming"
                  value={form.release_notes}
                  onChange={(e) => setForm((p) => ({ ...p, release_notes: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {[
                { name: 'is_latest', label: 'Mark as Latest (serves on public download page)' },
                { name: 'force_update', label: 'Force Update (shows update modal in mobile app)' },
              ].map((f) => (
                <label key={f.name} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[f.name as 'is_latest' | 'force_update']}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-slate-300 text-sm">{f.label}</span>
                </label>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm mt-4 bg-red-950/40 p-3 rounded-lg border border-red-800/50">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
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


