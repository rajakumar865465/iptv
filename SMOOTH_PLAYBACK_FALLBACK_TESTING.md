# Smooth Playback Fallback System - Testing Guide

## Implementation Summary

Fixed NivaTV smooth playback to handle recorder source timeouts gracefully with automatic fallback system.

## Changes Made

### 1. Backend Recorder (`buffer_recorder.js`)
- ✅ Enhanced `_selectBestStream()` with intelligent priority and exclusion list
- ✅ Added stale buffer support (90s window)
- ✅ Implemented automatic fallback cascade after 2 failures
- ✅ Added poll interval adjustment (3s normal, 30s when no source)
- ✅ Improved timeout handling with AbortController
- ✅ Track failed streams to prevent retry loops
- ✅ Premium channel protection with manual verification flag
- ✅ Fallback logging to `recorder_fallback_log` table

### 2. Database Schema (`038_recorder_fallback_system.sql`)
- ✅ Added recorder state columns to `channels` table
- ✅ Created `recorder_fallback_log` table
- ✅ Added indexes for fallback stream selection

### 3. API Controllers (`smoothPlaybackController.js`)
- ✅ Enhanced status messages based on buffer state
- ✅ Added fallback log retrieval endpoint
- ✅ Added clear stale buffer endpoint
- ✅ Return detailed recorder info in admin API

### 4. Admin Dashboard (`smooth-playback/page.tsx`)
- ✅ Added "Recorder Info" column showing:
  - Current stream ID
  - Failure count
  - Backup attempts
  - Last failure time and reason
- ✅ Added new status filters and colors
- ✅ Enhanced status badges for all fallback states

### 5. Mobile App (`player_screen.dart`)
- ✅ Show contextual status messages:
  - "Trying another source..." during fallback
  - "Using backup source..." when backup active
  - "No stable source is available right now." when all fail
- ✅ Handle `requires_licensed_source` mode

### 6. API Routes (`admin.js`)
- ✅ Added `/smooth-playback/channels/:channelId/fallback-logs`
- ✅ Added `/smooth-playback/channels/:id/clear-stale`

## Testing Checklist

### Test 1: Normal Operation
- [ ] Enable smooth playback on a stable channel
- [ ] Verify buffer builds to 5 minutes
- [ ] Verify status shows "ready" in admin
- [ ] Verify mobile app shows "Smooth Live · 5 min delay"
- [ ] Verify segments are downloaded every 3 seconds

### Test 2: Primary Stream Timeout
- [ ] Enable smooth playback on Star Gold Select HD (or similar channel)
- [ ] Wait for primary stream to timeout
- [ ] Verify admin shows "source_timeout" status
- [ ] Verify admin shows "Primary stream timeout. Trying backup source..."
- [ ] Verify recorder switches to backup stream (check recorder_stream_id change)
- [ ] Verify mobile app shows "Trying another source..."
- [ ] Verify existing buffer continues playing during transition

### Test 3: Successful Fallback
- [ ] After timeout, verify backup stream is tested
- [ ] Verify status changes to "backup_active"
- [ ] Verify `recorder_backup_attempts` increments
- [ ] Verify fallback logged in `recorder_fallback_log` table
- [ ] Verify buffer continues building from backup stream
- [ ] Verify fail count resets to 0
- [ ] Verify poll interval returns to 3 seconds

### Test 4: All Sources Failed
- [ ] Enable smooth playback on channel with no working streams
- [ ] Verify status changes to "no_working_source"
- [ ] Verify poll interval slows to 30 seconds
- [ ] Verify admin shows appropriate error message
- [ ] Verify mobile app shows "No stable source is available right now."
- [ ] Verify recorder doesn't crash or stop trying

### Test 5: Stale Buffer Window
- [ ] Start recorder with working stream, let buffer build to 5 minutes
- [ ] Simulate primary stream failure (temporarily block URL)
- [ ] Verify existing buffer continues playing
- [ ] Verify admin shows "source_timeout" with stale buffer info
- [ ] Verify `recorder_stale_buffer_until` is set
- [ ] Wait for 90 seconds
- [ ] Verify fallback triggered after stale window expires
- [ ] Verify buffer doesn't serve content older than 5 minutes

### Test 6: Premium Channel Protection
- [ ] Enable smooth playback on premium/important channel
- [ ] Simulate source failure
- [ ] Verify `needs_manual_verification` flag is set after 2 failures
- [ ] Verify status shows "needs_manual_verification"
- [ ] Verify channel is not auto-hidden

### Test 7: Recorder Restart
- [ ] Enable smooth playback on channel
- [ ] Click "Restart" in admin dashboard
- [ ] Verify recorder stops gracefully
- [ ] Verify recorder restarts after 500ms
- [ ] Verify buffer rebuilds from scratch
- [ ] Verify no segment gaps or errors

### Test 8: Multiple Backup Streams
- [ ] Create channel with 3+ streams in `channel_streams` table
- [ ] Enable smooth playback
- [ ] Mark first stream as failing
- [ ] Verify recorder tries streams in priority order
- [ ] Verify failed streams are excluded from retry
- [ ] Verify fallback log shows all attempts

### Test 9: DRM/Geo-blocked Channels
- [ ] Try to enable smooth playback on channel with status "requires_licensed_source"
- [ ] Verify API returns 400 error
- [ ] Verify mobile app shows licensing message
- [ ] Verify recorder never starts for blocked statuses

### Test 10: Clear Stale Buffer
- [ ] Create channel with stale buffer state
- [ ] Call `POST /api/admin/smooth-playback/channels/:id/clear-stale`
- [ ] Verify `recorder_stale_buffer_until` is cleared
- [ ] Verify fail count resets
- [ ] Verify buffer status updates appropriately

### Test 11: Fallback Logs
- [ ] Enable smooth playback on unstable channel
- [ ] Wait for multiple fallback attempts
- [ ] Call `GET /api/admin/smooth-playback/channels/:id/fallback-logs`
- [ ] Verify log entries show:
  - from_stream_id and to_stream_id
  - result (success/failed/all_failed)
  - timestamps
  - notes

### Test 12: Concurrent Recorders
- [ ] Enable smooth playback on 6 channels (more than MAX_CONCURRENT=5)
- [ ] Verify only 5 recorders start
- [ ] Verify 6th channel shows warning in logs
- [ ] Stop one recorder
- [ ] Verify 6th channel can now start

## Performance Validation

### Metrics to Monitor
- [ ] CPU usage remains reasonable (<50% per recorder)
- [ ] Memory usage stable (no leaks)
- [ ] Disk I/O within limits
- [ ] Network bandwidth acceptable
- [ ] Segment cleanup working (old segments deleted)

### Expected Behavior
- Normal poll: 3 seconds between M3U8 fetches
- Segment download: <15 seconds per segment
- Fallback test: <5 seconds per candidate
- Buffer depth: Reaches configured delay (e.g., 300s)
- Cleanup: Old segments removed every 2 minutes

## Database Queries for Verification

### Check recorder state:
```sql
SELECT id, name, 
       recorder_stream_id, recorder_fail_count, 
       recorder_backup_attempts, recorder_status_detail,
       buffer_status, buffer_depth_seconds, is_buffer_ready
FROM channels 
WHERE smooth_playback_enabled = true;
```

### Check fallback logs:
```sql
SELECT * FROM recorder_fallback_log 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check active buffers:
```sql
SELECT channel_id, COUNT(*) as segments, 
       SUM(duration)::int as total_seconds
FROM delayed_buffer_segments 
GROUP BY channel_id;
```

## Known Limitations

1. **Stale buffer is temporary**: After 5 minutes, buffer expires even if source recovers
2. **No parallel recording**: Only one stream recorded at a time per channel
3. **Fallback is sequential**: Tests one backup at a time, not in parallel
4. **No CDN caching**: Segments stored locally, not distributed
5. **Premium channels require manual review**: Auto-fallback disabled for important content

## Rollback Plan

If issues occur:

1. **Disable smooth playback globally:**
```sql
UPDATE channels SET smooth_playback_enabled = false;
```

2. **Stop all recorders:**
```bash
# Restart backend server
pm2 restart nivatv-backend
```

3. **Revert migration 038:**
```sql
DROP TABLE IF EXISTS recorder_fallback_log;
ALTER TABLE channels 
  DROP COLUMN IF EXISTS recorder_stream_url,
  DROP COLUMN IF EXISTS recorder_stream_id,
  DROP COLUMN IF EXISTS recorder_fail_count,
  DROP COLUMN IF EXISTS recorder_last_success_at,
  DROP COLUMN IF EXISTS recorder_last_failure_at,
  DROP COLUMN IF EXISTS recorder_last_failure_reason,
  DROP COLUMN IF EXISTS recorder_session_segments,
  DROP COLUMN IF EXISTS recorder_backup_attempts,
  DROP COLUMN IF EXISTS recorder_stale_buffer_until,
  DROP COLUMN IF EXISTS recorder_status_detail;
```

4. **Restore previous `buffer_recorder.js`** from git history

## Success Criteria

✅ Recorder does not fail permanently after one timeout  
✅ Recorder tries backup streams automatically  
✅ Recorder starts buffer from backup if it works  
✅ Existing buffer continues playing during short source failure  
✅ Buffer depth visible in admin dashboard  
✅ Dead source marked as timeout/unstable  
✅ Channel not shown as smooth-ready until buffer exists  
✅ DRM/paid/unlicensed channels are not bypassed  
✅ Important channels go to manual verification instead of auto-hide  

## Contact

For issues or questions:
- Check logs: `/var/log/nivatv/backend.log`
- Review fallback logs in database
- Check admin dashboard recorder info column
- Monitor system metrics (CPU, memory, disk)
