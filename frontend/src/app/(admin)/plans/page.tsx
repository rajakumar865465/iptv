'use client';

import { useEffect, useState } from 'react';
import { getPlans, createPlan, deletePlan, updatePlan } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  max_devices: number;
  description: string;
  is_visible: boolean;
  status: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: 0, duration_days: 30, max_devices: 1, description: '', is_visible: true, status: 'active' });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = () => {
    getPlans()
      .then((data) => setPlans(data?.data || []))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPlan(formData);
      setShowModal(false);
      fetchPlans();
      setFormData({ name: '', price: 0, duration_days: 30, max_devices: 1, description: '', is_visible: true, status: 'active' });
    } catch {
      alert('Failed to create plan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await deletePlan(id);
      fetchPlans();
    } catch {
      alert('Failed to delete plan');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700">
          + New Plan
        </button>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Plan</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Plan Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input type="number" placeholder="Price" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input type="number" placeholder="Duration (days)" value={formData.duration_days} onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <input type="number" placeholder="Max Devices" value={formData.max_devices} onChange={(e) => setFormData({ ...formData, max_devices: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" required />
              <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-gray-100" />
              
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input type="checkbox" checked={formData.is_visible} onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })} className="rounded bg-gray-700 border-gray-600" />
                <span>Visible to users</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 animate-pulse">Loading plans...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="bg-gray-800 rounded-lg border border-gray-700 p-5 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded ${p.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{p.status}</span>
              </div>
              <p className="text-2xl font-bold text-red-500 mb-4">₹{p.price}</p>
              <div className="space-y-2 text-sm text-gray-400 mb-6 flex-1">
                <p>• {p.duration_days} Days Access</p>
                <p>• {p.max_devices} Device{p.max_devices > 1 ? 's' : ''}</p>
                {p.description && <p>• {p.description}</p>}
                <p>• {p.is_visible ? 'Visible in app' : 'Hidden from app'}</p>
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-700">
                <button onClick={() => handleDelete(p.id)} className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-red-700 text-gray-200 hover:text-white transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-full p-6 text-center text-gray-500 bg-gray-800 rounded-lg border border-gray-700">
              No plans created yet. Create one to get started!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
