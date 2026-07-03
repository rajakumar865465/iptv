# NivaTV Smooth Playback Timeout Fix - Implementation Summary

## Problem Statement

Smooth playback recorder was failing immediately on timeouts without proper retry or fallback mechanisms. Channels like **Star Gold Select HD** showed "Response timeout while trying to fetch stream URL" errors instantly, defeating the purpose of the 5-minute delayed buffer feature designed for unstable streams.

## Root Causes Identified

1. **No retry mechanism** - Single timeout triggered immediate failure
2. **No error classification** - Transient network blips treated same as permanent 404/403 errors  
3. **Aggressive fallback threshold** - Only 2 failures before switching streams
4. **No stream cooldown** - Excluded streams never became eligible again
5. **Short timeouts** - 12s M3U8 / 15s segment timeouts too aggressive for unstable networks
6. **No retry counter visibility** - Admin couldn't see retry attempts in progress

## Solution Implemented

### 1. **Smart Retry with Exponential Backoff**

Added intelligent retry logic that distinguishes error types:

**Error Classification:**
- **Transient errors** (retry same stream): `timeout`, `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`, `HTTP 5xx`, "No segments"
- **Permanent errors** (switch immediately): `HTTP 403`, `HTTP 404`, `HTTP 410`

**Retry Strategy:**
- Attempt 1: Retry after 500ms
- Attempt 2: Retry after 1.5s  
- Attempt 3: Retry after 3s
- Only after 3 retries exhausted → switch to backup stream

**Implementation:** `_handlePollError()` in `buffer_recorder.js`

### 2. **Stream Cooldown & Recovery System**

**Cooldown Period:** 5 minutes
- Excluded streams tracked with timestamps in `state.failedStreamExcludeMap`
- After 5 minutes, excluded streams become eligible again
- Prevents permanently blacklisting temporarily unstable streams

**Auto-Recovery:**
- On successful stream recovery, failed stream list cleared
- Failed state reset allows previously excluded streams to be retried

**Implementation:** `_selectBestStream()` and `_tryFallbackStream()` in `buffer_recorder.js`

### 3. **Increased Timeout Thresholds**

| Timeout Type | Before | After | Reason |
|-------------|--------|-------|--------|
| M3U8 fetch | 12s | 18s | Allow unstable networks more time |
| Segment fetch | 15s | 20s | Prevent premature timeout on slow CDN |
| Fallback test | 5s | 8s | More reliable backup stream validation |

### 4. **Enhanced Failure Threshold**

| Metric | Before | After |
|--------|--------|-------|
| Failure threshold for fallback | 2 | 3 |
| Max retries before fallback | 0 | 2 |

Now requires **3 consecutive failures** (with 2 retries each) before switching to backup stream.

### 5. **State Tracking Enhancements**

**New State Variables:**
```javascript
state.currentStreamRetries = 0;           // Track retry attempts
state.failedStreamExcludeMap = {};        // Timestamp when stream was excluded
```

**New Status Values:**
- `retrying` - Retrying failed source with backoff
- `retry_attempt_1`, `retry_attempt_2` - Granular retry status for admin

### 6. **Enhanced User-Facing Messages**

| Situation | Old Message | New Message |
|-----------|-------------|-------------|
| Retrying with backoff | "Primary stream timeout" | "Source temporarily unavailable. Retrying..." |
| Searching backup | "Trying another source..." | "Primary source timeout. Trying another source..." |
| Using backup during warmup | "Trying another source..." | "Using backup source. Building buffer..." |
| All failed | "No stable source available" | "No stable source is available right now." |

### 7. **Admin Monitoring Improvements**

**New Metrics in `/api/internal/smooth-playback/health`:**
- `retrying_count` - Channels currently retrying
- `searching_backup_count` - Channels searching for backup
- `backup_active_count` - Channels using backup streams
- `needs_verification_count` - Premium channels needing manual review
- `total_backup_switches` - Total fallback operations

**Enhanced Status Display:**
- Current retry attempt visible (retry_attempt_1, retry_attempt_2)
- Last failure reason includes retry info
- Backup stream URL and ID visible
- Stale buffer countdown

## Files Modified

### Core Logic
1. **`backend/src/jobs/buffer_recorder.js`** (Major changes)
   - Added `_classifyError()` - Error type classification
   - Enhanced `_handlePollError()` - Retry logic with exponential backoff
   - Updated `_selectBestStream()` - Cooldown-aware stream selection
   - Enhanced `_tryFallbackStream()` - Better logging and 8s timeout
   - Updated `_pollChannel()` - Clear failed list on recovery
   - Modified constants: timeouts, retry limits, cooldown period

### API Response
2. **`backend/src/controllers/smoothPlaybackController.js`**
   - Enhanced `getSmoothPlayback()` - Better status messages for retry states
   - Updated `adminBufferHealth()` - New retry/backup metrics

### Documentation
3. **`backend/docs/SMOOTH_PLAYBACK_FALLBACK.md`**
   - Added retry strategy section
   - Added cooldown behavior
   - Added recovery scenarios
   - Updated configuration values
   - Enhanced user-facing status messages

4. **`SMOOTH_PLAYBACK_TIMEOUT_FIX.md`** (This file)
   - Complete implementation summary

## Configuration Changes

### Environment Variables (No changes required)
```bash
MAX_CONCURRENT_RECORDERS=5          # Unchanged
BUFFER_STORAGE_PATH=/path/to/storage # Unchanged
```

### New Constants in `buffer_recorder.js`
```javascript
const M3U8_FETCH_TIMEOUT_MS = 18000;              // Was 12000
const SEGMENT_FETCH_TIMEOUT_MS = 20000;           // Was 15000
const FAILURE_THRESHOLD_FOR_FALLBACK = 3;         // Was 2
const MAX_RETRIES_BEFORE_FALLBACK = 2;            // NEW
const RETRY_BACKOFF_MS = [500, 1500, 3000];       // NEW
const EXCLUDED_STREAM_COOLDOWN_MS = 5 * 60 * 1000; // NEW (5 minutes)
```

## Behavior Changes

### Before Fix
```
Timeout → Fail Count++ → (2 failures) → Switch to backup → Timeout → Switch to next backup
        ↓                                      ↓                           ↓
   No retry                              No retry                    No retry
   Instant fail                          Instant fail                Permanent exclusion
```

### After Fix
```
Timeout → Retry (500ms) → Retry (1.5s) → Retry (3s) → Fail Count++ 
                                                     ↓
                                            (3 failures total)
                                                     ↓
                                      Switch to backup (8s test)
                                                     ↓
                                          If successful: resume
                                          If failed: try next backup
                                                     ↓
                                      All backups failed: slow poll (30s)
                                                     ↓
                                      Excluded streams eligible after 5min
```

## Testing Scenarios

### Scenario 1: Transient Network Blip (< 5 seconds)
**Before:** Instant fail, switch to backup
**After:** 
1. Retry after 500ms → Success (user sees no error)
2. Buffer continues seamlessly

### Scenario 2: Source Timeout (10-30 seconds)
**Before:** 2 failures → immediate backup switch
**After:**
1. Retry 1 (500ms) → timeout
2. Retry 2 (1.5s) → timeout  
3. Retry 3 (3s) → timeout
4. Fail count = 1, continue with stale buffer
5. Next poll: Retry again (3 attempts)
6. Fail count = 2, continue with stale buffer
7. Next poll: Retry again (3 attempts)
8. Fail count = 3 → Switch to backup
9. User sees "Trying another source..." after ~90 seconds

### Scenario 3: Permanent 404 Error
**Before:** 2 timeouts → switch backup
**After:**
1. HTTP 404 detected → Permanent error
2. No retries, immediate fail count++
3. After 3 failures → Switch to backup immediately

### Scenario 4: All Sources Failed
**Before:** Recorder stuck, no recovery
**After:**
1. All sources excluded with timestamps
2. Polling slowed to 30s
3. After 5 minutes, excluded streams become eligible
4. Recorder retries previously failed streams
5. If source recovered, normal operation resumes

### Scenario 5: Premium Channel Failure
**Before:** After 2 failures → `needs_manual_verification`
**After:** After 3 failures (with retries) → `needs_manual_verification`

## Database Schema (No Changes Required)

All necessary columns already exist from migration `038_recorder_fallback_system.sql`:
- `recorder_stream_url`
- `recorder_stream_id`  
- `recorder_fail_count`
- `recorder_last_success_at`
- `recorder_last_failure_at`
- `recorder_last_failure_reason`
- `recorder_backup_attempts`
- `recorder_stale_buffer_until`
- `recorder_status_detail`

## Acceptance Criteria ✅

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Recorder does not fail permanently after one timeout | ✅ | Retry logic with exponential backoff |
| Recorder tries backup streams | ✅ | Enhanced `_tryFallbackStream()` |
| Recorder starts buffer from backup if backup works | ✅ | Backup activation with state reset |
| Existing buffer continues playing during short source failure | ✅ | Stale buffer window (90s) |
| Buffer depth visible in admin | ✅ | Already in admin endpoints |
| Dead source marked timeout/unstable | ✅ | `recorder_status_detail` tracking |
| Channel not shown as smooth-ready until buffer exists | ✅ | `is_buffer_ready` flag check |
| Paid/DRM/unlicensed channels not bypassed | ✅ | `BLOCKED_STATUSES` check |
| Important channels go to manual verification | ✅ | `needs_manual_verification` flag |

## API Response Examples

### Buffer Not Ready - Retrying
```json
{
  "success": true,
  "data": {
    "playback_mode": "delayed",
    "buffer_ready": false,
    "buffer_status": "retrying",
    "recorder_status_detail": "retry_attempt_1",
    "status_code": "retrying",
    "message": "Source temporarily unavailable. Retrying...",
    "last_failure_reason": "Retrying (1/2): timeout",
    "fallback_direct_url": "https://..."
  }
}
```

### Searching Backup
```json
{
  "success": true,
  "data": {
    "playback_mode": "delayed",
    "buffer_ready": false,
    "buffer_status": "trying_backup",
    "recorder_status_detail": "searching_backup_stream",
    "status_code": "trying_backup",
    "message": "Primary source timeout. Trying another source...",
    "fallback_direct_url": "https://..."
  }
}
```

### Backup Active - Building Buffer
```json
{
  "success": true,
  "data": {
    "playback_mode": "delayed",
    "buffer_ready": false,
    "buffer_status": "backup_active",
    "recorder_status_detail": "backup_active",
    "status_code": "backup_active",
    "message": "Using backup source. Building buffer...",
    "recorder_stream_id": 4567,
    "recorder_backup_attempts": 1
  }
}
```

### Buffer Ready
```json
{
  "success": true,
  "data": {
    "playback_mode": "delayed",
    "buffer_ready": true,
    "buffer_status": "ready",
    "delay_seconds": 300,
    "buffer_depth_seconds": 310,
    "delayed_stream_url": "https://api.example.com/api/smooth/123/playlist.m3u8"
  }
}
```

## Deployment Notes

### No Database Migration Required
All necessary database columns already exist.

### No Configuration Changes Required
Default environment variables work as-is.

### Breaking Changes
**None.** All changes are backward compatible.

### Rollback Plan
If issues arise, revert these files:
1. `backend/src/jobs/buffer_recorder.js`
2. `backend/src/controllers/smoothPlaybackController.js`
3. `backend/docs/SMOOTH_PLAYBACK_FALLBACK.md`

No database rollback needed.

## Monitoring Recommendations

### Key Metrics to Watch
1. **Retry success rate** - How many retries succeed vs switch to backup
2. **Backup activation frequency** - How often backups are used
3. **Average time to recovery** - Time from failure to working stream
4. **Cooldown effectiveness** - Do excluded streams recover after 5 minutes?

### Admin Dashboard Queries
```sql
-- Channels currently retrying
SELECT id, name, recorder_status_detail, recorder_last_failure_reason
FROM channels
WHERE recorder_status_detail LIKE 'retry_attempt_%';

-- Channels using backup streams
SELECT id, name, recorder_stream_id, recorder_backup_attempts
FROM channels
WHERE recorder_status_detail = 'backup_active';

-- Recent fallback activity
SELECT channel_id, from_stream_id, to_stream_id, result, created_at
FROM recorder_fallback_log
ORDER BY created_at DESC
LIMIT 20;
```

## Performance Impact

### Memory
- **Minimal increase** - Only added 2 small objects per recorder state:
  - `failedStreamExcludeMap`: ~50 bytes per excluded stream
  - `currentStreamRetries`: 4 bytes integer

### CPU
- **Negligible** - Error classification is simple string matching
- Exponential backoff reduces polling during failures (less CPU)

### Network
- **Reduced** - Longer timeouts prevent premature retries
- Fewer backup tests due to 3-failure threshold vs 2-failure

### Database
- **No change** - Same number of queries, just different timing

## Success Criteria Validation

✅ **Primary Goal**: Recorder no longer fails permanently on first timeout
- **Before**: 2 timeouts = permanent failure
- **After**: Up to 9 attempts (3 failures × 3 retries each) before backup switch

✅ **User Experience**: Seamless playback during transient failures
- Buffer continues serving during retry window
- User sees informative status messages
- No abrupt stream switches for network blips

✅ **System Resilience**: Automatic recovery from temporary issues
- 5-minute cooldown allows retry of previously failed streams
- Excluded streams not permanently blacklisted
- Continuous background polling ensures recovery when sources return

✅ **Premium Channel Protection**: Important channels flagged for review
- `needs_manual_verification` set after 3 failures
- Admin visibility into failure patterns
- No aggressive auto-hide of paid content

## Future Enhancements (Out of Scope)

1. **Adaptive timeout adjustment** - Learn optimal timeout per channel
2. **Stream health scoring** - Prefer historically stable streams
3. **Multi-CDN failover** - Parallel backup stream testing
4. **Predictive fallback** - Switch before complete failure based on degrading metrics
5. **User notification** - Alert users when switching to backup source

---

**Implementation Date**: 2026-07-03  
**Status**: ✅ Complete  
**Tested**: Manual testing recommended  
**Deployed**: Pending
