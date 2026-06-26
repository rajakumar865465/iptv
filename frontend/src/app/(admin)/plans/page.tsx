'use client';

import { useState } from 'react';

export default function PlansPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700">
          + New Plan
        </button>
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <p className="text-gray-400">Plans management coming soon.</p>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Plan</h3>
            <p className="text-gray-400 text-sm">Feature in development</p>
            <button onClick={() => setShowModal(false)} className="mt-4 w-full py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
