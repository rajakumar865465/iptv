# Testing Guide: Smooth Playback Timeout Fix

## Quick Test Scenarios

### Test 1: Verify Retry Logic on Transient Timeout

**Objective:** Confirm that recorder retries with exponential backoff before switching to backup

**Steps:**
1. Find a channel with smooth playback enabled (e.g., Star Gold Select HD)
2. Monitor backend logs: `tail -f backend/logs/app.log | grep buffer_recorder`
3. If source has intermittent timeout issues, you should see:
   ```
   [buffer_recorder] Channel 123: Transient error, retry 1/2 after 500ms
   [buffer_recorder] Channel 123: Transient error, retry 2/2 after 1500ms
   ```
4. Check API response: `GET /api/channels/123/smooth-playback`
   ```json
   {
     "buffer_status": "retrying",
     "recorder_status_detail": "retry_attempt_1",
     "message": "Source temporarily unavailable. Retrying..."
   }
   ```

**Expected:** Recorder retries same stream 2-3 times before fail count increments

### Test 2: Verify Fallback After Retry Exhaustion

**Objective:** Confirm that backup streams are tried after retries fail

**Steps:**
1. Monitor logs for retry exhaustion:
   ```
   [buffer_recorder] Channel 123: Attempting fallback to backup stream...
   [buffer_recorder] Channel 123: Testing backup stream 456...
   [buffer_recorder] Channel 123: ✓ Backup stream 456 is working!
   ```
2. Check database:
   ```sql
   SELECT recorder_stream_id, recorder_backup_attempts, 
          recorder_status_detail, buffer_status
   FROM channels WHERE id = 123;
   ```
3. Verify API response shows backup active:
   ```json
   {
     "buffer_status": "backup_active",
     "message": "Using backup source. Building buffer...",
     "recorder_backup_attempts": 1
   }
   ```

**Expected:** Backup stream selected and recorder switches successfully

### Test 3: Verify Stream Cooldown Recovery

**Objective:** Confirm excluded streams become eligible after 5 minutes

**Steps:**
1. Wait for a channel to exclude a stream due to failures
2. Note the excluded stream ID from logs:
   ```
   [buffer_recorder] Channel 123: Trying fallback streams (excluded: 789)
   ```
3. Wait 5+ minutes
4. Check logs for cooldown expiry:
   ```
   [buffer_recorder] Channel 123: Stream recovered, clearing failed list
   ```
5. Verify previously excluded stream can be used again

**Expected:** Failed stream list cleared after cooldown, stream becomes eligible

### Test 4: Verify Admin Monitoring Metrics

**Objective:** Confirm admin endpoints show retry/backup statistics

**Steps:**
1. Call admin health endpoint:
   ```bash
   curl http://localhost:3001/api/internal/smooth-playback/health \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```
2. Verify response includes new metrics:
   ```json
   {
     "retrying_count": 2,
     "searching_backup_count": 1,
     "backup_active_count": 3,
     "needs_verification_count": 0,
     "total_backup_switches": 12
   }
   ```

**Expected:** New retry and backup metrics visible

### Test 5: Verify Permanent Error Immediate Switch

**Objective:** Confirm 404/403 errors don't waste time retrying

**Steps:**
1. Find a stream that returns HTTP 403 or 404
2. Monitor logs for error classification:
   ```
   [buffer_recorder] Poll error channel 123 (permanent): HTTP 403
   ```
3. Verify NO retry attempts in logs
4. Confirm immediate fail count increment and backup search

**Expected:** Permanent errors skip retry logic, immediately try backup

### Test 6: Verify Stale Buffer Behavior

**Objective:** Confirm existing buffer continues serving during source failure

**Steps:**
1. Start channel with working buffer (buffer_depth_seconds > 60)
2. Cause source to timeout (disconnect network temporarily)
3. Check that:
   - App continues playing buffered segments
   - `recorder_stale_buffer_until` is set (90 seconds from now)
   - Status shows "source_timeout" but buffer still serving
4. Reconnect network within 90 seconds
5. Verify recorder recovers without user interruption

**Expected:** Buffer continues serving, transparent retry in background

## Manual Testing Commands

### Check Recorder State
```sql
SELECT 
  id, 
  name,
  buffer_status,
  recorder_status_detail,
  recorder_fail_count,
  recorder_stream_id,
  recorder_backup_attempts,
  recorder_last_failure_reason,
  buffer_depth_seconds,
  is_buffer_ready
FROM channels 
WHERE smooth_playback_enabled = true
ORDER BY recorder_last_failure_at DESC NULLS LAST
LIMIT 20;
```

### Check Fallback History
```sql
SELECT 
  rfl.channel_id,
  c.name,
  rfl.from_stream_id,
  rfl.to_stream_id,
  rfl.result,
  rfl.notes,
  rfl.created_at
FROM recorder_fallback_log rfl
JOIN channels c ON c.id = rfl.channel_id
ORDER BY rfl.created_at DESC
LIMIT 20;
```

### Check Active Recorders
```bash
curl http://localhost:3001/api/internal/smooth-playback/health \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq
```

### Restart Problem Channel
```bash
curl -X POST http://localhost:3001/api/internal/smooth-playback/channels/123/restart \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

## Simulating Failures (Development Only)

### Simulate Transient Timeout
```javascript
// In buffer_recorder.js _pollChannel() - add before fetch:
if (Math.random() < 0.3) {
  throw new Error('ETIMEDOUT: Simulated timeout');
}
```

### Simulate Permanent Error
```javascript
// In buffer_recorder.js _pollChannel() - add after fetch:
if (response.ok && Math.random() < 0.2) {
  throw new Error('HTTP 403: Simulated forbidden');
}
```

### Force All Streams to Fail
```sql
-- Temporarily hide all streams for a channel
UPDATE channel_streams 
SET is_hidden = true 
WHERE channel_id = 123;

-- Watch recorder behavior
-- Restore streams after test:
UPDATE channel_streams 
SET is_hidden = false 
WHERE channel_id = 123;
```

## Success Indicators

### Healthy Recorder Behavior
✅ Retries visible in logs before fallback  
✅ Exponential backoff timing (500ms → 1.5s → 3s)  
✅ Backup streams tested and activated  
✅ Buffer continues during retry window  
✅ Failed streams cleared on recovery  
✅ Admin metrics show retry/backup counts  

### Problem Indicators
❌ Immediate fallback without retry  
❌ Constant retry without backoff  
❌ Excluded streams never retried  
❌ Buffer drops during transient failure  
❌ Permanent errors being retried  
❌ Admin metrics stuck at 0  

## Log Patterns to Watch

### Good Pattern (Transient Error Recovery)
```
[buffer_recorder] Poll error channel 123 (transient): timeout
[buffer_recorder] Channel 123: Transient error, retry 1/2 after 500ms
[buffer_recorder] Poll error channel 123 (transient): timeout
[buffer_recorder] Channel 123: Transient error, retry 2/2 after 1500ms
[buffer_recorder] Channel 123: Poll successful, stream recovered
[buffer_recorder] Channel 123: Stream recovered, clearing failed list
```

### Good Pattern (Successful Fallback)
```
[buffer_recorder] Poll error channel 123 (transient): timeout
[buffer_recorder] Channel 123: Attempting fallback to backup stream...
[buffer_recorder] Channel 123: Trying fallback streams (excluded: 789)
[buffer_recorder] Channel 123: Testing backup stream 456...
[buffer_recorder] Channel 123: ✓ Backup stream 456 is working! Switched successfully.
```

### Bad Pattern (Stuck Recorder)
```
[buffer_recorder] Poll error channel 123 (transient): timeout
[buffer_recorder] Poll error channel 123 (transient): timeout
[buffer_recorder] Poll error channel 123 (transient): timeout
(No retry attempts visible - BUG)
```

## Performance Benchmarks

### Expected Timing
- **Single retry cycle**: ~5 seconds (500ms + 1500ms + 3000ms)
- **3 retry cycles to fallback**: ~15 seconds
- **Backup stream test**: ~8 seconds
- **Total time to backup active**: ~25-30 seconds (worst case)

### Acceptable Ranges
- Retry backoff timing: ±200ms variance acceptable
- Backup test timeout: 5-10 seconds
- Cooldown expiry: 5 minutes ±10 seconds

## Known Limitations

1. **Manual verification channels**: Premium channels still require admin review after failures
2. **DRM/Geo-blocked channels**: Cannot be buffered, will never show as ready
3. **Network isolation**: If ALL upstream sources are down, system cannot recover until at least one returns
4. **Cooldown race**: If stream fails just before 5-minute cooldown expires, may retry immediately

## Rollback Procedure

If critical issues found in production:

1. Stop backend: `pm2 stop backend`
2. Revert files:
   ```bash
   git checkout HEAD~1 -- backend/src/jobs/buffer_recorder.js
   git checkout HEAD~1 -- backend/src/controllers/smoothPlaybackController.js
   ```
3. Restart backend: `pm2 restart backend`
4. Monitor logs: `pm2 logs backend`

No database changes required for rollback.

---

**Test Duration Estimate**: 30-45 minutes for all scenarios  
**Required Access**: Admin API access, database read access, log access  
**Risk Level**: Low (backward compatible changes)
