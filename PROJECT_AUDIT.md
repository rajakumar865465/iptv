# IPTV Project — Full Audit Report
**Date:** June 26, 2026  
**Audited by:** Kiro AI  
**Stack:** Flutter (mobile) · Next.js 16 (admin) · Node.js/Express 5 (backend) · PostgreSQL

---

## 1. PROJECT OVERVIEW

```
iptv/
├── backend/     Node.js + Express 5 REST API  (src/app.js entry)
├── frontend/    Next.js 16 admin dashboard    (TypeScript + Tailwind v4)
├── mobile/      Flutter 3.12 Android app      (media_kit player, BLoC state)
└── .github/     GitHub Actions CI/CD → EC2 via SSH + PM2
```

The project is a full-featured Indian IPTV service with:
- Live TV streaming (HLS) with smart quality switching
- License/subscription system with device-limit enforcement
- Admin dashboard for content and user management
- EPG (Electronic Program Guide) support
- Server-side stream health monitoring and auto-failover

---

## 2. WHAT IS WORKING ✅

### 2.1 Backend — Working Features

| Feature | Status | Notes |
|---|---|---|
| User auth (signup/login/logout) | ✅ Working | JWT 7d, bcrypt salt-12, device tracking |
| Admin login (separate JWT) | ✅ Working | ADMIN_JWT_SECRET, 1d expiry |
| License activation + validation | ✅ Working | Device limit, forceLogoutOldest, expiry |
| Channel listing + filtering | ✅ Working | categoryId, language, health, premium, search, pagination |
| Channel playback API | ✅ Working | Returns primary + backup streams + quality variants |
| EPG now-playing + upcoming | ✅ Working | Fallback to category-based description if no EPG data |
| Related channels | ✅ Working | Same category → same language → popular fallback |
| Stream failure reporting | ✅ Working | Updates health_score, marks unstable/offline after thresholds |
| Playback result reporting | ✅ Working | Marks stream online/unstable/offline from real usage |
| HLS proxy (manifest + segments) | ✅ Working | LRU-bounded cache, redirect following, base64 segment URLs |
| FFmpeg live transcode | ✅ Working | Premium-only, MPEG-TS output, session cleanup on disconnect |
| Admin CRUD (all entities) | ✅ Working | Users, licenses, channels, categories, plans, payments |
| Maintenance jobs via HTTP | ✅ Working | Async, polled via status endpoint, protected by secret |
| Deduplicate channels job | ✅ Working | canonical_name normalization, merges streams, migrates favorites |
| Activate channels job | ✅ Working | Promotes best stream to primary, marks offline/unstable |
| Database migrations (14 files) | ✅ Working | Tracked via schema_migrations, idempotent |
| Analytics endpoints | ✅ Working | User signups, revenue, top channels by play count |
| Dashboard stats | ✅ Working | 7 parallel queries, real-time counts |
| Broken channel detection | ✅ Working | Filter + fix endpoint |
| Duplicate channel detection | ✅ Working | Group by canonical_name, admin merge |
| Stream scanner (job table) | ⚠️ Partial | Creates job records but does NOT actually scan streams |
| Notifications CRUD | ✅ Working | Title, body, targeting, scheduling |
| Audit logs | ⚠️ Partial | Table exists, but logging not called from most controllers |
| System health endpoint | ✅ Working | DB ping, memory, OS stats |
| Rate limiting | ✅ Working | auth 100/15min, search 1000/15min, api 5000/15min |
| CORS | ✅ Working | Allows mobile (null origin), configurable origins list |
| Static logo serving | ✅ Working | `/logos/` → `public/logos/` |
| CI/CD to EC2 | ✅ Working | Auto-deploy on push to main (backend only) |


### 2.2 Mobile App — Working Features

| Feature | Status | Notes |
|---|---|---|
| Splash → Onboarding → Login flow | ✅ Working | Token persisted in SharedPreferences |
| Signup with email + mobile | ✅ Working | 409 duplicate error handled |
| Device limit handling | ✅ Working | DeviceLimitReached state, forceLogoutOldest UX |
| Channel list with pagination | ✅ Working | 50/page, infinite scroll, server-side filter |
| Category + Language filter | ✅ Working | Exact categoryId sent to backend |
| Search channels | ✅ Working | Debounced, server-side ILIKE |
| Offline cache (6-hour) | ✅ Working | SharedPreferences, falls back gracefully |
| HLS playback (media_kit) | ✅ Working | Replaced video_player, proper HLS header support |
| Smart quality selection | ✅ Working | Data saver, mobile data, HD-WiFi-only preferences |
| Auto quality downgrade on buffer | ✅ Working | Steps down resolution on buffer stall |
| Auto-transcode fallback (Premium) | ✅ Working | Falls back to `/api/stream/transcode` on repeated failures |
| Backup stream failover | ✅ Working | Tries all backup_streams before showing error |
| Playback failure reporting | ✅ Working | POST to backend on timeout/error |
| Playback success reporting | ✅ Working | Marks online vs unstable based on retry history |
| Wakelock during playback | ✅ Working | wakelock_plus enabled/disabled on player open/close |
| Fullscreen + orientation lock | ✅ Working | SystemChrome landscape/portrait |
| EPG now-playing card | ✅ Working | Progress bar, fallback description |
| EPG upcoming schedule | ✅ Working | Time-sorted, empty state |
| Related channels row | ✅ Working | Same category or language |
| More Live Channels paginated grid | ✅ Working | Infinite scroll within player screen |
| Favorites (add/remove/sync) | ✅ Working | FavoriteCubit, backend sync |
| License activation | ✅ Working | Key entry + backend activation |
| License status display | ✅ Working | Remaining days, plan name |
| Video fit modes | ✅ Working | Auto/Fit/Fill/Zoom/Stretch, persisted |
| Connectivity detection | ✅ Working | Mobile vs WiFi quality switching |
| Shimmer loading states | ✅ Working | Cards, grid, related section |
| Offline auth (network error) | ✅ Working | Allows cached access on timeout, forces re-login on 500 |

### 2.3 Admin Dashboard — Working Features

| Feature | Status | Notes |
|---|---|---|
| Login + token storage | ✅ Working | localStorage, auto-redirect on 401 |
| Dashboard page | ✅ Working | User/channel/license/payment stats + recent activity |
| Users list + status toggle | ✅ Working | Block/unblock users |
| Devices list + delete | ✅ Working | See all active devices |
| Licenses CRUD | ✅ Working | Create, extend, suspend, revoke |
| Plans CRUD | ✅ Working | Pricing, duration, device limit |
| Payments list + status update | ✅ Working | Manual payment approval |
| Channels CRUD | ✅ Working | Paginated, edit all fields |
| Channel Streams CRUD | ✅ Working | Per-channel stream management |
| Categories CRUD | ✅ Working | Name, icon, sort order |
| Broken Channels list | ✅ Working | Filter by health, fix action |
| Duplicate Channels | ✅ Working | Group view, merge action |
| Stream Scanner | ⚠️ Partial | Creates scan jobs but no actual scanning |
| App Settings | ✅ Working | Key-value config, maintenance mode |
| Notifications | ✅ Working | Create, schedule, target by user/all |
| Analytics charts | ✅ Working | Recharts line/bar, user signups, revenue |
| System Health | ✅ Working | DB ping, memory usage |
| Admin Users | ⚠️ Partial | List + create broken (syntax error in createAdminUser) |
| Logs | ⚠️ Partial | API errors work; Admin actions broken (corrupted query) |


---

## 3. CRITICAL BUGS 🔴 (Must Fix — Will Cause Runtime Crashes)

### BUG-01: `channelStreamController.js` — Syntax error on line 2
**File:** `backend/src/controllers/channelStreamController.js`  
**Problem:** Stray text `blasted` after the require statement — this is invalid JavaScript.
```js
// BROKEN:
const { success, error } = require('../utils/response'); blasted
// FIX:
const { success, error } = require('../utils/response');
```
**Impact:** The entire controller module fails to load. All Channel Stream admin routes crash on startup.

### BUG-02: `channelStreamController.js` — Corrupted function parameters
**File:** `backend/src/controllers/channelStreamController.js`  
**Problem:** `deleteChannelStream` contains Chinese characters mid-function, and `setPrimaryStream` has `Earn money` as the `res` parameter name.
```js
// BROKEN in deleteChannelStream:
审核队伍有无受理    error(res, 'Failed to delete stream', 500);

// BROKEN in setPrimaryStream:
exports.setPrimaryStream = async (req, Earn money) => {
// FIX:
exports.setPrimaryStream = async (req, res) => {
```
**Impact:** `deleteChannelStream` and `setPrimaryStream` crash on any call. Admin UI stream management is broken.

### BUG-03: `adminUserController.js` — Invalid syntax `async?`
**File:** `backend/src/controllers/adminUserController.js`  
**Problem:**
```js
// BROKEN:
exports.createAdminUser = async? (req, res) => {
// FIX:
exports.createAdminUser = async (req, res) => {
```
**Impact:** Creating admin users from the dashboard crashes with a syntax error.

### BUG-04: `logController.js` — Corrupted table name in SQL
**File:** `backend/src/controllers/logController.js`  
**Problem:**
```js
// BROKEN:
'SELECT ... FROM admin??????_audit_logs l ...'
// FIX:
'SELECT ... FROM admin_audit_logs l ...'
```
**Impact:** The Admin Actions log page throws a DB error on every load.

### BUG-05: `014_add_dashboard_tables.sql` — Corrupted migration SQL
**File:** `backend/migrations/014_add_dashboard_tables.sql`  
**Problem:** `CREATE TABLE IF NOT EXISTS admin_audit_logs如故(` — Chinese chars in table name, and `我们的目标_type` as column name, `ITVpath` mid-line. Migration will fail on most PostgreSQL versions.  
**Impact:** Dashboard tables never get created if migration hasn't run yet. All analytics/logs/scanner functionality fails on fresh deployments.


---

## 4. SIGNIFICANT BUGS 🟠 (Will Cause Bad UX or Data Issues)

### BUG-06: Stream Scanner — Does nothing
**File:** `backend/src/controllers/scannerController.js`  
**Problem:** `triggerScan` only inserts a job record into `stream_scan_jobs` with status `running` and all counts at 0. It never actually probes any stream URLs. The job stays at 0/0/0 forever. The admin UI shows it ran but gives no useful data.  
**Fix:** Connect to the `check-streams-deep.js` script logic or run it as a child process.

### BUG-07: Forgot Password returns 501
**File:** `backend/src/controllers/authController.js`  
**Problem:** The forgot password endpoint correctly returns 501 ("not implemented"), but the mobile `ForgotPasswordScreen` still exists and users can navigate to it. They see the form, submit, and get a confusing "not implemented" message.  
**Fix:** Either implement email-based password reset (requires SMTP setup), or hide the "Forgot Password" link in the Flutter login screen until the feature is ready.

### BUG-08: SQL Injection in `analyticsController.js`
**File:** `backend/src/controllers/analyticsController.js`  
**Problem:** The `days` query parameter is interpolated directly into the SQL string without parameterization:
```js
// VULNERABLE:
`... INTERVAL '${days} days' ...`
```
A malicious admin could send `days=30; DROP TABLE users;--`. Even though this endpoint is admin-only, it's still a security risk.  
**Fix:** Validate `days` as an integer before using it, or use a whitelist of allowed values.

### BUG-09: `getAdminActions` query builds `$N` offset incorrectly
**File:** `backend/src/controllers/logController.js`  
**Problem:** The `LIMIT $N OFFSET $N+1` placeholders are built from `params.length` but the `countQuery` uses a separate query without those params. When `admin_id` is not provided, `params = []`, making LIMIT `$1` and OFFSET `$2` — which is correct. But when `admin_id` IS provided, LIMIT becomes `$2` and OFFSET `$3`, but the params array only has `[admin_id]`. The `limit` and `offset` values are appended after that. This is actually correct but hard to read — however the corrupted table name (BUG-04) means this never executes anyway.

### BUG-10: `authController.js` — Token payload uses `userId` but `streamController.js` uses `decoded.id`
**File:** `backend/src/controllers/streamController.js` line ~20  
**Problem:**
```js
// generateToken signs with: { userId: user.id, ... }
// But streamController verifies and reads:
const decoded = jwt.verify(token, process.env.JWT_SECRET);
const licenseResult = await db.query(`... WHERE user_id = $1`, [decoded.id]); // decoded.id is undefined!
```
`decoded.id` is always `undefined`. The license check query does `WHERE user_id = undefined`, which finds no rows, so ALL premium users get a 403 "No active license" when trying to use the transcode endpoint.  
**Fix:** Change `decoded.id` to `decoded.userId`.

### BUG-11: Device platform hardcoded to 'android' in licenseController
**File:** `backend/src/controllers/licenseController.js`  
**Problem:** `platform` is hardcoded to `'android'` in the device insert on license activation, even if the device is iOS or web.  
**Fix:** Accept `platform` from request body and default to `'android'`.

### BUG-12: `getChannelsAdmin` returns total count but never sends it in response
**File:** `backend/src/controllers/adminController.js`  
**Problem:** `countResult` and `total` are fetched but the `success(res, result.rows)` call never includes pagination metadata. The admin channels page can't show total count or implement proper pagination UI.


---

## 5. MISSING FEATURES & INCOMPLETE IMPLEMENTATIONS 🟡

### MISSING-01: No actual stream health checking in Scanner
The `stream_scan_jobs` table and scanner UI exist, but the actual HTTP probe logic (from `scripts/check-streams-deep.js`) is never triggered via the admin dashboard. Admins must SSH into the server and run the script manually.  
**Suggestion:** Wire `scannerController.triggerScan` to spawn a worker that iterates `channel_streams`, HEAD-probes each URL, and updates the job progress in real time.

### MISSING-02: No payment gateway integration
Payments are entirely manual (`payment_method = 'manual'`). There is a `/api/payments/manual-request` endpoint, but no Razorpay / Stripe / UPI integration. Revenue data in analytics only tracks manually-approved payments.  
**Suggestion:** Integrate Razorpay (India-first, easy UPI). Add webhook endpoint to auto-approve payments and auto-create licenses.

### MISSING-03: No push notifications delivery
The notifications table and CRUD API exist, but notifications are never actually sent to devices. There is no FCM (Firebase Cloud Messaging) integration.  
**Suggestion:** Add `firebase-admin` to backend dependencies. Store FCM tokens in the `devices` table. Trigger on `notifications.sent_at IS NULL AND scheduled_at <= NOW()` via a cron or on-demand from admin.

### MISSING-04: Audit logging not wired to admin actions
The `admin_audit_logs` table exists (once BUG-05 is fixed), but `adminController.js` never inserts records into it. No admin action is logged: channel edits, user blocks, license revocations, etc.  
**Suggestion:** Add an `auditLog(adminId, action, targetType, targetId, details, req)` helper and call it from each sensitive admin operation.

### MISSING-05: No refresh token mechanism
JWT tokens are 7-day for users and 1-day for admin. There is no refresh token endpoint. Users get logged out after 7 days even if they are active. Admin sessions expire after 1 day.  
**Suggestion:** Implement a `POST /api/auth/refresh` endpoint with a long-lived refresh token stored in the database (or httpOnly cookie for admin).

### MISSING-06: No input validation on most admin routes
`authController` uses `express-validator` for signup/login, but almost no admin routes validate input (e.g., `createChannel` accepts any `stream_url` without URL format validation, `createLicense` accepts any `plan_id` without checking if the plan exists).  
**Suggestion:** Add express-validator middleware to admin channel/license/plan creation routes.

### MISSING-07: No watch history write from mobile
`watch_history` table exists and the analytics endpoint reads from it, but the mobile app never writes to it (no `POST /api/user/watch-history` call when a channel starts playing).  
**Suggestion:** Call the watch history endpoint when a channel plays successfully, with duration updated on player close.

### MISSING-08: No app version enforcement in CI/CD
The `version-check` endpoint and `force_update`/`minimum_app_version` app settings exist, but the GitHub Actions deploy workflow doesn't update these settings after a new release. Version bump is manual.

### MISSING-09: Frontend route `/admin-users` — broken create button
Due to BUG-03, the "Create Admin User" button in the admin dashboard calls an endpoint that crashes. The admin has no self-service way to add more admins.

### MISSING-10: No token revocation / blacklist
When a user is blocked (`users.status = 'blocked'`), the auth middleware correctly rejects their next request. However, if they have a valid token cached and don't make a fresh API call, they can still use cached data in the Flutter app for the remainder of the 7-day JWT lifetime.


---

## 6. BUFFERING & PLAYBACK QUALITY SUGGESTIONS 📺

These are the most user-visible issues after bugs are fixed.

### PLAYBACK-01: Buffer size is good, but initial load feels slow
The `media_kit` player is configured with 32MB buffer which prevents mid-stream stutters. However, the app makes a sequential API call to `/channels/:id/playback` before starting the player, adding ~200-500ms of latency on every channel switch.  
**Suggestion:** Pre-fetch the playback URL for the selected channel while the user is browsing (on hover/focus), so it's ready when they tap. Or cache the last-played channel's playback response for 30 seconds.

### PLAYBACK-02: 15-second timeout is aggressive for slow connections
The safety timeout in `_initializePlayer` fires after 15 seconds and triggers failover. On very slow mobile connections (2G), legitimate streams can take 20-25 seconds to start.  
**Suggestion:** Make the initial timeout 25 seconds. The buffer-stall timer (10 seconds, only after the stream starts playing) is already well-tuned — keep that.

### PLAYBACK-03: No adaptive bitrate notification to the user
When the player auto-downgrades quality (buffer stall → lower quality), the `_streamOverlayMessage` shows "Auto-switching to lower quality..." but disappears as soon as the player starts. Users don't see what quality they ended up on in the bottom bar until they open the quality selector.  
**Suggestion:** After a quality switch, briefly show a toast/snackbar: "Now playing at 480p" for 3 seconds.

### PLAYBACK-04: Transcode endpoint has no load limiting
Multiple users on the premium tier could simultaneously request `/api/stream/transcode/:channelId`, each spawning a full FFmpeg process. On a small EC2 instance (t2.micro/t2.small), 3-4 simultaneous transcode sessions will saturate the CPU.  
**Suggestion:** Add a concurrency counter to `streamController.js`. If `activeTranscodes.size >= MAX_SESSIONS` (e.g., 4), return a 503 with "Server busy, please try again shortly."

### PLAYBACK-05: Proxy segment retry is unbounded
In `proxyController.proxySegment`, on failure it retries exactly once — but if the second attempt also fails, it throws and returns 500 with no body, causing the media_kit player to stall.  
**Suggestion:** Wrap the retry in a proper try-catch and return a clean 502 with a message so the player can trigger `_handleStreamFailure` rather than stalling silently.

### PLAYBACK-06: No CDN/cache layer for logos
Logo images are served from the backend static file server (`/logos/*.png`). On a single EC2 instance, this means every Flutter client fetches logos from the app server on first load.  
**Suggestion:** Serve logos from an S3 bucket with CloudFront CDN, or at minimum add proper `Cache-Control: max-age=86400` headers to the static express serving middleware.

### PLAYBACK-07: HLS manifest proxy rewrites all segments to backend URLs
The proxy rewrites M3U8 segments to go through `/api/proxy/segment/:streamId/:b64url`. This means every video segment (typically 2-4 seconds each) makes a round-trip through the Node.js server. For HD streams at 1080p, this can be 1-3 MB per segment, several times per second.  
**Suggestion:** The proxy is essential for channels with geo-blocked or DRM headers. For channels that don't need header injection (direct-playable URLs), bypass the proxy and let media_kit hit the CDN directly. Add a `needs_proxy` flag to `channel_streams`.


---

## 7. FILTERING SYSTEM AUDIT 🔍

The filtering system is generally well-built. Here are the specific findings:

### FILTER-01: Category filter works correctly ✅
- Mobile sends `categoryId` (integer) as a query param
- Backend uses `c.category_id = $N` exact match — no ILIKE fuzziness
- Categories are fetched fresh on each filter change with correct `workingOnly` param

### FILTER-02: Language filter normalizes correctly ✅
- `normalizeLanguage()` maps ISO codes (hin, ben, tam) and alternate spellings to canonical names
- Mobile sends the canonical name returned by the server — no mismatch
- Backend uses `LOWER(c.language) = LOWER($N)` for case-insensitive exact match

### FILTER-03: Health/workingOnly filter has a gap 🟡
When `workingOnly=true`, channels with `is_premium=true` bypass the health filter:
```sql
(c.health_status IN ('online','unstable',...) OR c.is_premium = true)
```
This means offline premium channels still show up when workingOnly is on. Premium channels should also be health-filtered (or at minimum, show a "may be unavailable" indicator).

### FILTER-04: Search doesn't include `display_name` field 🟡
`searchChannels` uses: `c.name ILIKE $1 OR cat.name ILIKE $1 OR c.language ILIKE $1`  
But `getChannels` includes `c.display_name ILIKE $N` in its search. These two endpoints behave differently. Use the same field list.

### FILTER-05: Language list can have duplicates 🟡
`getLanguages` groups by `LOWER(TRIM(c.language))` but displays `INITCAP(LOWER(TRIM(c.language)))`. If database has both "hindi" and "Hindi " (trailing space), they merge correctly. However the response has no `code` field — the Flutter app sends back the display name `"Hindi"` as the filter value, which works but is fragile.  
**Suggestion:** Return a language `code` (e.g., ISO code or slug) alongside `name` so the filter is stable even if display names change.

### FILTER-06: No "All" reset in category/language filters from player screen 🟡
The `PlayerScreen.loadMoreLiveChannels()` always fetches all channels without any filter. If a user is watching a channel from a filtered view, the "More Live Channels" grid shows all channels regardless of the current filter context — which is actually fine UX-wise, but inconsistent.

### FILTER-07: Client-side deduplication in ChannelCubit is good ✅
The `_deduplicateChannels` method uses the same canonical name normalization as the backend. Pagination can occasionally return the same channel on different pages if sorting changes between requests — the client dedup catches this cleanly.


---

## 8. SECURITY AUDIT 🔒

### SEC-01: SQL Injection — `analyticsController.js` 🔴
Already listed as BUG-08. Admin-only but still a real risk.

### SEC-02: Separate JWT secrets for users vs admins ✅
`JWT_SECRET` and `ADMIN_JWT_SECRET` are separate. Admin tokens can't be used on user endpoints and vice versa. The `adminAuth.js` middleware correctly uses `verifyAdminToken()`.

### SEC-03: Password handling is secure ✅
bcryptjs with salt rounds = 12. Passwords never returned in API responses (`password_hash` is stripped before sending user objects).

### SEC-04: License key generation is secure ✅
`crypto.randomBytes` (not `Math.random`). 4 × 6-char hex = 24 hex characters = 96 bits of entropy. Very hard to guess.

### SEC-05: Rate limiting is configured but limits are loose 🟡
- Auth: 100 attempts per 15 minutes per IP is still quite high for brute-force protection. A 10-attempt-per-minute limit with exponential backoff would be safer.
- No IP-based ban after repeated 401s on login.

### SEC-06: CORS allows null origin (mobile apps) — intended ✅
Mobile apps send no `Origin` header. The backend allows `!origin` explicitly. This is correct.

### SEC-07: Admin routes accessible with only a JWT — no 2FA 🟡
Admin accounts have email/password login with no second factor. A compromised admin account gives full access to all user data, channels, and license management.  
**Suggestion:** Add TOTP-based 2FA for admin login. `speakeasy` is a good Node.js library for this.

### SEC-08: `x-maintenance-secret` sent in plaintext headers 🟡
The maintenance endpoint protection uses a shared secret in `x-maintenance-secret` header. If the connection is HTTP (not HTTPS), this is interceptable.  
**Recommendation:** Ensure your EC2 setup terminates TLS (via nginx/CloudFront) before reaching the Node.js backend.

### SEC-09: No HTTPS enforcement in the backend itself 🟡
The Node.js app doesn't redirect HTTP to HTTPS. This should be handled at the reverse proxy (nginx) or load balancer level.

### SEC-10: Admin token stored in `localStorage` (frontend) 🟡
`localStorage` is accessible to any JavaScript on the page, making it vulnerable to XSS attacks. For an admin dashboard, `httpOnly` cookies would be safer.  
**Suggested fix:** Move the admin token to a `httpOnly, SameSite=Strict` cookie set by the server.

### SEC-11: No request body size limit on file-like inputs 🟡
`express.json({ limit: '10mb' })` is set globally. This is fine for most routes but the import scripts accept large M3U playlist data. Consider tightening the limit on specific routes.

### SEC-12: `helmet()` is configured but no CSP ✅/🟡
`helmet()` provides basic security headers. No custom Content Security Policy is set. For the admin Next.js frontend, add a CSP header.


---

## 9. DATABASE & PERFORMANCE AUDIT 🗄️

### DB-01: Schema introspection caches are module-level (good) ✅
`channelController.js` caches `healthStatusColumnExists`, `channelStreamsTableExists`, etc. at module level. These avoid per-request `information_schema` queries after first call. Good pattern.

### DB-02: No connection pool exhaustion protection 🟡
Pool max is 10 connections. If many concurrent requests hit long-running queries (e.g., a big dedup job while users are browsing), pool can exhaust and new requests will queue/timeout.  
**Suggestion:** Increase pool max to 20 for production. Add a `statement_timeout` of 30 seconds to prevent runaway queries.

### DB-03: Dashboard stats use 7 parallel queries ✅
`dashboardController` runs all 7 queries with `Promise.all` — good use of parallelism.

### DB-04: `getChannels` count + data queries are parallel ✅
On paginated requests, `Promise.all([countQuery, dataQuery])` is used. This is the right pattern.

### DB-05: Missing index on `watch_history.watched_at` 🟡
`analyticsController.getPlaybackAnalytics` filters `WHERE w.watched_at > NOW() - INTERVAL '30 days'`. There is no index on `watch_history.watched_at`, so this becomes a full table scan as history grows.  
**Fix:** Add `CREATE INDEX idx_watch_history_watched_at ON watch_history(watched_at DESC)`.

### DB-06: `channel_streams` health score never resets on success 🟡
`reportFailure` decrements `health_score` by 20 per failure. `reportPlaybackResult` updates `health_status` but never increments `health_score` back. After a stream is marked unstable but then plays successfully, the score stays low, potentially causing it to be deprioritized forever.  
**Fix:** In `reportPlaybackResult`, when result is `'played'`, also do:
```sql
UPDATE channel_streams SET health_score = LEAST(100, health_score + 10),
  success_count = success_count + 1, last_success_at = NOW()
WHERE channel_id = $1 AND stream_url = $2
```

### DB-07: Duplicate migrations for `channel_streams` table 🟡
Both migration 009 and migration 011 contain `CREATE TABLE IF NOT EXISTS channel_streams`. The `IF NOT EXISTS` prevents crashes, but migration 011 also re-creates the trigger function and re-adds indexes that migration 009 already created. This is messy but harmless due to `IF NOT EXISTS`.

### DB-08: Migration 014 corrupted SQL 🔴
Already listed as BUG-05. Critical.

### DB-09: `devices` table has no unique constraint on `(user_id, device_id)` 🟡
The auth controller checks `SELECT id FROM devices WHERE device_id = $1 AND user_id = $2` before inserting, but there is no database-level UNIQUE constraint. Under concurrent requests (double-tap login), two rows for the same device could be inserted.  
**Fix:** Add `ALTER TABLE devices ADD CONSTRAINT unique_user_device UNIQUE (user_id, device_id)`.

### DB-10: `schema_migrations` tracking works but startup is slow on cold boot 🟡
On every startup, the app reads all migration files from disk and checks each against `schema_migrations`. With 14 migrations this is fast, but at 50+ migrations this will add noticeable startup latency.  
**Suggestion:** This is fine for now. At 30+ migrations, consider moving to a dedicated migration tool like `db-migrate` or `flyway`.


---

## 10. ARCHITECTURE & CODE QUALITY NOTES 📐

### ARCH-01: Excellent separation of concerns
Backend follows controller/route/middleware/utils pattern cleanly. Each controller has a single responsibility. The `response.js` utility (`success`/`error`) is used consistently across all controllers.

### ARCH-02: Flutter BLoC/Cubit architecture is well-structured ✅
5 cubits covering all major state domains. States are proper sealed classes. The `AuthCubit.checkAuth()` gracefully handles offline vs server-error vs token-expired scenarios.

### ARCH-03: `channelController.js` is too large (700+ lines) 🟡
It handles channels, categories, languages, EPG, playback, related, failure reporting, and playback results. Consider splitting:
- `epgController.js` — EPG now/upcoming
- `channelPlaybackController.js` — playback, related, failure/result reporting

### ARCH-04: No global error boundary in Flutter 🟡
The app has per-screen error handling, but no global `FlutterError.onError` handler or Sentry/Crashlytics integration. Unhandled exceptions in non-UI code are silently swallowed.  
**Suggestion:** Add `FlutterError.onError` and `PlatformDispatcher.instance.onError` in `main.dart` to capture uncaught exceptions.

### ARCH-05: Backend has no centralized request logger for errors 🟡
`morgan('combined')` logs all requests, but there is no middleware that automatically writes to `api_error_logs` table on 4xx/5xx responses. The table exists but is never populated automatically.  
**Suggestion:** Add error-logging middleware after the error handler that writes to `api_error_logs` for status codes >= 400.

### ARCH-06: `ALLOW_UNKNOWN_STREAMS=true` in .env.example is a UX risk 🟡
With this setting, channels whose streams have never been checked show up in "working only" mode. Users may tap on them and get errors. This is fine for development/onboarding but should be `false` in production once streams have been checked.  
**Suggestion:** Set `ALLOW_UNKNOWN_STREAMS=false` in production. Run `npm run check-streams` after every channel import.

### ARCH-07: Root-level check scripts are disorganized 🟡
Files like `check-api.js`, `check-aws.js`, `check-db.js`, `check-endpoints.js`, `reset-license.js`, `reset-pwd.js` sit at the `backend/` root. These are developer utilities and should be moved to `backend/scripts/` or removed.

### ARCH-08: `temp_create_controllers.js` at workspace root 🟡
There is a `temp_create_controllers.js` file at the root of the workspace. This appears to be a one-time scaffolding script. It should be deleted.

### ARCH-09: No test coverage 🟠
`backend/tests/` is empty. `jest` and `supertest` are installed as devDependencies but no tests exist. This is a significant risk for a production system handling payments and license management.  
**Priority tests to write:**
1. `POST /api/auth/login` — success, wrong password, blocked user
2. `POST /api/license/activate` — success, device limit, expired
3. `GET /api/channels` — pagination, category filter, health filter
4. `GET /api/channels/:id/playback` — with and without channel_streams table


---

## 11. FEATURE SUGGESTIONS 💡

These are features worth adding to make the product more competitive.

### FEAT-01: Watch History in Player Screen
Show a "Continue Watching" section on the home screen using `watch_history`. The infrastructure (table + API endpoint) exists — just needs the mobile app to write to it.

### FEAT-02: Channel Favourites Badge / Count on Category
Show a ❤️ count or "Favourite" indicator on channel cards in the list view. The favorites data is already loaded in `FavoriteCubit`.

### FEAT-03: Reminder / Set Alarm for EPG Programs
Users can tap an upcoming EPG item and set a local notification to remind them 5 minutes before it starts. Uses Flutter local notifications.

### FEAT-04: Picture-in-Picture (PiP) Mode
`media_kit` supports PiP on Android. When a user navigates away from the player screen, the video could continue in a floating window. This is a premium-feel feature common in paid IPTV apps.

### FEAT-05: Multiple Audio Track Selection
HLS streams often contain multiple audio tracks (Hindi dub, English dub, regional language). `media_kit` exposes `player.state.tracks.audio`. Add an audio track selector alongside the quality selector.

### FEAT-06: Channel Lock / Parental Control
Allow users to PIN-lock specific channels (e.g., adult content categories). PIN set in PlaybackSettings, checked before entering the player for locked channels.

### FEAT-07: Download EPG in Bulk (Admin)
Add an admin maintenance job that fetches EPG XML from a configured URL (e.g., `epg.pw` or custom XML feed), parses it with the existing `xml2js` dependency, and bulk-inserts into `epg_programs`. The `import-epg.js` script exists but is not triggerable from the admin UI.

### FEAT-08: Deep Link Support
Add Android intent filters so links like `iptv://channel/123` open the player directly. Useful for sharing channels via WhatsApp/Telegram.

### FEAT-09: Sleep Timer
Add a sleep timer to the player (15/30/45/60 min options). Auto-pauses and optionally exits the player. Simple timer-based feature, no backend changes needed.

### FEAT-10: Live Stream Recording (Premium)
Allow premium users to record a stream for a set duration. The FFmpeg infrastructure already exists in `streamController.js`. Add a `record` mode that outputs to a temp file and serves a download link.

### FEAT-11: Subscription Renewal Reminders
3 days before a license expires, send a push notification (once FCM is wired up) reminding the user to renew.

### FEAT-12: Admin: Bulk Channel Actions
Add bulk enable/disable/delete for channels in the admin dashboard. Currently each channel must be updated individually.


---

## 12. PRIORITY FIX CHECKLIST 📋

### Fix immediately (will cause crashes or security issues):

- [x] **BUG-01** — Remove ` blasted` from `channelStreamController.js` line 2
- [x] **BUG-02** — Fix Chinese chars and `Earn money` in `channelStreamController.js`
- [x] **BUG-03** — Fix `async?` → `async` in `adminUserController.js`
- [x] **BUG-04** — Fix `admin??????_audit_logs` → `admin_audit_logs` in `logController.js`
- [x] **BUG-05** — Rewrite clean version of `014_add_dashboard_tables.sql`
- [x] **BUG-10** — Fix `decoded.id` → `decoded.userId` in `streamController.js` (premium transcode broken for ALL users)
- [x] **BUG-08** — Parameterize the `days` interval in `analyticsController.js` (whitelist + `INTERVAL '1 day' * $1`)

### Fix soon (bad UX or data issues):

- [x] **BUG-06** — Stream Scanner now actually probes streams via HTTP HEAD with concurrency=8, updates health_status per stream
- [ ] **BUG-07** — Hide Forgot Password button in Flutter until feature is implemented
- [x] **BUG-11** — Accept `platform` from request body in licenseController
- [x] **BUG-12** — Return pagination metadata from `getChannelsAdmin`
- [x] **DB-06** — Reset `health_score` (+10) on successful playback in `reportPlaybackResult`
- [x] **DB-09** — Add UNIQUE constraint on `devices(user_id, device_id)` — migration 015

### Improve soon (performance & reliability):

- [x] **PLAYBACK-04** — Concurrency limit (`MAX_TRANSCODE_SESSIONS`, default 4) added to `streamController.js`
- [x] **PLAYBACK-02** — Initial stream timeout increased to 25 seconds (both `videoParams.timeout` and `_bufferTimer`)
- [x] **PLAYBACK-03** — Snackbar toast after auto-quality-switch ("Now playing at 480p" / "Auto-switched to 360p")
- [x] **PLAYBACK-05** — Proxy segment retry now catches second failure and returns clean 502
- [x] **PLAYBACK-06** — Logo static files now served with `Cache-Control: max-age=86400`
- [x] **DB-05** — Index on `watch_history(watched_at DESC)` added — migration 015
- [ ] **MISSING-07** — Write watch history from mobile player screen
- [x] **ARCH-05** — Auto-log 4xx/5xx to `api_error_logs` via `errorLoggerMiddleware` in `app.js`
- [x] **FILTER-03** — Health filter now applies to premium channels too in workingOnly mode
- [x] **FILTER-04** — `searchChannels` now includes `display_name` in search fields
- [x] **DB-02** — Pool max made configurable via `DB_POOL_MAX` env var (default 20 prod / 10 dev)

### Plan for next sprint:

- [ ] **MISSING-01** — ✅ Done (scanner now probes — but could add scheduled auto-scan cron)
- [ ] **MISSING-02** — Razorpay payment gateway integration
- [ ] **MISSING-03** — FCM push notifications
- [ ] **MISSING-04** — Admin audit logging wired to sensitive actions
- [ ] **MISSING-05** — JWT refresh token endpoint
- [ ] **MISSING-06** — Input validation on admin routes
- [ ] **ARCH-09** — Write unit tests for auth, license, channel API
- [ ] **FEAT-04** — Picture-in-Picture mode
- [ ] **FEAT-05** — Audio track selector

---

## 13. SUMMARY SCORECARD

| Area | Score | Notes |
|---|---|---|
| Core streaming | 8/10 | Smart failover, quality switching, wakelock, fit modes all working |
| Backend API | 7/10 | Solid architecture, multiple critical syntax bugs need fixing |
| Filtering | 8/10 | Generally robust, minor gaps in health/premium interaction |
| Security | 6/10 | JWT separation good, SQL injection in analytics, no 2FA for admin |
| Database | 7/10 | Good schema evolution, missing a few indexes and constraints |
| Admin Dashboard | 6/10 | 3 broken admin features (stream CRUD, admin user create, logs) |
| Mobile UX | 8/10 | Professional feel, good error states, shimmer, offline cache |
| Test Coverage | 1/10 | No automated tests |
| Feature Completeness | 6/10 | Payments, notifications, EPG import not yet automated |
| **Overall** | **7/10** | Solid foundation — fix the 7 critical bugs and it's production-ready |

---

*Generated by Kiro AI — Full codebase review of backend (Node.js), frontend (Next.js), and mobile (Flutter) on June 26, 2026.*
