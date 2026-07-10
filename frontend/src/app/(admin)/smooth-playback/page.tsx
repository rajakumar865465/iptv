'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getSmoothPlaybackHealth,
  getSmoothPlaybackChannels,
  updateSmoothPlaybackChannel,
  restartSmoothPlaybackRecorder,
  clearSmoothPlaybackStaleBuffer,
  testSmoothPlaybackSegment,
  promoteSmoothPlaybackBackup,
  resetSmoothPlaybackCounters,
  disableAllSmoothPlaybackChannels,
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
  clean_buffer_count?: number;
  minor_gaps_count?: number;
  gap_repaired_count?: number;
  skipping_count?: number;
  using_backup_count?: number;
  using_lower_quality_count?: number;
  too_many_missing_count?: number;
  source_timeout_count?: number;
  source_dead_count?: number;
  skip_mode_count?: number;
  black_filler_count?: number;
  strict_stop_count?: number;
  backup_active_channels?: number;
  avg_clean_buffer_pct?: number;
  total_missing_segments?: number;
  total_skipped_segments?: number;
  total_recovered_segments?: number;
  total_backup_segments?: number;
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
  // New buffer quality fields
  gap_handling_mode?: string;
  allow_skip_missing_segments?: boolean;
  missing_segment_count?: number;
  skipped_segment_count?: number;
  recovered_segment_count?: number;
  backup_segment_count?: number;
  lower_quality_segment_count?: number;
  clean_buffer_percentage?: number;
  buffer_quality_status?: string;
  total_expected_segments?: number;
  downloaded_segments?: number;
  last_missing_segment_at?: string | null;
  last_successful_segment_at?: string | null;
  last_source_error?: string | null;
  active_recorder_stream_id?: number | null;
  backup_active?: boolean;
  good_segment_count?: number;
  missing_segment_count_db?: number;
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
  // Buffer quality statuses
  clean_buffer: 'bg-green-500/20 text-green-400 border-green-500/30',
  minor_gaps: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  gap_repaired: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  skipping_missing_segments: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  using_backup_segments: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  using_lower_quality_segments: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  too_many_missing_segments: 'bg-red-500/20 text-red-400 border-red-500/30',
  source_dead: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const GAP_MODES = ['skip_missing_chunks', 'black_filler', 'strict_stop'] as const;
const BUFFER_QUALITY_STATUSES = [
  'clean_buffer', 'minor_gaps', 'gap_repaired', 'skipping_missing_segments',
  'using_backup_segments', 'using_lower_quality_segments', 'too_many_missing_segments',
  'source_timeout', 'source_dead', 'no_working_source',
];

function cleanBufferColor(pct: number | undefined): string {
  const p = pct ?? 100;
  if (p >= 85) return 'text-green-400';
  if (p >= 65) return 'text-yellow-400';
  if (p >= 60) return 'text-orange-400';
  return 'text-red-400';
}

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

  async function handleDisableAll() {
    if (!confirm('Are you sure you want to disable smooth playback for ALL channels?')) return;
    setSaving(-1); // Use -1 to indicate global saving state
    try {
      const res = await disableAllSmoothPlaybackChannels();
      showToast(`Success: ${res?.message || 'All channels disabled'}`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Disable all failed'));
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

  async function handleClearStale(ch: ChannelRow) {
    setSaving(ch.id);
    try {
      await clearSmoothPlaybackStaleBuffer(ch.id);
      showToast(`${ch.name}: stale buffer cleared`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Clear failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleTestSegment(ch: ChannelRow) {
    setSaving(ch.id);
    try {
      const result = await testSmoothPlaybackSegment(ch.id);
      showToast(result?.is_playable
        ? `${ch.name}: segment OK (${result.segment_count_in_playlist} segments)`
        : `${ch.name}: test failed — ${result?.error || 'not playable'}`);
    } catch (err) {
      showToast(getErrorMessage(err, 'Test failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handlePromoteBackup(ch: ChannelRow) {
    if (!confirm(`Promote backup stream to primary for "${ch.name}"? The recorder will restart.`)) return;
    setSaving(ch.id);
    try {
      await promoteSmoothPlaybackBackup(ch.id);
      showToast(`${ch.name}: backup promoted to primary`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Promote failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleResetCounters(ch: ChannelRow) {
    setSaving(ch.id);
    try {
      await resetSmoothPlaybackCounters(ch.id);
      showToast(`${ch.name}: buffer counters reset`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Reset failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleGapModeChange(ch: ChannelRow, mode: string) {
    setSaving(ch.id);
    try {
      await updateSmoothPlaybackChannel(ch.id, { gap_handling_mode: mode });
      showToast(`${ch.name}: gap mode → ${mode.replace(/_/g, ' ')}`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Update failed'));
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleSkip(ch: ChannelRow, allow: boolean) {
    setSaving(ch.id);
    try {
      await updateSmoothPlaybackChannel(ch.id, { allow_skip_missing_segments: allow });
      showToast(`${ch.name}: skip missing ${allow ? 'enabled' : 'disabled'}`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Update failed'));
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Enabled', value: health.enabled_count, color: 'text-blue-400' },
              { label: 'Ready', value: health.ready_count, color: 'text-green-400' },
              { label: 'Clean Buffer', value: health.clean_buffer_count ?? 0, color: 'text-green-400' },
              { label: 'Skipping', value: health.skipping_count ?? 0, color: 'text-orange-400' },
              { label: 'Backup Active', value: (health.using_backup_count ?? 0) + (health.backup_active_channels ?? 0), color: 'text-cyan-400' },
              { label: 'Avg Clean %', value: `${Math.round(health.avg_clean_buffer_pct ?? 100)}%`, color: cleanBufferColor(health.avg_clean_buffer_pct ?? 100) },
              { label: `Recorders (${health.active_recorders}/${health.max_recorders})`, value: health.active_recorders, color: 'text-cyan-400' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-gray-400 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Warming Up', value: health.warming_count ?? 0, color: 'text-yellow-400' },
              { label: 'Low Buffer', value: health.low_buffer_count ?? 0, color: 'text-orange-400' },
              { label: 'Minor Gaps', value: health.minor_gaps_count ?? 0, color: 'text-yellow-400' },
              { label: 'Gap Repaired', value: health.gap_repaired_count ?? 0, color: 'text-cyan-400' },
              { label: 'Lower Quality', value: health.using_lower_quality_count ?? 0, color: 'text-purple-400' },
              { label: 'Too Many Missing', value: health.too_many_missing_count ?? 0, color: 'text-red-400' },
              { label: 'Source Timeout', value: health.source_timeout_count ?? 0, color: 'text-red-400' },
              { label: 'Source Dead', value: health.source_dead_count ?? 0, color: 'text-red-400' },
              { label: 'Offline', value: health.offline_count ?? 0, color: 'text-red-400' },
              { label: 'Total Missing Segs', value: health.total_missing_segments ?? 0, color: 'text-orange-400' },
              { label: 'Total Skipped Segs', value: health.total_skipped_segments ?? 0, color: 'text-orange-400' },
              { label: 'Total Recovered', value: health.total_recovered_segments ?? 0, color: 'text-cyan-400' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800/60 border border-gray-700/60 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-gray-500 text-[10px] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </>
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
        <button
          onClick={handleDisableAll}
          disabled={saving === -1}
          className="bg-red-900/50 hover:bg-red-800/60 text-red-200 border border-red-800 px-4 py-2 rounded-lg text-sm ml-auto disabled:opacity-50"
        >
          {saving === -1 ? 'Disabling...' : 'Turn Off All'}
        </button>
        <span className="text-gray-500 text-sm self-center ml-4">{total} channels</span>
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
                <th className="text-left px-4 py-3">Buffer Quality</th>
                <th className="text-left px-4 py-3">Clean %</th>
                <th className="text-left px-4 py-3">Segments</th>
                <th className="text-left px-4 py-3">Recorder Info</th>
                <th className="text-left px-4 py-3">Delay Setting</th>
                <th className="text-left px-4 py-3">Gap Mode</th>
                <th className="text-left px-4 py-3">Enabled</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-500">Loading...</td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-500">No channels found</td>
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
                      <div>
                        <StatusBadge status={ch.buffer_quality_status || 'clean_buffer'} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        DL: {ch.downloaded_segments ?? 0} / {ch.total_expected_segments ?? 0}
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-bold ${cleanBufferColor(ch.clean_buffer_percentage)}`}>
                      {ch.clean_buffer_percentage !== undefined && ch.clean_buffer_percentage !== null
                        ? `${Math.round(ch.clean_buffer_percentage)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 space-y-0.5">
                      <div className="text-gray-300">{ch.segment_count} total</div>
                      <div className={ch.missing_segment_count ? 'text-red-400' : 'text-gray-500'}>
                        ✗ missing: {ch.missing_segment_count ?? 0}
                      </div>
                      <div className={ch.skipped_segment_count ? 'text-orange-400' : 'text-gray-500'}>
                        ⤳ skipped: {ch.skipped_segment_count ?? 0}
                      </div>
                      <div className={ch.recovered_segment_count ? 'text-cyan-400' : 'text-gray-500'}>
                        ✓ recovered: {ch.recovered_segment_count ?? 0}
                      </div>
                      <div className={ch.backup_segment_count ? 'text-blue-400' : 'text-gray-500'}>
                        backup: {ch.backup_segment_count ?? 0}
                      </div>
                      <div className={ch.lower_quality_segment_count ? 'text-purple-400' : 'text-gray-500'}>
                        lower-q: {ch.lower_quality_segment_count ?? 0}
                      </div>
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
                          <div className="text-cyan-400">Backup switches: {ch.recorder_backup_attempts}</div>
                        )}
                        {ch.last_source_error && (
                          <div className="text-red-400 truncate max-w-xs" title={ch.last_source_error}>
                            Error: {ch.last_source_error}
                          </div>
                        )}
                        {ch.last_successful_segment_at && (
                          <div className="text-green-500 text-[10px]">
                            Last good: {new Date(ch.last_successful_segment_at).toLocaleTimeString()}
                          </div>
                        )}
                        {ch.last_missing_segment_at && (
                          <div className="text-orange-500 text-[10px]">
                            Last missing: {new Date(ch.last_missing_segment_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </td>
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
                      <div className="text-[10px] text-gray-500 mt-1">
                        {ch.buffer_depth_seconds > 0 ? `${ch.buffer_depth_seconds}s buffered` : 'no buffer'}
                        {ch.is_buffer_ready && <span className="ml-1 text-green-400">✓</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={saving === ch.id || !ch.smooth_playback_enabled}
                        value={ch.gap_handling_mode || 'skip_missing_chunks'}
                        onChange={(e) => handleGapModeChange(ch, e.target.value)}
                        className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        {GAP_MODES.map((m) => (
                          <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                        <input
                          type="checkbox"
                          disabled={saving === ch.id || !ch.smooth_playback_enabled}
                          checked={ch.allow_skip_missing_segments !== false}
                          onChange={(e) => handleToggleSkip(ch, e.target.checked)}
                        />
                        Skip missing
                      </label>
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
                      <div className="flex flex-col gap-1">
                        {ch.smooth_playback_enabled && (
                          <>
                            <button
                              disabled={saving === ch.id}
                              onClick={() => handleRestart(ch)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded disabled:opacity-50"
                            >
                              Restart
                            </button>
                            <button
                              disabled={saving === ch.id}
                              onClick={() => handleTestSegment(ch)}
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded disabled:opacity-50"
                            >
                              Test Seg
                            </button>
                            <button
                              disabled={saving === ch.id || !ch.recorder_backup_stream_url}
                              onClick={() => handlePromoteBackup(ch)}
                              className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white px-2 py-1 rounded disabled:opacity-50"
                            >
                              Promote Backup
                            </button>
                          </>
                        )}
                        <button
                          disabled={saving === ch.id}
                          onClick={() => handleResetCounters(ch)}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded disabled:opacity-50"
                        >
                          Reset Counts
                        </button>
                        <button
                          disabled={saving === ch.id}
                          onClick={() => handleClearStale(ch)}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded disabled:opacity-50"
                        >
                          Clear Stale
                        </button>
                      </div>
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
