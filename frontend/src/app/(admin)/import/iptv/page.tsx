'use client';

import { useState, useEffect } from 'react';
import { startImportJob, getImportJobs, getErrorMessage } from '@/lib/api';
import { CloudDownload, RefreshCw, AlertTriangle, CheckCircle, Database, Server } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ImportPage() {
  const [sourceUrl, setSourceUrl] = useState('https://iptv-org.github.io/iptv/index.m3u');
  const [country, setCountry] = useState('IN');
  const [skipAdult, setSkipAdult] = useState(true);
  const [loading, setLoading] = useState(false);
  interface ImportJob {
    id: number;
    status: string;
    total_parsed: number;
    inserted: number;
    updated: number;
    skipped: number;
    created_at: string;
  }
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchJobs = async () => {
    try {
      const data = await getImportJobs();
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchJobs());
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await startImportJob(sourceUrl, { country, skipAdult });
      setMessage({ type: 'success', text: 'Import job started in the background.' });
      fetchJobs();
    } catch (err: any) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to start import') });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <CloudDownload className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Import M3U Channels</h1>
          <p className="text-sm text-slate-400">Fetch, parse, and synchronize channels from global M3U lists in the background</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleStartImport} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">Configuration</h2>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Source URL</label>
              <input 
                type="url" 
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Country Filter (Optional)</label>
              <input 
                type="text" 
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="e.g. IN, US, UK"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <label className="flex items-center gap-2 mt-4 cursor-pointer">
              <input 
                type="checkbox" 
                checked={skipAdult}
                onChange={e => setSkipAdult(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-purple-500"
              />
              <span className="text-sm text-slate-300">Skip Adult Content</span>
            </label>

            {message.text && (
              <div className={`p-3 rounded-lg text-sm border ${message.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {loading ? 'Starting...' : 'Start Import Job'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" /> Recent Import Jobs
              </h2>
              <button onClick={fetchJobs} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Inserted/Updated</th>
                    <th className="px-4 py-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {jobs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No import jobs found</td></tr>
                  ) : jobs.map((job) => (
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={job.id} className="text-sm text-slate-300 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono">#{job.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          job.status === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                          job.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>
                          {job.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {job.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                          {job.status === 'running' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {job.total_parsed} parsed
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        <span className="text-emerald-400">+{job.inserted}</span> / <span className="text-blue-400">~{job.updated}</span> / <span className="text-amber-400">-{job.skipped}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

