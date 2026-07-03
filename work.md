Fix NivaTV Smooth Playback when recorder source times out.

Current problem:

For some channels like Star Gold Select HD, smooth playback shows:

Response timeout while trying to fetch stream URL.

I added the 5-minute delayed playback feature because some streams are unstable. I do not want users to instantly see stream error if one source times out.

Important reality:

If the recorder cannot fetch any video from the source, it cannot create a 5-minute buffer.

So the system must not depend on only one stream URL.

Required behavior:

When smooth playback recorder fails on the primary stream:

1. Do not immediately show final error.
2. Mark that stream as timeout / unstable.
3. Retry the same stream with safe timeout.
4. Refresh the playback URL from backend.
5. Try backup stream 1.
6. Try backup stream 2.
7. Try lower quality stream if available.
8. Try proxy/restream mode if allowed.
9. If any stream works, start building delayed buffer from that working stream.
10. Only show error if all available streams fail.

For smooth playback, backend should choose the best working stream before starting recorder.

Recorder source selection priority:

- stable stream
- recently successful stream
- stream with low fail count
- Android playable stream
- stream with successful segment test
- legal/public/licensed stream
- backup stream
- lower quality stream

Do not always start recorder from the first stream URL.

Add recorder fallback system:

If primary stream timeout:

Show in admin:

Primary stream timeout. Trying backup source...

If backup works:

Use backup stream for smooth playback.

If all streams fail:

Show:

No working source available for smooth playback.

Do not crash recorder.

Do not keep retrying the same dead URL forever.

Add stale buffer support:

If the channel already has a previous delayed buffer and the source temporarily times out:

- keep serving existing buffered segments while they are still valid
- show playback as delayed
- continue retrying source in background
- if new segments cannot be fetched before buffer runs out, then switch backup stream
- if backup also fails, then show channel unavailable

Important:

Do not serve very old stale video as live forever.

Stale buffer should only be used for short recovery window.

Example:

If 5-minute buffer exists and source fails for 20 seconds, user should still watch buffered video.

If source fails for many minutes and no backup exists, buffer will run out and channel should be marked unstable.

Add admin status:

Recorder status should show:

- warming_up
- buffer_ready
- source_timeout
- trying_backup
- backup_active
- low_buffer
- buffer_empty
- no_working_source
- requires_licensed_source

Admin should see:

- current recorder stream URL
- failed stream URL
- backup stream used
- timeout reason
- buffer depth
- last successful segment time
- last failure time

For paid/popular channels:

Do not auto-hide.

Mark as:

needs_manual_verification

or

requires_licensed_source

If there is no stable legal/licensed source, do not keep showing broken stream to users.

App behavior:

If smooth playback is enabled but buffer is not ready:

Show:

Preparing smooth playback...

If primary stream fails and backup is being tried:

Show:

Trying another source...

If buffer is ready:

Show:

Smooth Live · 5 min delay

If all streams fail:

Show:

Stream unavailable
No stable source is available right now.

Acceptance criteria:

- recorder does not fail permanently after one timeout
- recorder tries backup streams
- recorder starts buffer from backup if backup works
- existing buffer continues playing during short source failure
- buffer depth is visible in admin
- dead source is marked timeout/unstable
- channel is not shown as smooth-ready until buffer exists
- paid/DRM/unlicensed channels are not bypassed
- important channels go to manual verification instead of auto-hide