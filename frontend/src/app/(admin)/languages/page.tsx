'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLanguages } from '@/lib/api';
import { motion } from 'framer-motion';
import { Globe, RefreshCw, TrendingUp, Search, SortAsc, SortDesc, ArrowRight } from 'lucide-react';

interface Language { name: string; channel_count: number; }

const CARD_GRADIENTS = [
  { bar: 'from-emerald-500 to-cyan-500',   glow: 'bg-emerald-500/10',   icon: 'text-emerald-400',  border: 'border-emerald-500/20' },
  { bar: 'from-blue-500 to-indigo-500',    glow: 'bg-blue-500/10',      icon: 'text-blue-400',     border: 'border-blue-500/20' },
  { bar: 'from-purple-500 to-pink-500',    glow: 'bg-purple-500/10',    icon: 'text-purple-400',   border: 'border-purple-500/20' },
  { bar: 'from-amber-500 to-orange-500',   glow: 'bg-amber-500/10',     icon: 'text-amber-400',    border: 'border-amber-500/20' },
  { bar: 'from-rose-500 to-red-500',       glow: 'bg-rose-500/10',      icon: 'text-rose-400',     border: 'border-rose-500/20' },
  { bar: 'from-teal-500 to-emerald-500',   glow: 'bg-teal-500/10',      icon: 'text-teal-400',     border: 'border-teal-500/20' },
  { bar: 'from-cyan-500 to-blue-500',      glow: 'bg-cyan-500/10',      icon: 'text-cyan-400',     border: 'border-cyan-500/20' },
  { bar: 'from-violet-500 to-purple-500',  glow: 'bg-violet-500/10',    icon: 'text-violet-400',   border: 'border-violet-500/20' },
];

export default function LanguagesPage() {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const fetchLanguages = () => {
    setLoading(true);
    getLanguages().then((d) => setLanguages(d || [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchLanguages(); }, []);

  const totalChannels = languages.reduce((s, l) => s + (l.channel_count || 0), 0);
  const maxCount = Math.max(...languages.map(l => l.channel_count || 0), 1);

  const filtered = languages
    .filter(l => !search || l.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortDesc ? (b.channel_count - a.channel_count) : (a.channel_count - b.channel_count));

  const goToChannels = (langName: string) => {
    router.push(`/channels?language=${encodeURIComponent(langName)}`);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Languages</h1>
          <p className="text-slate-400 mt-1">
            {languages.length} languages · {totalChannels.toLocaleString('en-IN')} total channels
          </p>
        </div>
        <button onClick={fetchLanguages} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-50 self-start text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search + Sort bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter languages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <button
          onClick={() => setSortDesc(s => !s)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-all"
          title={sortDesc ? 'Sort ascending' : 'Sort descending'}
        >
          {sortDesc ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
          <span className="hidden sm:inline">{sortDesc ? 'Most First' : 'Least First'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((l, i) => {
              const palette = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
              const pct = Math.round(((l.channel_count || 0) / maxCount) * 100);
              const sharePct = totalChannels > 0 ? ((l.channel_count / totalChannels) * 100).toFixed(1) : '0';

              return (
                <motion.div
                  key={l.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => goToChannels(l.name)}
                  className={`relative overflow-hidden rounded-2xl border ${palette.border} bg-slate-900/40 backdrop-blur-xl p-5 cursor-pointer group transition-all`}
                >
                  {/* Glow blob */}
                  <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl ${palette.glow}`} />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Globe className={`w-4 h-4 ${palette.icon}`} />
                        <span className="font-bold text-slate-200">{l.name}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${palette.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.04, ease: 'easeOut' }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-slate-400">
                        <TrendingUp className="w-3 h-3" />
                        <span className="text-sm font-bold text-slate-200">{l.channel_count.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-slate-500">channels</span>
                      </div>
                      <span className={`text-xs font-semibold ${palette.icon}`}>{sharePct}%</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-slate-700/50 bg-slate-900/40 p-12 text-center">
                <Globe className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400 font-semibold mb-1">No languages found</p>
                <p className="text-slate-500 text-sm">{search ? `No results for "${search}"` : 'No language data available yet.'}</p>
              </div>
            )}
          </div>

          {/* Summary bar */}
          {filtered.length > 0 && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribution</p>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {filtered.slice(0, 8).map((l, i) => {
                  const palette = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
                  const widthPct = totalChannels > 0 ? (l.channel_count / totalChannels) * 100 : 0;
                  return (
                    <motion.div
                      key={l.name}
                      title={`${l.name}: ${l.channel_count}`}
                      className={`bg-gradient-to-r ${palette.bar} rounded-sm`}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {filtered.slice(0, 8).map((l, i) => {
                  const palette = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
                  return (
                    <div key={l.name} className="flex items-center gap-1.5 text-xs">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${palette.bar}`} />
                      <span className="text-slate-400">{l.name}</span>
                    </div>
                  );
                })}
                {filtered.length > 8 && <span className="text-xs text-slate-500">+{filtered.length - 8} more</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
