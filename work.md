 Why channels keep loading → playing → loading again
  Your app's "recovery" system is actually causing the loop. Here's the cycle:
  1. The player restarts itself too aggressively (main cause)
  - Any small error while buffering triggers the failure handler after just 3 seconds (mobile/lib/screens/player_screen.dart:1145-1183)
  - Every "recovery" does a full player re-open — which throws away everything already buffered and starts downloading from zero again
  - So: play a few seconds → tiny stall → app restarts stream → buffer from zero → stall → restart... forever

  2. The app forces HD (720p+) even on slow internet (player_screen.dart:1203-1216)
  - Every time you open a channel, it forces the highest quality track. If your internet can't keep up with HD bitrate, it stalls immediately — self-inflicted  buffering.

  3. The 8-second pause setting (player_screen.dart:1035-1036)
  - The player is configured to freeze for 8 full seconds every time the buffer runs dry (cache-pause-wait=8). On a borderline connection this creates the
  exact "play → freeze → play → freeze" rhythm you're seeing.

  4. Quality keeps bouncing up and down (player_screen.dart:1257-1297)
  - After downgrading quality, a timer tries to upgrade back to HD after 3 minutes → stalls again → downgrades → upgrades... each switch is a full restart.

  5. Backend delayed-stream can starve (backend/src/jobs/buffer_recorder.js:770-810)
  - One bad segment can block the recorder for minutes, so the playlist stops growing and the player runs out of video.

  Also: two of the "anti-stall" mpv options in your code (hls-segment-ahead, prefetch-playlist at player_screen.dart:1069-1076) do nothing — one isn't a real
  mpv property.

  How to fix it

  The key fixes, in priority order:

  1. Stop restarting on non-fatal errors — only re-init the player when playback is truly dead (e.g., stalled 15+ seconds with no data arriving), not on any
  error during buffering.
  2. Reduce cache-pause-wait from 8s → 2-3s — recover from underruns quickly instead of freezing 8 seconds.
  3. Don't force HD on open — start on auto/medium quality, upgrade only after playback has proven stable (e.g., 60s with no stalls), and lock quality after 2  downgrades instead of bouncing.
  4. Make silent retries use player.seek/reload without discarding buffer where possible, and increase retry spacing (1.5s → 5s).
  5. Backend: skip bad segments fast — cap per-segment retry time to ~10s total instead of minutes, so the playlist keeps advancing.

  Would you like me to implement these fixes now? I'd start with the mobile player fixes (#1–#4) since they're the main cause, then the backend recorder fix
  (#5).