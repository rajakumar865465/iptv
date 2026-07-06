# Investigate NivaTV Issue — All Channels Showing Reconnecting / Black Player / No Channel Works

## Current Problem

In the Android app, every channel is failing to play.

From the screenshots:

* Player area is black.
* Some channels show “Reconnecting...”.
* Some channels show blank black player without video.
* Channel metadata loads correctly.
* Channel logo, name, category, quality, Now Playing, and More Live Channels are visible.
* This means the app can load channel data from backend, but playback itself is failing.
* The issue is affecting all channels, not only one channel.

This looks like a global playback/backend/proxy/config issue, not an individual stream issue.

Examples from screenshots:

* DD Kisan shows Reconnecting.
* Aastha Kannada shows Reconnecting.
* Aaj Tak HD shows black player and no playback.
* Related/more channels load, so the channel list API is working.

---

# Main Goal

Find the exact reason why all channels are not playing and fix it.

Do not guess.

Investigate step by step:

1. Backend URL used by APK.
2. Playback API response.
3. Smooth playback API response.
4. Proxy URL response.
5. Direct stream URL response.
6. Auth/license/device checks.
7. media_kit player errors.
8. EC2 vs Render backend mismatch.
9. HTTP/HTTPS/cleartext issue.
10. Backend generated URLs.
11. Smooth playback state.
12. Player reconnect loop.

---

# Important Context

We recently moved backend from Render to EC2.

Make sure the app is not still using the old Render backend.

Search and remove old Render references from:

* Flutter mobile app
* frontend admin
* public website
* backend env
* database app settings
* generated proxy URLs
* generated smooth playback URLs
* CORS config
* API service files

Search terms:

```txt
onrender.com
render.com
localhost
127.0.0.1
old backend URL
```

The app must use the EC2 backend only.

---

# First Priority: Confirm APK Backend URL

Check how the APK was built.

The app must be built with:

```txt
--dart-define=BACKEND_URL=<EC2_BACKEND_URL>
```

If BACKEND_URL is missing or wrong, rebuild APK.

For local phone testing, do not use localhost.

Wrong:

```txt
http://localhost:5000
http://127.0.0.1:5000
old Render URL
```

Correct example:

```txt
https://api.nivatv.com
```

or temporary EC2 test:

```txt
http://EC2_PUBLIC_IP:5000
```

If using HTTP on Android, confirm cleartext is allowed or use HTTPS.

---

# Add Debug Logs in Flutter Player

Add temporary debug logs in PlayerScreen and API service.

Log these values when opening any channel:

```txt
BACKEND_URL
channel_id
channel_name
playback API URL
smooth playback API URL
playback_mode
selected_stream_url
smooth_stream_url
direct_live_url
proxy_url
headers
buffer_ready
buffer_depth_seconds
recorder_status
player_error
retry_count
is_playing
is_buffering
```

Important:

Do not log sensitive tokens in production logs.

For debugging, hide token values.

---

# Backend API Checks

For each failing channel, test these APIs manually:

```txt
GET /api/channels/:id/playback
GET /api/channels/:id/smooth-playback
```

Check if response contains valid playable URL.

For playback API, confirm:

```txt
primary_stream exists
primary_stream.url exists
primary_stream.headers exists if needed
backup_streams returned if available
proxy_url returned only if allowed
health_status is not blocked
```

For smooth playback API, confirm:

```txt
playback_mode
buffer_ready
smooth_stream_url
direct_live_url
buffer_depth_seconds
recorder_status
message
```

If playback API returns no stream URL, the app cannot play.

If playback API returns old Render URL, fix backend base URL generation.

If playback API returns localhost, fix backend host/proxy config.

If smooth playback returns warming forever, app should temporarily play direct_live_url.

---

# Check EC2 Backend Generated URLs

All generated URLs must use EC2/backend domain.

Correct:

```txt
https://EC2_BACKEND_DOMAIN/api/proxy/...
https://EC2_BACKEND_DOMAIN/api/smooth/...
```

Wrong:

```txt
https://old-render-url.onrender.com/api/proxy/...
http://localhost:5000/api/proxy/...
http://127.0.0.1:5000/api/smooth/...
```

Check:

* proxy URL generation
* smooth playback URL generation
* playlist segment URLs
* API base URL in app
* API base URL in admin
* API base URL in website

---

# Check Proxy Playback

If backend returns proxy URL, test it directly.

Test:

```txt
GET /api/proxy/:streamId/master.m3u8
```

Expected:

* returns valid HLS playlist
* contains #EXTM3U
* segment URLs are valid
* segment URLs point to EC2
* segment token is valid
* no old Render URL
* no localhost URL

Then test one segment URL.

Expected:

* segment returns video content
* not HTML
* not 401
* not 403
* not timeout
* not 404

If manifest loads but segment fails, app will show Reconnecting.

---

# Check Smooth Playback

If channel uses smooth playback:

Check:

```txt
GET /api/smooth/:channelId/playlist.m3u8
```

Expected:

```txt
#EXTM3U
#EXT-X-TARGETDURATION
#EXT-X-MEDIA-SEQUENCE
```

Must not contain:

```txt
#EXT-X-PLAYLIST-TYPE:EVENT
```

Check segment URLs:

* segments exist
* segment URLs point to EC2
* segment files are not missing
* old segments are not referenced after cleanup
* missing segments are skipped
* playlist does not include broken segment URLs

If smooth playlist includes missing segment URLs, media_kit will reconnect forever.

---

# Check Auth / License / Device Issue

All channels reconnecting can happen if the app gets stream URL but proxy/segments are blocked.

Check:

* user is logged in
* access token is valid
* refresh token works
* license is active
* device is registered
* device limit not exceeded
* proxy manifest accepts auth
* proxy segments use valid token
* hidden/removed channel is blocked correctly
* normal visible channels are allowed

If playback API works but proxy returns 401/403, fix auth/proxy token flow.

---

# Check media_kit Player Error

Add listener/log for media_kit player errors.

Need exact error:

```txt
network timeout
403 forbidden
404 not found
cleartext not permitted
invalid data
codec unsupported
manifest parse error
segment missing
connection refused
SSL error
```

Without exact player error, do not guess.

If error says cleartext not permitted:

* use HTTPS backend
* or allow cleartext only for test

If error says 403:

* check auth/proxy token/header/license

If error says 404:

* check proxy segment URL or missing segment file

If error says timeout:

* check EC2 port/firewall/source stream timeout

If error says invalid data:

* backend may be returning HTML/error instead of video segment

---

# Check Android Network Access

If using EC2 direct IP or HTTP:

Verify from phone browser:

```txt
http://EC2_PUBLIC_IP:5000/api/app/status
```

or:

```txt
https://api.nivatv.com/api/app/status
```

If phone browser cannot open backend API, app also cannot play.

Check:

* EC2 security group inbound rules
* port 5000 open if direct
* port 80/443 open if Nginx
* backend listening on 0.0.0.0
* Nginx proxy config
* SSL certificate
* firewall/ufw
* CORS if browser/admin
* Android cleartext if HTTP

---

# Check App Player State Bug

If backend and stream are valid but app still shows Reconnecting:

Check Flutter state logic.

Possible bugs:

1. `_isBuffering` remains true forever.
2. Player starts but overlay does not hide.
3. `isPlaying` event is not updating UI.
4. Retry loop restarts same URL again and again.
5. App never switches from direct to smooth URL.
6. Smooth status polling is not working.
7. Buffer ready becomes true but app does not reload smooth URL.
8. Player is disposed/recreated repeatedly.
9. Switching related channels triggers wrong channel stream.
10. Selected stream URL is empty or stale.

Add logs around:

* initializePlayer
* open media
* buffering event
* playing event
* error event
* reconnect timer
* fallback chain
* dispose
* channel switch

---

# Check Whether App Is Playing Smooth or Direct

For every channel, identify what URL app is actually trying to play.

App must print:

```txt
Playing mode: direct / proxy / smooth
Playing URL: ...
```

If smooth playback is enabled and buffer_ready=true:

App should play:

```txt
smooth_stream_url
```

If smooth playback warming and direct URL exists:

App should play:

```txt
direct_live_url temporarily
```

If neither exists:

Show clear error.

Do not keep infinite Reconnecting.

---

# Fix Reconnecting Forever

Do not let player show Reconnecting forever.

Add limit:

```txt
Max reconnect attempts: 3
```

After attempts fail:

Show:

```txt
Stream unavailable
No stable source available right now.
Retry
Try another channel
Report
```

Also report failure to backend with exact player error.

---

# Test With Known Good Stream

To separate app issue from IPTV source issue, test with known public HLS test stream.

Use:

```txt
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
```

Assign it to one test channel.

If Mux test stream plays in app:

* app player is working
* problem is source/proxy/smooth URLs

If Mux test stream also shows Reconnecting:

* global app/backend/network/player config is broken

This is the fastest diagnosis.

---

# Required Investigation Output

After investigation, provide a report with:

```txt
1. APK BACKEND_URL value
2. EC2 backend health check result
3. Channel ID tested
4. Playback API response summary
5. Smooth playback API response summary
6. Actual URL app tried to play
7. Proxy manifest test result
8. Proxy segment test result
9. media_kit exact error
10. Whether URL points to EC2 or old Render
11. Whether issue is backend config, proxy, smooth playlist, auth, or player state
12. Exact files changed
13. Test result after fix
```

---

# Acceptance Criteria

This issue is fixed when:

* APK uses EC2 backend URL.
* No Render URL remains in playback/proxy/smooth URLs.
* EC2 backend is reachable from phone.
* Playback API returns valid stream URL.
* Smooth playback API returns valid smooth URL or direct fallback.
* Proxy manifest loads.
* Proxy segment loads.
* media_kit receives a playable HLS URL.
* Known Mux test stream plays inside app.
* At least one real public channel plays.
* All channels no longer stay stuck on Reconnecting.
* If a channel source is bad, app shows proper channel/source error, not infinite reconnecting.
