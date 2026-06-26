'use client';

import { useEffect, useState } from 'react';
import { getLanguages } from '@/lib/api';

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLanguages()
      .then((data) => setLanguages(data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Languages</h1>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {languages.map((l) => (
            <div key={l.name} className="bg-gray-700 rounded p-3">
              <p className="font-medium">{l.name}</p>
              <p className="text-sm text-gray-400">{l.channel_count} channels</p>
            </div>
          ))}
        </div>
        {languages.length === 0 && <p className="text-gray-500 text-center">No languages</p>}
      </div>
    </div>
  );
}
