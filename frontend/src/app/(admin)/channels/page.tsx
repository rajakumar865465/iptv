'use client';

import { useEffect, useState } from 'react';
import { getChannels, createChannel, updateChannel, deleteChannel } from '@/lib/api';

interface Channel {
  id: string;
  name: string;
  logo_url: string;
  stream_url: string;
  category_name: string;
  language: string;
  quality: string;
  status: string;
  health_status: string;
  is_premium: boolean;
  is_featured: boolean;
}

function HealthBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    online: 'bg-green-900 text-green-300',
    offline: 'bg-red-900 text-red-300',
    unstable: 'bg-yellow-900 text-yellow-300',
    unknown: 'bg-gray-700 text-gray-300',
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${cls[status] || 'bg-gray-700 text-gray-300'}`}>{status}</span>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs ${status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{status}</span>;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', stream_url: '', category_id: '', language: 'Hindi', quality: 'HD', status: 'active' });

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = () => {
    getChannels()
      .then((data) => setChannels(data || []))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createChannel(form);
      setShowModal(false);
      fetchChannels();
    } catch {
      alert('Failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this channel?')) return;
    try {
      await deleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Channels</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700">+ New Channel</button>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Create Channel</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input placeholder="Stream URL" value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input placeholder="Category ID" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              <input placeholder="Language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              <input placeholder="Quality" value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading...</div>
      ) : (
        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-gray-400">Category</th>
                <th className="px-4 py-3 text-left text-gray-400">Language</th>
                <th className="px-4 py-3 text-left text-gray-400">Health</th>
                <th className="px-4 py-3 text-left text-gray-400">Status</th>
                <th className="px-4 py-3 text-right text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-gray-400">{c.category_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{c.language}</td>
                  <td className="px-4 py-3"><HealthBadge status={c.health_status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(c.id)} className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {channels.length === 0 && <p className="p-6 text-gray-500 text-center">No channels</p>}
        </div>
      )}
    </div>
  );
}
