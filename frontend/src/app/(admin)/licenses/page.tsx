'use client';

import { useEffect, useState } from 'react';
import { getLicenses, createLicense, extendLicense, suspendLicense, revokeLicense } from '@/lib/api';

interface License {
  id: string;
  license_key: string;
  plan_name: string;
  user_email: string;
  status: string;
  duration_days: number;
  max_devices: number;
  activated_at: string;
  expires_at: string;
  created_at: string;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ plan_id: '', duration_days: 30, max_devices: 1 });

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = () => {
    getLicenses()
      .then((data) => setLicenses(data || []))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLicense(formData);
      setShowModal(false);
      fetchLicenses();
    } catch {
      alert('Failed to create license');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Licenses</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700">
          + New License
        </button>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create License</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Plan ID" value={formData.plan_id} onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input type="number" placeholder="Duration (days)" value={formData.duration_days} onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              <input type="number" placeholder="Max Devices" value={formData.max_devices} onChange={(e) => setFormData({ ...formData, max_devices: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading licenses...</div>
      ) : (
        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-gray-400">Key</th>
                <th className="px-4 py-3 text-left text-gray-400">Plan</th>
                <th className="px-4 py-3 text-left text-gray-400">User</th>
                <th className="px-4 py-3 text-left text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-gray-400">Expires</th>
                <th className="px-4 py-3 text-right text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-mono text-xs">{l.license_key}</td>
                  <td className="px-4 py-3 text-gray-400">{l.plan_name}</td>
                  <td className="px-4 py-3 text-gray-400">{l.user_email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 ${l.status === 'active' ? 'bg-green-900 text-green-300' : l.status === 'unused' ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'} rounded text-xs`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => extendLicense(l.id, 30).then(fetchLicenses)} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">+30d</button>
                    <button onClick={() => suspendLicense(l.id).then(fetchLicenses)} className="text-xs px-2 py-1 rounded bg-orange-700 hover:bg-orange-600">Suspend</button>
                    <button onClick={() => revokeLicense(l.id).then(fetchLicenses)} className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600">Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {licenses.length === 0 && <p className="p-6 text-gray-500 text-center">No licenses</p>}
        </div>
      )}
    </div>
  );
}
