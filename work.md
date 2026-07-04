# NivaTV Smooth Playback — Skip Missing Chunks Without Freeze

## Main Goal

Update the NivaTV Smooth Playback / 5-minute delayed live playback system so unstable channels can continue playing even when some HLS chunks are unavailable.

The app should not freeze, should not buffer endlessly, and should not make users think the app is broken.

When a channel source is unstable and one or more chunks are missing, the backend should skip the unavailable chunks and continue with the next available video chunks.

The user should clearly understand that the issue is from the channel/source signal, not from the NivaTV app.

---

## Current Problem

Some channels are unstable. The source stream sometimes fails to provide HLS chunks.

Example:

```txt
Good chunks:
1 2 3 4 5 6 7 8 9 10

Unstable source:
1 2 3 missing 5 6 missing 8 9 10
```

Currently, when a chunk is missing, playback may buffer, stop, or show stream error.

I do not want this behavior.

I want the backend to create a smoother delayed playback playlist using available chunks.

Expected smooth playlist:

```txt
1 2 3 5 6 8 9 10
```

The missing parts should be skipped.

The user may see a small jump forward, but playback should continue instead of buffering forever.

---

## Very Important Rule

Do not use freeze-frame fallback.

Do not freeze the last frame.

Freezing makes users think the app is stuck or broken.

Do not show a long black screen either.

The default behavior must be:

```txt
Skip unavailable chunks and continue playback.
```

---

## Required Behavior

When a chunk is missing:

1. Retry the missing chunk.
2. Refresh the source playlist.
3. Try the final redirected URL if available.
4. Try required headers, referer, user-agent, and origin.
5. Try backup stream if available.
6. Try lower-quality stream if available.
7. If the chunk still cannot be recovered, mark it as missing.
8. Do not include that missing chunk in the delayed playlist.
9. Skip it and continue with the next available chunk.
10. Show a small message to the user explaining that the channel source is unstable.

Do not stop the full recorder because of one missing chunk.

Do not show stream error for one missing chunk.

Do not include broken segment URLs in the HLS playlist.

---

## User-Facing Message

When chunks are skipped, show a small overlay inside the player.

Message option 1:

```txt
Channel source is unstable
Skipping unavailable part...
```

Message option 2:

```txt
This channel signal is unstable
Continuing playback...
```

Message option 3:

```txt
Channel stream is unstable
Playback may skip slightly.
```

Use message option 1 as default.

Overlay behavior:

* Small dark overlay inside the player.
* Auto-hide after 3–5 seconds.
* Do not block the video.
* Do not cover player controls permanently.
* Do not show every second.
* Cooldown: show maximum once every 30–60 seconds.
* Do not use a full error screen unless the stream fully fails.
* The message should clearly explain this is a source/channel issue, not an app issue.

---

## App Message Rules

### If one or few chunks are skipped

Show:

```txt
Channel source is unstable. Continuing playback...
```

Playback should continue.

### If many chunks are missing

Show:

```txt
This channel is unstable right now.
```

Continue only if enough chunks are available.

### If no chunks are available

Show final error:

```txt
Stream unavailable
No stable source is available right now.
```

### If backup source is being used

Show:

```txt
Trying another source...
```

### If backend is repairing / retrying

Show:

```txt
Optimizing stream...
```

---

## Backend Gap Handling Modes

Add per-channel gap handling mode.

Supported modes:

```txt
skip_missing_chunks
black_filler
strict_stop
```

Do not make freeze mode default.

Default mode:

```txt
skip_missing_chunks
```

### skip_missing_chunks

If a segment is missing and cannot be recovered, skip it and continue with next available segment.

This is the default.

### black_filler

Optional only. Insert a very short black/silent segment when a chunk is missing.

Do not use by default.

### strict_stop

Stop delayed playback when any chunk is missing.

Use only for testing or special channels.

---

## Removed / Disabled Behavior

Do not use this as default:

```txt
freeze_last_frame
```

Reason:

A frozen screen looks like the app is stuck.

If freeze mode exists in code, it should be disabled by default and not selected automatically.

---

## HLS Playlist Rules

The generated delayed playlist must always be valid HLS.

Playlist must include:

```txt
#EXTM3U
#EXT-X-TARGETDURATION
#EXT-X-MEDIA-SEQUENCE
```

Playlist must not include:

```txt
#EXT-X-PLAYLIST-TYPE:EVENT
```

Because this is rolling live delayed playback, not a DVR/event recording.

Important playlist rules:

* Never include missing segment URLs.
* Never include broken segment URLs.
* Never include segment files that do not exist.
* Keep segment order valid.
* Keep media sequence correct.
* Keep target duration correct.
* If skipping creates timeline jump, handle it safely.
* If discontinuity is needed, add correct discontinuity marker.
* Old segments should be cleaned automatically.
* Playlist should remain a live sliding window.

---

## Chunk Recording Logic

The recorder should continuously record available HLS segments.

For every segment:

1. Detect segment URL from playlist.
2. Check if segment was already downloaded.
3. Download segment.
4. Verify segment file exists.
5. Verify segment has valid size.
6. Verify segment is not HTML/error response.
7. Save valid segment.
8. Update buffer depth.
9. If download fails, mark segment as missing and retry.

Segment retry rules:

* Retry missing segment 2–3 times.
* Refresh source playlist before retry.
* Try final URL if available.
* Try headers if needed.
* Try backup source if available.
* Try lower quality source if available.
* After retry limit, skip the segment and continue.

Do not retry one dead segment forever.

---

## Source Timeout Behavior

If source timeout happens:

1. Mark current segment as timeout.
2. Increment timeout count.
3. Retry same segment.
4. Refresh playlist.
5. If timeout continues, try backup stream.
6. If backup stream works, continue recording from backup.
7. If no backup works, keep recording any future available segments from original source.
8. If too many segments are missing, mark channel unstable.

Do not crash recorder.

Do not stop the whole channel because of one timeout.

---

## Backup Stream Behavior

If backup stream exists, use it for chunk repair.

When primary stream misses a segment:

1. Try to recover same time window from backup stream.
2. If backup provides a valid segment, save it.
3. Mark that segment as recovered from backup.
4. Continue playback.
5. Show admin that backup was used.

If backup becomes more stable than primary, admin should be able to promote it as primary.

Auto-promote only if safe and enabled.

---

## Lower Quality Repair

If lower quality stream exists, allow using it to repair missing chunks.

Example:

Primary 1080p segment missing.
Backup 720p or 480p segment exists.
Use lower quality segment for that moment instead of buffering.

User may notice slight quality change, but playback continues.

This should be allowed only when the streams are compatible enough for HLS playback.

If discontinuity is needed, add it safely.

---

## Buffer Quality Status

Add buffer quality status for each smooth playback channel:

```txt
clean_buffer
minor_gaps
gap_repaired
skipping_missing_segments
using_backup_segments
using_lower_quality_segments
too_many_missing_segments
source_timeout
source_dead
backup_active
no_working_source
```

Meaning:

### clean_buffer

All expected chunks downloaded successfully.

### minor_gaps

Small number of chunks missing, but playback is still acceptable.

### gap_repaired

Missing chunks were recovered using backup/lower-quality source.

### skipping_missing_segments

Some unavailable chunks were skipped.

### using_backup_segments

Backup stream is being used for some segments.

### using_lower_quality_segments

Lower quality segments are being used for some missing parts.

### too_many_missing_segments

Too many chunks are missing; playback may be poor.

### source_timeout

Current source is timing out.

### source_dead

Source is not giving video.

### backup_active

Recorder switched to backup stream.

### no_working_source

No valid chunks are available from any stream.

---

## Clean Buffer Percentage

Add clean buffer percentage.

Formula idea:

```txt
clean_buffer_percentage = downloaded_good_segments / expected_segments * 100
```

Example:

```txt
100% = perfect buffer
90% = minor gaps, still good
70% = playable but visible skips
60% = unstable
below 40% = do not serve smooth playback
```

Rules:

* If clean buffer percentage is high, serve smooth playback.
* If clean buffer percentage is medium, serve with warning.
* If clean buffer percentage is too low, do not serve smooth playback.
* If no working source exists, show unavailable.

Recommended thresholds:

```txt
Serve smooth playback normally: 85%+
Serve with source unstable warning: 65% to 84%
Do not serve smooth playback: below 60%
```

---

## Admin Dashboard Requirements

Update Smooth Playback / Buffer Health admin page.

Admin should see:

* channel name
* current recorder status
* active stream source
* primary stream URL
* backup stream URL
* buffer depth seconds
* clean buffer percentage
* total expected segments
* downloaded segments
* missing segments
* skipped segments
* recovered segments
* backup segments used
* lower-quality segments used
* timeout count
* last missing segment time
* last successful segment time
* last source error
* current gap handling mode
* health status
* needs manual verification

Admin statuses:

```txt
buffer_ready
warming_up
clean_buffer
minor_gaps
skipping_missing_segments
trying_backup
backup_active
low_buffer
too_many_missing_segments
source_timeout
source_dead
no_working_source
requires_licensed_source
needs_manual_verification
```

Admin actions:

* restart recorder
* recheck stream
* test segment download
* switch to backup source
* promote backup as primary
* mark stream unstable
* mark stream working
* mark requires licensed source
* set gap handling mode
* enable/disable skip missing chunks
* set clean buffer threshold
* hide stream
* hide channel
* add admin note

---

## Database Fields Needed

Add fields only if they do not already exist.

Suggested fields:

```txt
gap_handling_mode
allow_skip_missing_segments
max_missing_segments_allowed
min_clean_buffer_percentage
missing_segment_count
skipped_segment_count
recovered_segment_count
backup_segment_count
lower_quality_segment_count
clean_buffer_percentage
last_missing_segment_at
last_successful_segment_at
buffer_quality_status
active_recorder_stream_id
backup_active
last_source_error
```

Store per-channel or per-smooth-playback buffer record depending on current schema.

Use migrations.

Migrations must be idempotent.

Do not duplicate columns.

---

## App Player Requirements

The Flutter app should understand smooth playback buffer quality.

Playback API should return:

```txt
playback_mode
smooth_playback_enabled
delay_seconds
smooth_stream_url
buffer_ready
buffer_depth_seconds
buffer_quality_status
clean_buffer_percentage
skipped_segment_count
gap_warning
direct_live_url
can_go_live
```

If `gap_warning = true`, app shows a small overlay.

Overlay text:

```txt
Channel source is unstable
Continuing playback...
```

or

```txt
Channel source is unstable
Skipping unavailable part...
```

Do not show full error unless `no_working_source`.

Do not freeze the video.

Do not show infinite spinner for skipped chunks.

---

## Go Live Behavior

Go Live should still work.

Rules:

* Show Go Live only when delayed playback is active.
* Show Go Live only if direct live URL exists.
* Do not show Go Live for blocked/DRM/geo/requires_licensed_source channels.
* If user taps Go Live, switch to direct live.
* If direct live buffers, allow returning to Smooth Live.

---

## User Experience Goal

The user should feel:

```txt
The channel signal is unstable, but NivaTV is continuing playback.
```

The user should not feel:

```txt
The app is frozen.
The app is broken.
The app is loading forever.
```

So:

* no freeze
* no endless spinner
* no scary full error for small gaps
* skip bad chunks
* continue playback
* show clear small message

---

## Important Limitations

Do not make false promise of perfect video.

If the source gives no video for a long time and no backup exists, the backend cannot create real missing content.

In that case:

* mark no_working_source
* show stream unavailable
* require working backup or licensed source
* send important channel to manual verification

For Star / Zee / Sony / paid-style channels:

* do not auto-hide
* mark needs_manual_verification
* if source is not legal/licensed or is DRM/geo-blocked, mark requires_licensed_source
* do not bypass DRM or geo-blocking

---

## Testing Plan

Test with controlled segment failures.

Test cases:

### Case 1: Clean source

Expected:

* clean_buffer_percentage = 100%
* smooth playback works
* no warning overlay

### Case 2: One missing segment

Expected:

* segment retried
* if still missing, skipped
* playback continues
* small unstable-source overlay shown
* no full error

### Case 3: Several missing segments

Expected:

* missing count increases
* skipped count increases
* clean percentage decreases
* app still plays if above threshold
* admin shows minor_gaps or skipping_missing_segments

### Case 4: Too many missing segments

Expected:

* smooth playback disabled or warning shown
* channel marked unstable
* app shows stream unstable or unavailable
* admin shows too_many_missing_segments

### Case 5: Backup stream works

Expected:

* missing primary segment recovered from backup
* backup_segment_count increases
* playback continues
* admin shows backup_active or gap_repaired

### Case 6: Source dead

Expected:

* no_working_source
* app shows Stream unavailable
* recorder does not crash
* admin shows source_dead / no_working_source

### Case 7: DRM/licensed blocked channel

Expected:

* recorder does not start
* no buffer built
* status requires_licensed_source
* app does not bypass protection

---

## Acceptance Criteria

This feature is complete when:

* missing chunk does not cause endless buffering
* missing chunk does not freeze the video
* missing chunk is skipped if it cannot be recovered
* playback continues from next good chunk
* playlist never includes missing/broken segment URLs
* app shows small message explaining channel source instability
* admin shows missing/skipped/recovered segment counts
* clean buffer percentage is calculated
* too many missing chunks marks stream unstable
* backup stream can repair missing chunks
* lower quality can repair missing chunks when possible
* no_working_source is shown when no chunks are available
* DRM/geo/unauthorized channels are not bypassed
* user understands issue is channel source, not app problem

---

## Final Desired Result

NivaTV Smooth Playback should become more professional.

If a channel misses a few chunks, users should still watch smoothly with small jumps instead of buffering.

If the channel source is unstable, the app should clearly say:

```txt
Channel source is unstable
Continuing playback...
```

If the channel has no working source, the app should honestly show:

```txt
Stream unavailable
No stable source available right now.
```

Do not freeze the screen.

Do not buffer forever.

Skip unavailable chunks and continue playback whenever possible.
