# NivaTV Smooth Playback Fallback System

## Overview

The Smooth Playback Fallback System ensures that the 5-minute delayed buffer recorder can automatically recover from source timeouts by intelligently selecting backup streams. This prevents users from seeing immediate errors when a primary stream becomes unavailable.

## Key Features

### 1. **Intelligent Stream Selection**
When starting a recorder or switching to a backup, streams are prioritized by:
- Health status (stable/online streams first)
- Recent success timestamp
- Low failure count
- Android playability
- Successful segment tests
- Legal/licensed status
- Lower priority number (primary streams)
- Higher health score

### 2. **Smart Retry with Exponential Backoff**
When a stream times out or fails with a transient error:
- **First attempt**: Retry after 500ms
- **Second attempt**: Retry after 1.5s
- **Third attempt**: Retry after 3s
- Only after 3 retries does the system switch to backup stream

**Error Classification:**
- **Transient errors** (retry same stream): timeouts, connection resets, 5xx errors, "No segments"
- **Permanent errors** (switch immediately): 403 Forbidden, 404 Not Found, 410 Gone

### 3. **Stale Buffer Support**
When a source times out but a buffer already exists:
- Continue serving existing buffered segments (up to 90 seconds stale)
- Show "source timeout" status to admin
- Retry source in background with exponential backoff
- Switch to backup if source doesn't recover before buffer expires
- Mark channel unavailable only when all sources fail AND buffer runs out

### 4. **Automatic Fallback Cascade**
After retry attempts are exhausted:
1. Marks primary stream as failed with timestamp
2. Selects next best stream using intelligent priority
3. Tests backup stream with 8-second HEAD request
4. Switches recorder to backup if successful
5. Tries next backup if first backup fails
6. Falls back to channel.stream_url as final option
7. Slows polling to every 30s if all sources fail
8. Continues background retry indefinitely

### 5. **Stream Cooldown & Recovery**
- Excluded streams are tracked with timestamps
- After 5 minutes, excluded streams become eligible again
- On successful stream recovery, failed stream list is cleared
- Prevents permanently blacklisting temporarily unstable streams

### 6. **Premium Channel Protection**
For channels marked as `is_premium` or `is_important`:
- After 3 failures, sets `needs_manual_verification = true`
- Prevents auto-hide or aggressive fallback
- Flags for admin review

### 7. **Status Tracking**

#### Buffer Status Values
- `warming_up` - Building initial buffer
- `retrying` - Retrying failed source with backoff
- `ready` - Buffer ready, serving delayed stream
- `source_timeout` - Primary source failed, keeping buffer alive
- `trying_backup` - Actively searching for working backup
- `backup_active` - Successfully using backup stream
- `low_buffer` - Buffer below 50% of target depth
- `segment_missing` - Individual segment download failed
- `no_working_source` - All sources exhausted
- `stopped` - Recorder not running

#### Recorder Status Detail
Additional granular status for admin:
- `active` - Normal operation
- `retry_attempt_1`, `retry_attempt_2` - Retrying with backoff
- `searching_backup_stream` - Looking for fallback
- `backup_active` - Using backup
- `fallback_to_main_url` - Using channel.stream_url fallback
- `needs_manual_verification` - Premium channel needs review
- `no_working_source` - All sources failed

## Configuration

### Environment Variables
```bash
MAX_CONCURRENT_RECORDERS=5          # Max simultaneous recorders
BUFFER_STORAGE_PATH=/path/to/storage # Buffer storage location
```

### Timeouts
- M3U8 fetch: 18 seconds (increased from 12s for unstable networks)
- Segment fetch: 20 seconds (increased from 15s for unstable networks)
- Fallback stream test: 8 seconds (increased from 5s)
- Stale buffer window: 90 seconds
- Max stale buffer age: 300 seconds (5 minutes)
- Stream exclusion cooldown: 5 minutes

### Retry Strategy
- Max retries before fallback: 2 attempts
- Retry backoff: 500ms → 1500ms → 3000ms
- Failure threshold for fallback: 3 consecutive failures

### Polling Intervals
- Normal operation: 3 seconds
- No working source: 30 seconds

## Database Schema

### New Columns in `channels` Table
```sql
recorder_stream_url          varchar(2048)  -- Current stream URL being recorded
recorder_stream_id           integer        -- Current channel_streams.id being used
recorder_fail_count          integer        -- Consecutive failure count
recorder_last_success_at     timestamptz    -- Last successful poll
recorder_last_failure_at     timestamptz    -- Last failure timestamp
recorder_last_failure_reason text           -- Last error message
recorder_backup_attempts     integer        -- Total backup switches
recorder_stale_buffer_until  timestamptz    -- Stale buffer expiry time
recorder_status_detail       varchar(50)    -- Detailed status for admin
```

## User-Facing Status Messages

### App Playback States
- **"Preparing smooth playback..."** - Initial buffer warmup
- **"Source temporarily unavailable. Retrying..."** - Retrying with backoff
- **"Primary source timeout. Trying another source..."** - Searching for backup
- **"Using backup source. Building buffer..."** - Backup active, warming up
- **"Smooth Live · 5 min delay"** - Buffer ready, normal playback
- **"No stable source is available right now."** - All sources failed
- **"This channel requires manual verification."** - Premium channel flagged

## Recovery Behavior

### Short Timeout (< 90 seconds)
1. Existing buffer continues serving segments
2. Source retried with exponential backoff (3 attempts)
3. If retries fail, backup stream selected
4. Buffer transitions seamlessly to backup source
5. User sees brief "Retrying..." message

### Extended Timeout (> 90 seconds)
1. Buffer continues until stale window expires
2. System tries all available backups
3. If no backup works, falls back to main URL
4. If all sources fail, polling slowed to 30s
5. User sees "No stable source available"

### Recovery from All-Sources-Failed
1. Recorder continues polling every 30 seconds
2. Excluded streams become eligible after 5 minutes
3. When any source recovers, normal polling resumes
4. Failed stream list cleared on recovery
5. Buffer rebuilds from recovered source

### Fallback Log Table
```sql
CREATE TABLE recorder_fallback_log (
  id serial PRIMARY KEY,
  channel_id integer REFERENCES channels(id),
  from_stream_url text,
  from_stream_id integer,
  to_stream_url text,
  to_stream_id integer,
  result varchar(20),  -- 'success', 'failed', 'all_failed'
  notes text,
  created_at timestamptz DEFAULT NOW()
);
```

## API Endpoints

### Public API
- `GET /api/channels/:id/smooth-playback` - Get smooth playback info with status messages

### Admin API
- `GET /api/admin/smooth-playback/health` - System health summary
- `GET /api/admin/smooth-playback/channels` - List all channels with recorder info
- `PUT /api/admin/smooth-playback/channels/:id` - Update channel settings
- `POST /api/admin/smooth-playback/channels/:id/restart` - Restart recorder
- `GET /api/admin/smooth-playback/channels/:channelId/fallback-logs` - View fallback history
- `POST /api/admin/smooth-playback/channels/:id/clear-stale` - Force clear stale buffer

## User Experience

### Mobile App Messages

#### When buffer is ready:
```
🟢 Smooth Live · 5 min delay
```

#### When warming up:
```
⏳ Preparing smooth playback...
```

#### When primary source times out:
```
⚠️ Trying another source...
```

#### When using backup:
```
🔄 Using backup source...
```

#### When all sources fail:
```
❌ Stream unavailable
No stable source is available right now.
```

#### When DRM/geo-blocked:
```
🔒 This channel requires a licensed source and cannot be buffered.
```

## Admin Dashboard

### Recorder Info Column Shows:
- Current stream ID being recorded
- Consecutive failure count
- Number of backup attempts
- Last failure timestamp and reason

### Status Indicators:
- 🟢 Green pulse - Recorder actively running
- 🟡 Yellow - Warming up
- 🔵 Blue - Trying backup
- 🟦 Cyan - Backup active
- 🔴 Red - No working source
- ⚫ Gray - Stopped

## Operational Guidelines

### When to Enable Smooth Playback
✅ Enable for:
- Legal, public, or licensed streams
- Unstable live channels with buffering issues
- Channels where 5-minute delay is acceptable

❌ Do NOT enable for:
- DRM-protected content (`drm_or_unsupported`)
- Geo-blocked streams (`geo_blocked`)
- Unlicensed premium content (`requires_licensed_source`)
- 403 forbidden sources (`forbidden_403`)

### Monitoring
Check admin dashboard regularly for:
- Channels with `no_working_source` status
- High `recorder_fail_count`
- Multiple `recorder_backup_attempts`
- Channels marked `needs_manual_verification`

### Manual Intervention
For channels showing persistent issues:
1. Check fallback logs: `/api/admin/smooth-playback/channels/:id/fallback-logs`
2. Verify stream URLs in channel_streams table
3. Test stream URLs manually
4. Consider disabling smooth playback if no stable source exists
5. For premium channels, verify licensing status

## Implementation Details

### Stream Selection Query
```sql
SELECT id, stream_url, license_type, health_status, fail_count
FROM channel_streams
WHERE channel_id = $1
  AND is_hidden IS NOT TRUE
  AND id NOT IN (excluded_failed_ids)
ORDER BY
  CASE WHEN health_status IN ('stable', 'online') THEN 0 ELSE 1 END,
  last_success_at DESC NULLS LAST,
  fail_count ASC,
  android_playable DESC,
  segment_load_success_1 DESC,
  CASE WHEN license_type IN ('free', 'licensed', 'public') THEN 0 ELSE 1 END,
  priority ASC,
  health_score DESC NULLS LAST
LIMIT 1
```

### Fallback Trigger Logic
```javascript
if (failCount >= 2) {
  if (!staleBufferWindow || staleExpired || !hasBuffer) {
    // Immediately try fallback
    tryFallbackStream()
  } else {
    // Keep serving stale buffer while retrying
    continueBackgroundRetry()
  }
}
```

### Poll Interval Adjustment
```javascript
if (allSourcesFailed) {
  // Slow down to reduce server load
  pollInterval = 30000 // 30 seconds
} else {
  // Normal fast polling
  pollInterval = 3000 // 3 seconds
}
```

## Troubleshooting

### Issue: Channel stuck in "trying_backup"
**Cause:** All backup streams are failing tests  
**Solution:** Check fallback logs, verify stream URLs, disable smooth playback if no working source

### Issue: Buffer keeps timing out
**Cause:** Network issues or unstable source  
**Solution:** Increase timeout values, check network connectivity, try different streams

### Issue: Stale buffer served for too long
**Cause:** MAX_STALE_BUFFER_AGE_SEC too high  
**Solution:** Reduce to 180-240 seconds for fresher content

### Issue: Too many backup attempts
**Cause:** Streams failing in rotation  
**Solution:** Review channel_streams health status, remove dead streams, verify licensing

## Future Enhancements

- [ ] Predictive fallback based on time-of-day failure patterns
- [ ] Bandwidth-adaptive stream selection
- [ ] Multi-source redundancy (parallel recording)
- [ ] Smart cache warming for popular channels
- [ ] Automatic quality degradation on repeated failures
- [ ] Stream health scoring based on recorder performance
- [ ] Webhook notifications for critical recorder failures
