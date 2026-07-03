'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getSmoothPlaybackHealth,
  getSmoothPlaybackChannels,
  updateSmoothPlaybackChannel,
  restartSmoothPlaybackRecorder,
  getErrorMessage,
} from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BufferHealth {
  enabled_count: number;
  ready_count: number;
  warming_count: number;
  low_buffer_count: number;
  offline_count: number;
  error_count: number;
  avg_depth_seconds: number;
  active_recorders: number;
  max_recorders: number;
}

interface ChannelRow {
  id: number;
  name: string;
  health_status: string;
  smooth_playback_enabled: boolean;
  playback_delay_seconds: number;
  buffer_status: string;
  buffer_depth_seconds: number;
  is_buffer_ready: boolean;
  restream_mode: string;
  last_buffer_error: string | null;
  segment_count: number;
  recorder_active: boolean;
  recorder_stream_url: string | null;
  recorder_stream_id: number | null;
  recorder_fail_count: number;
  recorder_last_success_at: string | null;
  recorder_last_failure_at: string | null;
  recorder_last_failure_reason: string | null;
  recorder_backup_attempts: number;
  recorder_status_detail: string | null;
  needs_manual_verification?: boolean;
  recorder_failed_stream_url?: string | null;
  recorder_backup_stream_url?: string | null;
}

// ── Status badge helpers ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  buffer_ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  warming_up: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low_buffer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  source_slow: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  source_timeout: 'bg-red-500/20 text-red-400 border-red-500/30',
  trying_backup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  backup_active: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  segment_missing: 'bg-red-500/20 text-red-400 border-red-500/30',
  source_offline: 'bg-red-500/20 text-red-400 border-red-500/30',
  no_working_source: 'bg-red-500/20 text-red-400 border-red-500/30',
  requires_licensed_source: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  direct: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Delay options ─────────────────────────────────────────────────────────────

const DELAY_OPTIONS = [
  { label: 'Direct Live', value: 0, mode: 'direct' },
  { label: '2 min delay', value: 120, mode: 'delayed' },
  { label: '5 min delay (default)', value: 300, mode: 'delayed' },
  { label: '10 min delay', value: 600, mode: 'delayed' },
  { label: 'Disabled', value: -1, mode: 'disabled' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SmoothPlaybackPage() {
  const [health, setHealth] = useState<BufferHealth | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, c] = await Promise.all([
        getSmoothPlaybackHealth(),
        getSmoothPlaybackChannels({
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);
      setHealth(h);
      setChannels(c.channels || []);
      setTotal(c.pagination?.total || 0);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(ch: ChannelRow, enabled: boolean) {
    setSaving(ch.id);
    try {
      await updateSmoothPlaybackChannel(ch.id, {
        smooth_playback_enabled: enabled,
        restream_mode: enabled ? 'delayed' : 'direct',
        playback_delay_seconds: ch.playback_delay_seconds || 300,
      });
      showToast(`${ch.name}: smooth playback ${enabled ? 'enabled' : 'disabled'}`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Update failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleDelayChange(ch: ChannelRow, value: number, mode: string) {
    setSaving(ch.id);
    try {
      if (mode === 'disabled') {
        await updateSmoothPlaybackChannel(ch.id, {
          smooth_playback_enabled: false,
          restream_mode: 'disabled',
        });
      } else if (mode === 'direct') {
        await updateSmoothPlaybackChannel(ch.id, {
          smooth_playback_enabled: false,
          restream_mode: 'direct',
        });
      } else {
        await updateSmoothPlaybackChannel(ch.id, {
          smooth_playback_enabled: true,
          restream_mode: 'delayed',
          playback_delay_seconds: value,
        });
      }
      showToast(`${ch.name}: updated`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Update failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleRestart(ch: ChannelRow) {
    setSaving(ch.id);
    try {
      await restartSmoothPlaybackRecorder(ch.id);
      showToast(`${ch.name}: recorder restarted`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Restart failed'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Smooth Playback</h1>
        <p className="text-gray-400 text-sm mt-1">
          5-minute delayed rolling HLS buffer — reduces buffering on unstable live channels.
          Only enable for legal, public, or properly licensed streams.
        </p>
      </div>

      {/* Health Summary */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Enabled', value: health.enabled_count, color: 'text-blue-400' },
            { label: 'Ready', value: health.ready_count, color: 'text-green-400' },
            { label: 'Warming Up', value: health.warming_count, color: 'text-yellow-400' },
            { label: 'Low Buffer', value: health.low_buffer_count, color: 'text-orange-400' },
            { label: 'Offline', value: health.offline_count, color: 'text-red-400' },
            { label: 'Avg Depth', value: `${health.avg_depth_seconds}s`, color: 'text-purple-400' },
            { label: `Recorders (${health.active_recorders}/${health.max_recorders})`, value: health.active_recorders, color: 'text-cyan-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-gray-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All statuses</option>
          {['buffer_ready', 'warming_up', 'low_buffer', 'source_timeout', 'trying_backup', 'backup_active', 'buffer_empty', 'source_offline', 'no_working_source', 'requires_licensed_source', 'stopped', 'error'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          Refresh
        </button>
        <span className="text-gray-500 text-sm self-center">{total} channels</span>
      </div>

      {/* Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Channel</th>
                <th className="text-left px-4 py-3">Health</th>
                <th className="text-left px-4 py-3">Buffer Status</th>
                <th className="text-left px-4 py-3">Recorder Info</th>
                <th className="text-left px-4 py-3">Depth</th>
                <th className="text-left px-4 py-3">Segments</th>
                <th className="text-left px-4 py-3">Delay Setting</th>
                <th className="text-left px-4 py-3">Enabled</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">Loading...</td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">No channels found</td>
                </tr>
              ) : (
                channels.map((ch) => (
                  <tr key={ch.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{ch.name}</div>
                      <div className="text-gray-500 text-xs">#{ch.id}</div>
                      {ch.last_buffer_error && (
                        <div className="text-red-400 text-xs mt-1 max-w-xs truncate" title={ch.last_buffer_error}>
                          ⚠ {ch.last_buffer_error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ch.health_status || 'unknown'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={ch.buffer_status || 'stopped'} />
                        {ch.recorder_active && (
                          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Recorder active" />
                        )}
                      </div>
                      {ch.recorder_status_detail && ch.recorder_status_detail !== ch.buffer_status && (
                        <div className="text-xs text-gray-400 mt-1">{ch.recorder_status_detail.replace(/_/g, ' ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-300 space-y-1">
                        {ch.needs_manual_verification && (
                          <div className="text-amber-300">Needs manual verification</div>
                        )}
                        {ch.recorder_stream_id && (
                          <div>Stream: #{ch.recorder_stream_id}</div>
                        )}
                        {ch.recorder_stream_url && (
                          <div className="truncate max-w-xs" title={ch.recorder_stream_url}>Current: {ch.recorder_stream_url}</div>
                        )}
                        {ch.recorder_failed_stream_url && (
                          <div className="text-red-300 truncate max-w-xs" title={ch.recorder_failed_stream_url}>Failed: {ch.recorder_failed_stream_url}</div>
                        )}
                        {ch.recorder_backup_stream_url && (
                          <div className="text-cyan-300 truncate max-w-xs" title={ch.recorder_backup_stream_url}>Backup: {ch.recorder_backup_stream_url}</div>
                        )}
                        {ch.recorder_fail_count > 0 && (
                          <div className="text-orange-400">Fails: {ch.recorder_fail_count}</div>
                        )}
                        {ch.recorder_backup_attempts > 0 && (
                          <div className="text-cyan-400">Backups: {ch.recorder_backup_attempts}</div>
                        )}
                        {ch.recorder_last_failure_at && (
                          <div className="text-red-400 truncate max-w-xs" title={ch.recorder_last_failure_reason || ''}>
                            Last fail: {new Date(ch.recorder_last_failure_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {ch.buffer_depth_seconds > 0 ? `${ch.buffer_depth_seconds}s` : '—'}
                      {ch.is_buffer_ready && <span className="ml-1 text-green-400 text-xs">✓</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{ch.segment_count}</td>
                    <td className="px-4 py-3">
                      <select
                        disabled={saving === ch.id}
                        value={
                          !ch.smooth_playback_enabled && ch.restream_mode === 'disabled' ? -1
                          : !ch.smooth_playback_enabled ? 0
                          : ch.playback_delay_seconds
                        }
                        onChange={(e) => {
                          const opt = DELAY_OPTIONS.find((o) => o.value === parseInt(e.target.value));
                          if (opt) handleDelayChange(ch, opt.value, opt.mode);
                        }}
                        className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        {DELAY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={saving === ch.id}
                        onClick={() => handleToggle(ch, !ch.smooth_playback_enabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          ch.smooth_playback_enabled ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          ch.smooth_playback_enabled ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {ch.smooth_playback_enabled && (
                        <button
                          disabled={saving === ch.id}
                          onClick={() => handleRestart(ch)}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded disabled:opacity-50"
                        >
                          Restart
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-300">
        <strong className="text-blue-200">How it works:</strong> When enabled, the backend continuously downloads HLS segments
        from the source stream and stores a rolling 5-minute buffer on disk. The app plays from this buffer instead of the live edge,
        giving the player pre-downloaded segments and eliminating live-edge buffering.
        Old segments are deleted automatically. Only enable for legal, public, or licensed streams.
      </div>
    </div>
  );
}
