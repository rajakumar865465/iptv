'use client';

import { useEffect, useState } from 'react';
import { getPayments, updatePaymentStatus } from '@/lib/api';

interface Payment {
  id: string;
  full_name: string;
  email: string;
  plan_name: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    completed: 'bg-green-900 text-green-300',
    pending: 'bg-yellow-900 text-yellow-300',
    failed: 'bg-red-900 text-red-300',
    refunded: 'bg-gray-700 text-gray-300',
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${cls[status as keyof typeof cls] || 'bg-gray-700 text-gray-300'}`}>{status}</span>;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPayments()
      .then((data) => setPayments(data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (id: string, status: string) => {
    try {
      await updatePaymentStatus(id, status);
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch {
      alert('Failed');
    }
  };

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400">User</th>
              <th className="px-4 py-3 text-left text-gray-400">Plan</th>
              <th className="px-4 py-3 text-left text-gray-400">Amount</th>
              <th className="px-4 py-3 text-left text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-gray-400">Date</th>
              <th className="px-4 py-3 text-right text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3">{p.full_name || p.email}</td>
                <td className="px-4 py-3 text-gray-400">{p.plan_name}</td>
                <td className="px-4 py-3 text-gray-400">{p.amount}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-1">
                  {p.status === 'pending' && (
                    <button onClick={() => handleUpdate(p.id, 'completed')} className="text-xs px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white">Approve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <p className="p-6 text-gray-500 text-center">No payments</p>}
      </div>
    </div>
  );
}
