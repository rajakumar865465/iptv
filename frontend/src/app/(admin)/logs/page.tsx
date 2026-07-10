'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  ScrollText, RefreshCw, Search, Filter, AlertTriangle, 
  CheckCircle2, Info, XCircle, ChevronRight, Activity, Shield
} from 'lucide-react';
import { getSystemLogs } from '@/lib/api';

type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'success';

interface SystemLog {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  statusCode: number | null;
  channelId: number | null;
  userId: number | null;
  requestPath: string | null;
  errorDetails: any;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  const [filterSource, setFilterSource] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const fetchLogs = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }
      setError(null);
      
      const res = await getSystemLogs({
        page: reset ? 1 : page,
        limit: 50,
        source: filterSource,
        level: filterLevel,
        search: searchQuery
      });
      
      if (res.success) {
        if (reset) {
          setLogs(res.logs);
        } else {
          setLogs(prev => [...prev, ...res.logs]);
        }
        setHasMore(res.pagination?.hasMore || false);
      } else {
        throw new Error('Failed to load logs');
      }
    } catch (err: any) {
      setError(err.message || 'Could not load logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, filterSource, filterLevel, searchQuery]);

  useEffect(() => {
    fetchLogs(true);
  }, [filterSource, filterLevel, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    fetchLogs(true);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-red-900/40 text-red-400 border border-red-700/50 flex items-center gap-1"><XCircle size={10} /> ERROR</span>;
      case 'warning': return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-orange-900/40 text-orange-400 border border-orange-700/50 flex items-center gap-1"><AlertTriangle size={10} /> WARN</span>;
      case 'success': return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-green-900/40 text-green-400 border border-green-700/50 flex items-center gap-1"><CheckCircle2 size={10} /> SUCCESS</span>;
      case 'debug': return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-gray-800 text-gray-400 border border-gray-600 flex items-center gap-1"><Info size={10} /> DEBUG</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-blue-900/40 text-blue-400 border border-blue-700/50 flex items-center gap-1"><Info size={10} /> INFO</span>;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            System Logs
          </h1>
          <p className="text-slate-400 mt-1">View backend, scanner, playback, auth, and admin activity logs.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-all border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Controls & Filters */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {['all', 'backend', 'stream_scanner', 'admin', 'auth'].map(source => (
            <button
              key={source}
              onClick={() => setFilterSource(source)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filterSource === source 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                  : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {source === 'all' ? 'All Logs' : source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Search & Level Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search log messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-400">{error}</h3>
          <button 
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg font-medium hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Logs Table */}
      {!error && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold w-40">Time</th>
                  <th className="py-3 px-4 font-semibold w-24">Level</th>
                  <th className="py-3 px-4 font-semibold w-32">Source</th>
                  <th className="py-3 px-4 font-semibold">Message</th>
                  <th className="py-3 px-4 font-semibold w-48 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-lg font-medium">No logs available.</p>
                      <p className="text-sm">Try adjusting your filters or search query.</p>
                    </td>
                  </tr>
                )}
                {logs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap align-top">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {getLevelBadge(log.level)}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md">
                        {log.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <p className="text-sm text-slate-200 break-words">{log.message}</p>
                      {log.errorDetails && (
                        <div className="mt-2">
                          <button
                            onClick={() => setExpandedLog(expandedLog === i ? null : i)}
                            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                          >
                            <ChevronRight className={`w-3 h-3 transition-transform ${expandedLog === i ? 'rotate-90' : ''}`} />
                            {expandedLog === i ? 'Hide payload' : 'View payload'}
                          </button>
                          
                          {expandedLog === i && (
                            <div className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
                              <pre className="text-[10px] text-emerald-400 font-mono">
                                {JSON.stringify(log.errorDetails, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-right space-y-1">
                      {log.statusCode && (
                        <div className="text-xs inline-flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md w-max ml-auto">
                          <Activity size={12} /> HTTP {log.statusCode}
                        </div>
                      )}
                      {log.channelId && (
                        <div className="text-xs inline-flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md w-max ml-auto">
                          <Info size={12} /> CH {log.channelId}
                        </div>
                      )}
                      {log.userId && (
                        <div className="text-xs inline-flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md w-max ml-auto">
                          <Shield size={12} /> USR {log.userId}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination / Loading */}
          <div className="p-4 border-t border-slate-800 flex justify-center bg-slate-900">
            {loading ? (
              <div className="flex items-center gap-2 text-indigo-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading logs...</span>
              </div>
            ) : hasMore ? (
              <button
                onClick={() => {
                  setPage(p => p + 1);
                  fetchLogs();
                }}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors border border-slate-700 shadow-sm"
              >
                Load More
              </button>
            ) : logs.length > 0 ? (
              <span className="text-sm text-slate-500 font-medium">End of logs</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
