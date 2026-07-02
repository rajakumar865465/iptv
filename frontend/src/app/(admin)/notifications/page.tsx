'use client';

import { useEffect, useState } from 'react';
import { getNotifications, createNotification, deleteNotification } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, Trash2, X, Users, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  target_type: string;
  is_active: boolean;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const emptyForm = {
  title: '',
  body: '',
  target_type: 'all',
  image_url: '',
  action_url: '',
  scheduled_at: '',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchNotifications = () =>
    getNotifications()
      .then((data) => setNotifications(data || []))
      .finally(() => setLoading(false));

  useEffect(() => { fetchNotifications(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert('Failed to delete');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        body: form.body,
        target_type: form.target_type,
      };
      if (form.image_url) payload.image_url = form.image_url;
      if (form.action_url) payload.action_url = form.action_url;
      if (form.scheduled_at) payload.scheduled_at = new Date(form.scheduled_at).toISOString();
      await createNotification(payload);
      setShowModal(false);
      setForm(emptyForm);
      fetchNotifications();
    } catch {
      alert('Failed to create notification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Notifications
          </h1>
          <p className="text-slate-400 mt-1">Create and manage in-app announcements.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:from-purple-400 hover:to-pink-500 shadow-lg shadow-purple-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Notification
        </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-400" />
                  New Notification
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., New channels added!"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Message</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Notification message body…"
                    rows={3}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target</label>
                    <select
                      value={form.target_type}
                      onChange={(e) => setForm({ ...form, target_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="all">All Users</option>
                      <option value="premium">Premium Only</option>
                      <option value="specific">Specific Users</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Schedule (optional)</label>
                    <input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Action URL (optional)</label>
                  <input
                    value={form.action_url}
                    onChange={(e) => setForm({ ...form, action_url: e.target.value })}
                    placeholder="deep link or URL"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:from-purple-400 hover:to-pink-500 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {saving ? 'Creating…' : 'Send / Schedule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-5 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${n.sent_at ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {n.sent_at ? <CheckCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{n.title}</p>
                    <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {n.target_type}
                      </span>
                      {n.sent_at && <span className="text-emerald-500">Sent {new Date(n.sent_at).toLocaleDateString()}</span>}
                      {!n.sent_at && n.scheduled_at && <span className="text-amber-400">Scheduled {new Date(n.scheduled_at).toLocaleString()}</span>}
                      {!n.sent_at && !n.scheduled_at && <span className="text-slate-600">Not scheduled</span>}
                      <span>Created {new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="shrink-0 p-2 rounded-xl bg-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-slate-700 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {notifications.length === 0 && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-12 text-center">
              <Bell className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No notifications yet. Create one to broadcast a message to your users.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
