'use client';

import { useEffect, useState } from 'react';
import { getChannels, getCategories, createChannel, updateChannel, deleteChannel, getChannelStreams, createChannelStream, updateChannelStream, deleteChannelStream, diagnoseChannelStream } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, Tv, Globe2, Languages, Signal, X, Pencil, List, ChevronLeft, ChevronRight, Link2, Check, XCircle, Play, Edit3, RefreshCw } from 'lucide-react';
import ChannelLogoImage from '@/components/ChannelLogoImage';

interface Channel {
  id: string; name: string; logo_url: string; stream_url: string;
  category_id: string; category_name: string; language: string; quality: string;
  status: string; health_status: string; is_premium: boolean; is_featured: boolean;
  sort_order: number; backup_stream_url: string;
}
interface Stream { 
  id: string; 
  stream_url: string; 
  quality: string; 
  priority: number; 
  health_status: string; 
  source_name: string; 
  is_active?: boolean;
  user_agent?: string;
  referer?: string;
  origin?: string;
  headers_json?: any;
  playback_mode?: string;
  codec_video?: string;
  codec_audio?: string;
  container_type?: string;
  segment_type?: string;
  health_reason?: string;
  android_playable?: boolean;
  vlc_playable?: boolean;
}

const emptyForm = { name: '', stream_url: '', backup_stream_url: '', logo_url: '', category_id: '', language: 'Hindi', quality: 'HD', status: 'active', is_premium: false, is_featured: false, sort_order: 0 };

function HealthBadge({ status }: { status: string }) {
  const c: Record<string, string> = { online: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', offline: 'bg-rose-500/10 border-rose-500/20 text-rose-400', unstable: 'bg-amber-500/10 border-amber-500/20 text-amber-400' };
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${c[status] || 'bg-slate-800 border-slate-700 text-slate-400'}`}>{status || 'unknown'}</span>;
}

function StreamHealthIndicator({ status }: { status: string }) {
  if (status === 'online') return <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live</span>;
  if (status === 'offline') return <span className="flex items-center gap-1 text-rose-400"><XCircle className="w-3 h-3" />Down</span>;
  if (status === 'unstable') return <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400" />Unstable</span>;
  return <span className="text-slate-500">—</span>;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [page, setPage] = useState(1); const PAGE = 50;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [catFilter, setCatFilter] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'streams' | null>(null);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamChannelId, setStreamChannelId] = useState<string | null>(null);
  
  const emptyStreamForm = {
    stream_url: '',
    quality: 'HD',
    priority: 1,
    source_name: '',
    is_active: true,
    user_agent: '',
    referer: '',
    origin: '',
    headers_json: '',
    playback_mode: 'direct'
  };

  const [streamForm, setStreamForm] = useState(emptyStreamForm);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedStreams, setSelectedStreams] = useState<Set<string>>(new Set());

  const fetchChannels = (p = page, s = search, cat = catFilter) => {
    setLoading(true);
    const params: Record<string, unknown> = { page: p, limit: PAGE };
    if (s) params.search = s;
    if (cat) params.category_id = cat;
    getChannels(params)
      .then((res: any) => {
        if (res?.data) { 
          setChannels(res.data); 
          setTotal(res.pagination?.total || 0); 
          setActiveTotal(res.pagination?.active || 0);
        }
        else { setChannels(Array.isArray(res) ? res : []); }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { getCategories().then((d) => setCategories(d || [])); }, []);
  useEffect(() => { fetchChannels(1, search, catFilter); setPage(1); }, [search, catFilter]);

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit = (c: Channel) => {
    setEditChannel(c);
    setForm({ name: c.name, stream_url: c.stream_url || '', backup_stream_url: c.backup_stream_url || '', logo_url: c.logo_url || '', category_id: c.category_id || '', language: c.language || 'Hindi', quality: c.quality || 'HD', status: c.status, is_premium: c.is_premium, is_featured: c.is_featured, sort_order: c.sort_order || 0 });
    setModal('edit');
  };
  const openStreams = async (c: Channel) => {
    setStreamChannelId(c.id); 
    setStreamForm(emptyStreamForm);
    setEditingStreamId(null);
    setSelectedStreams(new Set());
    try { const d = await getChannelStreams(c.id); setStreams(d || []); } catch { setStreams([]); }
    setModal('streams');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await createChannel(form as unknown as Record<string, unknown>); setModal(null); fetchChannels(); }
    catch (err: any) { alert(err?.response?.data?.message || 'Failed to create channel'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editChannel) return; setSaving(true);
    try { await updateChannel(editChannel.id, form as unknown as Record<string, unknown>); setModal(null); fetchChannels(); }
    catch (err: any) { alert(err?.response?.data?.message || 'Failed to update channel'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this channel? This cannot be undone.')) return;
    try { await deleteChannel(id); fetchChannels(); }
    catch { alert('Failed to delete channel'); }
  };

  const handleAddStream = async (e: React.FormEvent) => {
    e.preventDefault(); if (!streamChannelId) return; setSaving(true);
    try { 
      const d = await createChannelStream({ ...streamForm, channel_id: streamChannelId }); 
      setStreams((p) => [...p, d]); 
      setStreamForm(emptyStreamForm); 
    }
    catch { alert('Failed to add stream'); }
    finally { setSaving(false); }
  };

  const handleUpdateStream = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingStreamId) return; setSaving(true);
    try {
      const d = await updateChannelStream(editingStreamId, streamForm);
      setStreams((p) => p.map((s) => (s.id === editingStreamId ? { ...s, ...d } : s)));
      setEditingStreamId(null);
      setStreamForm(emptyStreamForm);
    } catch { alert('Failed to update stream'); }
    finally { setSaving(false); }
  };

  const handleDiagnoseStream = async (sid: string) => {
    setDiagnosingId(sid);
    try {
      const result = await diagnoseChannelStream(sid);
      if (streamChannelId) {
        const d = await getChannelStreams(streamChannelId);
        setStreams(d || []);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to run diagnosis');
    } finally {
      setDiagnosingId(null);
    }
  };

  const handleDeleteStream = async (sid: string) => {
    if (!confirm('Delete this stream?')) return;
    try { await deleteChannelStream(sid); setStreams((p) => p.filter((s) => s.id !== sid)); setSelectedStreams((s) => { const n = new Set(s); n.delete(sid); return n; }); }
    catch { alert('Failed to delete stream'); }
  };

  const startEditStream = (s: Stream) => {
    setEditingStreamId(s.id);
    setStreamForm({ 
      stream_url: s.stream_url, 
      quality: s.quality || 'HD', 
      priority: s.priority || 1, 
      source_name: s.source_name || '',
      is_active: s.is_active !== false,
      user_agent: s.user_agent || '',
      referer: s.referer || '',
      origin: s.origin || '',
      headers_json: s.headers_json ? (typeof s.headers_json === 'string' ? s.headers_json : JSON.stringify(s.headers_json, null, 2)) : '',
      playback_mode: s.playback_mode || 'direct'
    });
  };

  const cancelEditStream = () => {
    setEditingStreamId(null);
    setStreamForm(emptyStreamForm);
  };

  const toggleStreamSelection = (id: string) => {
    setSelectedStreams((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllStreams = () => {
    if (selectedStreams.size === streams.length) {
      setSelectedStreams(new Set());
    } else {
      setSelectedStreams(new Set(streams.map(s => s.id)));
    }
  };

  const bulkDeleteStreams = async () => {
    if (selectedStreams.size === 0) return;
    if (!confirm(`Delete ${selectedStreams.size} selected streams?`)) return;
    setSaving(true);
    try {
      await Promise.all(Array.from(selectedStreams).map(id => deleteChannelStream(id)));
      setStreams((p) => p.filter((s) => !selectedStreams.has(s.id)));
      setSelectedStreams(new Set());
    } catch { alert('Failed to delete some streams'); }
    finally { setSaving(false); }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const goPage = (p: number) => { setPage(p); fetchChannels(p, search, catFilter); };
  const ic = 'w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';

  const ChannelModal = ({ mode }: { mode: 'create' | 'edit' }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Tv className="w-5 h-5 text-cyan-400" />{mode === 'create' ? 'Add New Channel' : 'Edit Channel'}</h3>
          <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={mode === 'create' ? handleCreate : handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Channel Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Star Sports 1" className={ic} required /></div>
            <div className="col-span-2 space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stream URL *</label><input value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} placeholder="http://..." className={ic} required /></div>
            <div className="col-span-2 space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Backup Stream URL</label><input value={form.backup_stream_url} onChange={(e) => setForm({ ...form, backup_stream_url: e.target.value })} placeholder="http://..." className={ic} /></div>
            <div className="col-span-2 space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logo URL</label><input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." className={ic} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={ic}>
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Language</label><input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="Hindi" className={ic} /></div>
            <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quality</label>
              <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} className={ic}>
                {['SD','HD','FHD','4K'].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={ic}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sort Order</label><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className={ic} /></div>
          </div>
          <div className="flex gap-6">
            {([['is_premium','Premium Channel'],['is_featured','Featured']] as const).map(([k,l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm({ ...form, [k]: !(form as any)[k] })} className={`w-9 h-5 rounded-full transition-colors relative ${(form as any)[k] ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(form as any)[k] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-slate-300">{l}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold disabled:opacity-50">{saving ? 'Saving…' : mode === 'create' ? 'Create Channel' : 'Save Changes'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );

  const StreamsModal = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-4xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Link2 className="w-5 h-5 text-purple-400" />Stream Sources</h3>
          <div className="flex items-center gap-2">
            {selectedStreams.size > 0 && (
              <button onClick={bulkDeleteStreams} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedStreams.size})
              </button>
            )}
            <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Stream List */}
        <div className="space-y-3 mb-5 max-h-[45vh] overflow-y-auto pr-1">
          {streams.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 border-b border-slate-700/50">
              <input 
                type="checkbox" 
                checked={selectedStreams.size === streams.length} 
                onChange={selectAllStreams}
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500/50"
              />
              <span>Select all</span>
            </div>
          )}
          {streams.map((s) => (
            <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${editingStreamId === s.id ? 'bg-purple-500/10 border-purple-500/30' : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'}`}>
              <input 
                type="checkbox" 
                checked={selectedStreams.has(s.id)} 
                onChange={() => toggleStreamSelection(s.id)}
                className="w-4 h-4 mt-1 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500/50"
              />
              <div className="min-w-0 flex-1">
                {editingStreamId === s.id ? (
                  <form onSubmit={handleUpdateStream} className="space-y-3">
                    <input value={streamForm.stream_url} onChange={(e) => setStreamForm({ ...streamForm, stream_url: e.target.value })} placeholder="Stream URL" className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-slate-200" required />
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <select value={streamForm.quality} onChange={(e) => setStreamForm({ ...streamForm, quality: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200">
                        {['SD','HD','FHD','4K'].map(q => <option key={q}>{q}</option>)}
                      </select>
                      <input type="number" min="1" value={streamForm.priority} onChange={(e) => setStreamForm({ ...streamForm, priority: parseInt(e.target.value)||1 })} placeholder="Priority" className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200" />
                      <input value={streamForm.source_name} onChange={(e) => setStreamForm({ ...streamForm, source_name: e.target.value })} placeholder="Source" className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200" />
                      <select value={streamForm.playback_mode} onChange={(e) => setStreamForm({ ...streamForm, playback_mode: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200">
                        <option value="direct">Direct Play</option>
                        <option value="proxy">HLS Proxy</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 px-2 py-1 bg-slate-950 border border-slate-750 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={streamForm.is_active} onChange={(e) => setStreamForm({ ...streamForm, is_active: e.target.checked })} className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-750" />
                        Active
                      </label>
                    </div>

                    <div className="space-y-2 border-t border-slate-800 pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custom Headers (Optional)</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input value={streamForm.user_agent} onChange={(e) => setStreamForm({ ...streamForm, user_agent: e.target.value })} placeholder="User-Agent" className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200" />
                        <input value={streamForm.referer} onChange={(e) => setStreamForm({ ...streamForm, referer: e.target.value })} placeholder="Referer" className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200" />
                        <input value={streamForm.origin} onChange={(e) => setStreamForm({ ...streamForm, origin: e.target.value })} placeholder="Origin" className="px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200" />
                      </div>
                      <textarea value={streamForm.headers_json} onChange={(e) => setStreamForm({ ...streamForm, headers_json: e.target.value })} placeholder='Headers JSON (e.g. {"Cookie": "key=val"})' rows={1} className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-750 text-slate-200 font-mono" />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                        <Check className="w-3.5 h-3.5" /> Save
                      </button>
                      <button type="button" onClick={cancelEditStream} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-700/80 px-2 py-0.5 rounded text-[10px] font-bold text-slate-300">{s.quality}</span>
                      <p className="text-xs font-mono text-slate-300 truncate flex-1">{s.stream_url}</p>
                    </div>

                    <div className="flex flex-wrap gap-x-2 gap-y-1.5 mt-2 items-center text-[11px] text-slate-400">
                      <span className="text-slate-500">Priority {s.priority}</span>
                      {s.source_name && <span>• {s.source_name}</span>}
                      <span>• Playback: <strong className="text-slate-300 font-semibold">{s.playback_mode || 'direct'}</strong></span>
                      
                      {(s.codec_video || s.codec_audio) && (
                        <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] text-cyan-400 font-mono">
                          {s.codec_video || 'N/A'}/{s.codec_audio || 'N/A'}
                        </span>
                      )}
                      
                      {s.container_type && (
                        <span className="text-[10px] text-slate-500">({s.container_type}/{s.segment_type})</span>
                      )}

                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${s.android_playable !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        Android: {s.android_playable !== false ? 'OK' : 'ERR'}
                      </span>

                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${s.vlc_playable !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        VLC: {s.vlc_playable !== false ? 'OK' : 'ERR'}
                      </span>

                      <StreamHealthIndicator status={s.health_status} />
                      {s.health_reason && <span className="text-rose-400/80 italic font-mono text-[10px]">({s.health_reason})</span>}
                      {s.is_active === false && <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">Inactive</span>}
                    </div>
                  </>
                )}
              </div>
              {editingStreamId !== s.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => handleDiagnoseStream(s.id)} 
                    disabled={diagnosingId !== null} 
                    title="Run deep validation check"
                    className="p-1.5 text-purple-400 hover:bg-purple-500/10 rounded-lg border border-transparent hover:border-purple-500/30 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${diagnosingId === s.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => startEditStream(s)} className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 rounded-lg border border-transparent hover:border-cyan-500/30 transition-all">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteStream(s.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/30 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {streams.length === 0 && (
            <div className="text-center py-8">
              <Play className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No streams added yet</p>
              <p className="text-xs text-slate-600 mt-1">Add multiple stream sources for automatic failover</p>
            </div>
          )}
        </div>

        {/* Add Stream Form */}
        <form onSubmit={handleAddStream} className="border-t border-slate-700 pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add New Stream</p>
          <input value={streamForm.stream_url} onChange={(e) => setStreamForm({ ...streamForm, stream_url: e.target.value })} placeholder="Stream URL *" className={ic} required />
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select value={streamForm.quality} onChange={(e) => setStreamForm({ ...streamForm, quality: e.target.value })} className="px-3 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-sm">
              {['SD','HD','FHD','4K'].map(q => <option key={q}>{q}</option>)}
            </select>
            <input type="number" min="1" value={streamForm.priority} onChange={(e) => setStreamForm({ ...streamForm, priority: parseInt(e.target.value)||1 })} placeholder="Priority" className="px-3 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-sm" />
            <input value={streamForm.source_name} onChange={(e) => setStreamForm({ ...streamForm, source_name: e.target.value })} placeholder="Source name" className="px-3 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-sm" />
            <select value={streamForm.playback_mode} onChange={(e) => setStreamForm({ ...streamForm, playback_mode: e.target.value })} className="px-3 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-sm">
              <option value="direct">Direct Play</option>
              <option value="proxy">HLS Proxy</option>
            </select>
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 cursor-pointer">
              <input type="checkbox" checked={streamForm.is_active} onChange={(e) => setStreamForm({ ...streamForm, is_active: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500/50" />
              <span className="text-sm text-slate-300">Active</span>
            </label>
          </div>

          <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Custom Headers (Optional)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input value={streamForm.user_agent} onChange={(e) => setStreamForm({ ...streamForm, user_agent: e.target.value })} placeholder="User-Agent" className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-xs" />
              <input value={streamForm.referer} onChange={(e) => setStreamForm({ ...streamForm, referer: e.target.value })} placeholder="Referer" className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-xs" />
              <input value={streamForm.origin} onChange={(e) => setStreamForm({ ...streamForm, origin: e.target.value })} placeholder="Origin" className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-xs" />
            </div>
            <textarea value={streamForm.headers_json} onChange={(e) => setStreamForm({ ...streamForm, headers_json: e.target.value })} placeholder='Headers JSON (e.g. {"Cookie": "abc=123"})' rows={1} className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 text-xs font-mono" />
          </div>

          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold disabled:opacity-50 transition-all">
            {saving ? 'Adding…' : 'Add Stream'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Channels</h1>
          <p className="text-slate-400 mt-1">
            <span className="font-semibold text-emerald-400">{activeTotal} live in app</span> out of {total} total — manage streams, health & metadata.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm" />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition-all whitespace-nowrap">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {modal === 'create' && <ChannelModal mode="create" />}
        {modal === 'edit' && <ChannelModal mode="edit" />}
        {modal === 'streams' && <StreamsModal />}
      </AnimatePresence>

      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Channel</th>
                    <th className="px-6 py-4 font-semibold">Category / Lang</th>
                    <th className="px-6 py-4 font-semibold">Health</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {channels.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                            <ChannelLogoImage
                              src={c.logo_url || ''}
                              alt={c.name}
                              className="w-full h-full object-contain p-1"
                              fallbackClassName="text-xs"
                              containerClassName="w-full h-full"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors line-clamp-1">{c.name}</p>
                            <div className="flex gap-1.5 mt-1">
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{c.quality||'HD'}</span>
                              {c.is_premium && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Premium</span>}
                              {c.is_featured && <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">Featured</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap">
                        <div className="flex flex-col gap-1"><div className="flex items-center gap-1.5"><Globe2 className="w-3 h-3 text-slate-500" />{c.category_name||'—'}</div><div className="flex items-center gap-1.5"><Languages className="w-3 h-3 text-slate-500" />{c.language||'—'}</div></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"><HealthBadge status={c.health_status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openStreams(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-purple-400 hover:bg-purple-500/10 border border-slate-700 transition-all"><List className="w-3.5 h-3.5" /><span className="hidden sm:inline">Streams</span></button>
                          <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-cyan-400 hover:bg-cyan-500/10 border border-slate-700 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(c.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-500/10 border border-slate-700 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {channels.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500"><Signal className="w-8 h-8 mx-auto mb-2 text-slate-600" />No channels found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {pages} ({total} total)</span>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={() => goPage(page-1)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page>=pages} onClick={() => goPage(page+1)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
