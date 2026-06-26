'use client';

import { useEffect, useState } from 'react';
import { getNotifications, createNotification, deleteNotification } from '@/lib/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then((data) => setNotifications(data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      alert('Failed');
    }
  };

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{n.title}</h3>
              <p className="text-sm text-gray-400">{n.body}</p>
              <p className="text-xs text-gray-500 mt-1">{n.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <button onClick={() => handleDelete(n.id)} className="text-xs px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white">Delete</button>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-gray-500">No notifications</p>}
      </div>
    </div>
  );
}
