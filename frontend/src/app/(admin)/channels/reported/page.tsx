'use client';

import { useEffect, useState } from 'react';
import { getReportedChannels, updateReportStatus, hideChannel } from '@/lib/api';
import { Tv, RefreshCw, AlertCircle, X, ShieldAlert, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stream {
  id: string;
  stream_url: string;
  health_status: string;
}

interface Report {
  report_id: string;
  issue_type: string;
  description: string;
  report_status: string;
  reported_at: string;
  channel_id: string;
  name: string;
  logo_url: string;
  stream_url: string;
  backup_stream_url: string;
  health_status: string;
  extra_streams: Stream[];
}

export default function ReportedChannelsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchReports = () => {
    setLoading(true);
    getReportedChannels('pending')
      .then((data) => setReports(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { void Promise.resolve().then(() => fetchReports()); }, []);

  const handleResolve = async (report: Report) => {
    setProcessing(true);
    try {
      await updateReportStatus(report.report_id, 'resolved');
      setReports(prev => prev.filter(r => r.channel_id !== report.channel_id));
      setSelectedReport(null);
    } catch {
      alert('Failed to update status');
    } finally {
      setProcessing(false);
    }
  };

  const handleHide = async (report: Report) => {
    if (!confirm(`Are you sure you want to hide ${report.name}?`)) return;
    setProcessing(true);
    try {
      await hideChannel(report.channel_id, 'Broken stream reported by users', false);
      await updateReportStatus(report.report_id, 'hidden');
      setReports(prev => prev.filter(r => r.channel_id !== report.channel_id));
      setSelectedReport(null);
    } catch {
      alert('Failed to hide channel');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-rose-400">
            User Reported Channels
          </h1>
          <p className="text-slate-400 mt-1">
            Review channels reported as broken or having streaming issues by users.
          </p>
        </div>
        <button onClick={fetchReports} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Channel</th>
                  <th className="px-6 py-4 font-semibold">Issue Type</th>
                  <th className="px-6 py-4 font-semibold">Message</th>
                  <th className="px-6 py-4 font-semibold">Reported At</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {reports.map((r) => (
                  <tr key={r.report_id} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setSelectedReport(r)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {r.logo_url ? (
                          <img src={r.logo_url} alt="" className="w-8 h-8 rounded-md object-contain bg-black/50 p-1" />
                        ) : <Tv className="w-8 h-8 p-1.5 rounded-md bg-slate-800 text-slate-500" />}
                        <div>
                          <div className="font-medium text-slate-200">{r.name}</div>
                          <div className="text-[10px] text-slate-500">Channel ID: {r.channel_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-semibold uppercase tracking-wide">
                        {r.issue_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate" title={r.description}>
                      {r.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(r.reported_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedReport(r); }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-blue-400 transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No pending reports!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-rose-500" />
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  {selectedReport.logo_url ? (
                    <img src={selectedReport.logo_url} className="w-10 h-10 object-contain bg-black/50 p-1 rounded-md" />
                  ) : <Tv className="w-10 h-10 text-slate-500 p-1 bg-slate-800 rounded-md" />}
                  <h3 className="text-xl font-bold text-slate-100">{selectedReport.name}</h3>
                </div>
                <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                  <p className="text-sm text-orange-400 font-semibold mb-1 uppercase tracking-wide text-[10px]">User Issue Description</p>
                  <p className="text-slate-200 text-sm">{selectedReport.description || 'Failed to load stream.'}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stream Links</h4>
                  
                  {selectedReport.stream_url && (
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-3 overflow-hidden">
                      <Link className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mr-2 border border-emerald-500/30 px-1 rounded bg-emerald-500/10">Primary</span>
                        <span className="text-slate-300 text-sm truncate">{selectedReport.stream_url}</span>
                      </div>
                    </div>
                  )}

                  {selectedReport.backup_stream_url && (
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-3 overflow-hidden">
                      <Link className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mr-2 border border-blue-500/30 px-1 rounded bg-blue-500/10">Backup</span>
                        <span className="text-slate-300 text-sm truncate">{selectedReport.backup_stream_url}</span>
                      </div>
                    </div>
                  )}

                  {selectedReport.extra_streams?.map((s, idx) => (
                    <div key={s.id} className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-3 overflow-hidden">
                      <Link className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mr-2 border border-purple-500/30 px-1 rounded bg-purple-500/10">Extra {idx + 1}</span>
                        <span className="text-slate-300 text-sm truncate">{s.stream_url}</span>
                      </div>
                    </div>
                  ))}
                  
                  {!selectedReport.stream_url && !selectedReport.backup_stream_url && (!selectedReport.extra_streams || selectedReport.extra_streams.length === 0) && (
                    <p className="text-slate-500 text-sm">No streaming links available.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button 
                  onClick={() => handleHide(selectedReport)}
                  disabled={processing}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600/20 text-rose-400 font-semibold hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-colors"
                >
                  Hide Channel
                </button>
                <button 
                  onClick={() => handleResolve(selectedReport)}
                  disabled={processing}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold"
                >
                  Mark as Resolved
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

