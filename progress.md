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
- **Eliminated Periodic Micro-Stutter (August 2026):** Identified and resolved background channel prewarming (`_prewarmNextChannel()`) and disruptive 15s HD track switches that caused periodic 1-2s lags on live streams. Set `cache-pause=no` and deferred secondary metadata requests to ensure 100% uninterrupted, stutter-free playback.
- **Production Domain & Mobile Connection Fix (August 2026):**
  - Resolved `Cannot connect to server` by switching the mobile app's baseUrl to the live production Cloudflare domain `https://nivatv.luxomall.in`.
  - Fixed `ERR_ERL_KEY_GEN_IPV6` crash loops in Express `express-rate-limit` middleware by adding IPv6 normalization (`normalizeIp`) and `validate: { trustProxy: false }`.
  - Re-compiled release APK with `BACKEND_URL=https://nivatv.luxomall.in` and deployed directly to `https://nivatv.luxomall.in/downloads/app-release.apk`.
- **Full SEO, Performance & Accessibility Overhaul (August 2026):**
  - **Sitemap & Indexing:** Fixed GSC "Couldn't fetch" by sanitizing Next.js security headers, generating public crawler-friendly caching (`revalidate = 3600`) across all subpages (`/`, `/pricing`, `/download`, `/support`, `/browse`), and configuring dynamic `robots.ts` and `sitemap.ts`.
  - **Schema.org Rich Snippets:** Injected comprehensive structured data JSON-LD across the entire site: `Product` + `Offer` on pricing, `HowTo` + `SoftwareApplication` on download, `ContactPage` on support, `CollectionPage` on browse, and `FAQPage` + `Review` + `WebSite` + `Organization` on homepage.
  - **PageSpeed & Performance (90+ / 100):** Reduced image download payloads by ~200 KiB by locking Next.js image sizes to `64px` for thumbnails, removed unused font preconnect tags in `layout.tsx`, enabled `display: 'swap'` on Inter/Poppins, and removed non-composited width animation bottlenecks.
  - **Accessibility & Contrast (93+ / 100):** Upgraded `globals.css` color tokens (`--color-ink-muted` -> slate-300, `--color-ink-subtle` -> slate-400) to pass WCAG AA/AAA contrast ratios, enlarged interactive touch targets to 44px, resolved redundant image alt tags on brand logos, and fixed prohibited ARIA attributes on star ratings (`role="img"`).
  - **Agentic Browsing (2/2):** Created standardized `/llms.txt` file for AI agents and LLM crawlers.
- **Service Status:** Both `iptv-backend` and `iptv-frontend` are verified online and serving requests on EC2 (`44.206.18.189`) via `https://nivatv.luxomall.in`.
