# NivaTV Smooth Playback — Skip Missing Chunks Without Freeze

## Context
Some channels are unstable. The source stream sometimes fails to provide HLS chunks. Currently, when a chunk is missing, playback may buffer, stop, or show stream error. We want the backend to create a smoother delayed playback playlist using available chunks, skipping the missing ones, and informing the user gracefully.

## Plan

### Phase 1: Database
- **Migration File:** `backend/migrations/032_smooth_playback_buffer.sql`
- Add gap_handling_mode, allow_skip_missing_segments, missing_segment_count, etc.
- Ensure idempotency (IF NOT EXISTS).

### Phase 2: Backend
- **File:** `backend/src/controllers/smoothPlaybackController.js`
- Implement `skip_missing_chunks` logic as the default.
- Update `servePlaylist` to filter out missing/broken segments.
- Ensure `#EXT-X-DISCONTINUITY` is added when skipping.
- Implement retry logic (2-3 times), backup stream, and lower-quality fallback.
- Calculate and expose `clean_buffer_percentage` and `buffer_quality_status`.

### Phase 3: API
- **File:** `backend/src/controllers/channelController.js`
- Update `getChannelPlayback` to include `gap_warning` flag.
- **File:** `backend/src/routes/channels.js`
- Ensure new fields are returned in the JSON response.

### Phase 4: Admin Dashboard
- **Files:** Frontend Admin pages (e.g., `frontend/src/app/(admin)/stream-health/page.tsx`)
- Add new columns for buffer health metrics.
- Add admin controls (restart recorder, switch backup, set mode).

### Phase 5: Mobile App (Flutter)
- **Files:** `mobile/lib/screens/player_screen.dart` or related cubit.
- Update video player logic to show `gap_warning` overlay.
- Implement the small dark overlay UI with auto-hide and cooldown.

## Verification
- Test Case 1 (Clean Source): 100% clean buffer, no overlay.
- Test Case 2 (One Missing): Retry, skip, overlay shown, playback continues.
- Test Case 4 (Too Many Missing): Smooth playback disabled/unavailable.