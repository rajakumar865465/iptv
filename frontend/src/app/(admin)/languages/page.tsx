'use client';

import { useEffect, useState } from 'react';
import { getLanguages } from '@/lib/api';
import { motion } from 'framer-motion';
import { Globe, RefreshCw, TrendingUp } from 'lucide-react';

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLanguages = () => {
    setLoading(true);
    getLanguages().then((d) => setLanguages(d || [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchLanguages(); }, []);

  const maxCount = Math.max(...languages.map((l) => l.channel_count || 0), 1);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Languages</h1>
          <p className="text-slate-400 mt-1">{languages.length} languages across all channels</p>
        </div>
        <button onClick={fetchLanguages} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {languages.map((l, i) => {
            const pct = Math.round(((l.channel_count || 0) / maxCount) * 100);
            const colors = ['from-emerald-500 to-cyan-500','from-blue-500 to-indigo-500','from-purple-500 to-pink-500','from-amber-500 to-orange-500','from-rose-500 to-red-500'];
            const grad = colors[i % colors.length];
            return (
              <motion.div key={l.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-200">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-sm font-semibold">{l.channel_count}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-2">{l.channel_count} channel{l.channel_count !== 1 ? 's' : ''}</p>
              </motion.div>
            );
          })}
          {languages.length === 0 && (
            <div className="col-span-full rounded-2xl border border-slate-700/50 bg-slate-900/40 p-12 text-center">
              <Globe className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No language data yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
