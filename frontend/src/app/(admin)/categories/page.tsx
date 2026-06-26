'use client';

import { useEffect, useState } from 'react';
import { getCategories } from '@/lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categories</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400">Name</th>
              <th className="px-4 py-3 text-left text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-gray-400">Sort Order</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-gray-400">{c.status}</td>
                <td className="px-4 py-3 text-gray-400">{c.sort_order}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <p className="p-6 text-gray-500 text-center">No categories</p>}
      </div>
    </div>
  );
}
