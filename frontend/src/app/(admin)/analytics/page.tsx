'use client';

import { useEffect, useState } from 'react';
import { getUserAnalytics, getRevenueAnalytics, getPlaybackAnalytics } from '@/lib/api';

export default function AnalyticsPage() {
  const [userData, setUserData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [playbackData, setPlaybackData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUserAnalytics(), getRevenueAnalytics(), getPlaybackAnalytics()])
      .then(([u, r, p]) => {
        setUserData(u);
        setRevenueData(r);
        setPlaybackData(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h3 className="font-semibold mb-4">User Signups</h3>
          <p className="text-sm text-gray-400">Data loaded: {userData?.signups?.length || 0} days</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h3 className="font-semibold mb-4">Revenue</h3>
          <p className="text-sm text-gray-400">Data loaded: {revenueData?.length || 0} days</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h3 className="font-semibold mb-4">Top Channels</h3>
          <p className="text-sm text-gray-400">Channels: {playbackData?.length || 0}</p>
        </div>
      </div>
    </div>
  );
}
