# NivaTV - Recent Progress

## Mobile App Playback Bugfixes (August 2026)
- **Hardware Acceleration:** Fixed 0 FPS and buffering issue on physical Android devices by updating `player_screen.dart` to use `hwdec=auto` instead of `auto-safe`, and adding a multi-stage hardware decoder fallback cascade (`auto` -> `mediacodec` -> `no`).
- **Buffering / Token Expiry Fixes:** Fixed an infinite buffering issue occurring exactly at 2-3 minutes into playback (token expiry).
  - Ensured that fatal HTTP errors (e.g., `403 Forbidden`) instantly trigger a backend URL refresh instead of waiting for a 40-second timeout.
  - Fixed a URL comparison bug where the app was stripping `token=` parameters, causing it to incorrectly discard freshly generated stream URLs.
  - Fixed an aggressive fallback bug where standard network hiccups were bypassing silent retries. Now, temporary internet drops are given 1.5 seconds to recover automatically, while hard token expiries skip the wait.
- **Timeouts:** Reduced the default stall watchdog timeout from 40 seconds to 15 seconds.
- **Build:** Successfully compiled `app-release.apk` pointing directly to `http://44.206.18.189:5000` to bypass Nginx routing issues.

## Backend & Deployment Fixes (August 2026)
- **App Releases Management:** Added migration `054_ensure_app_releases.sql` to ensure the `app_releases` table exists and automatically seed the default release (`v1.2.1`, `96.5 MB`, `/downloads/app-release.apk`). Added `DELETE /api/internal/app-releases/:id` API route.
- **Frontend App Releases UI:** Enhanced with "Fill Defaults" preset button, delete functionality, and error recovery banners.
- **Next.js Turbopack & Edge Runtime Compatibility:** Replaced Node.js `crypto` import with Web Crypto API (`globalThis.crypto.getRandomValues`) in `frontend/src/middleware.ts` to ensure clean builds. Added `/downloads/:path*` rewrite proxy in `next.config.ts`.
- **Rate Limit IPv6 Fix:** Resolved `ERR_ERL_KEY_GEN_IPV6` crash in `backend/src/middleware/rateLimit.js` by adding explicit validation flags.
- **PostgreSQL Ownership Compatibility:** Migration 054 rewritten as a permission-safe anonymous `DO $$` block to avoid table ownership errors.
- **Direct Local APK Hosting (Migration 055):** Hosted `app-release.apk` (v2.7, 97.4 MB) directly in `backend/public/downloads/app-release.apk` and updated the database release route so users get a 1-click instant direct download without any Google Drive virus scan warning pages.
- **Service Status:** Both `iptv-backend` and `iptv-frontend` are verified online and serving requests on EC2 (`44.206.18.189`).


