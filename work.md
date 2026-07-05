  ---
  🔴 CRITICAL
  1. backend/src/controllers/authController.js:230 — ReferenceError: revokeRefreshToken not imported
  // Line 214 only imports:
  const { consumeRefreshToken, isRefreshTokenRevoked } = require('../utils/jwt');
  // Line 230 calls:
  await revokeRefreshToken(refreshToken);  // ← ReferenceError!
  revokeRefreshToken is imported in logout (line 197) but not in refreshToken. This means every call to POST /api/auth/refresh-token throws a ReferenceError  caught at line 252, returning 401 to all clients. Token refresh is completely broken for all users. Old tokens are also never revoked (rotation silently
  fails). Fix: add revokeRefreshToken to the destructure on line 214.

  ---
  2. backend/src/controllers/authController.js:333-344 — Password reset via mobile always fails
  // OTP was stored with user.email (line 284):
  INSERT INTO password_reset_otps (email, otp...) VALUES ($1, ...) [user.email]

  // But lookup uses the raw identifier (could be a mobile number):
  WHERE email = $1 ...  [identifier = email || mobile]
  If a user requests a reset with their mobile number, the OTP is stored under their email but queried by mobile — always returns no rows → "Invalid or
  expired OTP". Mobile-number based password reset is broken.

  ---
  3. mobile/lib/services/api_client.dart:37 — ALL 403 responses treated as expired token
  if (msg.contains('invalid token') || msg.contains('token expired')
      || error.response?.statusCode == 403) {  // ← catches ALL 403s
    isTokenError = true;
  }
  "Device limit reached" (403), "No active license" (403), "Channel not available" (403) — all trigger a token refresh attempt, then clearSession() → silent  logout. Users get logged out when they simply lack a license or hit a device limit.

  ---
  🟠 HIGH

  4. backend/src/controllers/authController.js:33-36 — Mobile number not normalized before duplicate check
  const cleanMobile = (mobile || '').replace(/[\s\-+]/g, '');
  // validation passes, but the DB check uses the original `mobile`:
  'SELECT id FROM users WHERE email = $1 OR mobile = $2', [email, mobile]
  // and the INSERT also uses original `mobile` (line 46)
  User with +91 9876543210 and 9876543210 can register twice. Stored and queried value are inconsistent.

  5. backend/src/controllers/paymentController.js:95-156 — Payment verification not idempotent (duplicate license)
  No check whether the payment record is already completed before processing. If Razorpay fires the webhook twice (common retry behavior), two licenses rows  are created for the same payment, and UPDATE payments SET status = 'completed' runs twice harmlessly but the license INSERT runs twice — creating
  duplicate licenses.

  6. backend/src/controllers/adminController.js:171-187 — updateLicense accepts arbitrary user_id with no validation
  'UPDATE licenses SET status=$1, user_id=$2, expires_at=$3 ...'
  [status, user_id, expires_at, id]
  An admin can set user_id to any integer, including a non-existent user. No EXISTS check on users table, so the FK can be silently violated or licenses can  be re-assigned to arbitrary users.

  7. backend/src/app.js:139-144 — Seed data runs on every startup without idempotency tracking
  const sql = fs.readFileSync(seedPath, 'utf8');
  await db.query(sql);  // Runs every boot
  Migrations are tracked in schema_migrations and skipped if already applied. The seed is not tracked — it runs every server restart, potentially creating
  duplicate plans/categories/default data each time.

  8. backend/src/app.js:289-293 — WebSocket initial stats call ignores errors
  dashboardController.getDashboardStats({ user: null }, {
    json: (data) => ws.send(...)
  });
  No await, no .catch(). If getDashboardStats throws (DB down at connect time), the unhandled rejection crashes the WebSocket handler for that client. Also
  req.user is null here — if any controller method accesses req.user.id, it throws.

  9. mobile/lib/cubits/auth_cubit.dart:149-155 — Server 5xx errors silently authenticate users
  } else {
    // Any other error (5xx, unknown) — treat as temporary server issue.
    emit(AuthAuthenticated());  // ← emits authenticated on 500!
  }
  If the backend returns a 500 on /me, the app treats the user as authenticated. A misconfigured server or backend error could let blocked/non-existent
  users into the app.

  10. backend/src/controllers/channelController.js:4-21 — Schema introspection permanently cached on first failure
  let healthStatusColumnExists = null;
  // If DB is unavailable at the first call, caches `false` forever
  healthStatusColumnExists = false;
  If the DB isn't ready when the first channel API call fires, healthStatusColumnExists is permanently false for the process lifetime. Health status queries  are then silently skipped for all subsequent requests even after the DB recovers, causing incorrect/degraded API responses.

  ---
  🟡 MEDIUM

  11. backend/src/controllers/streamController.js:31 — Uses process.env.JWT_SECRET directly (not via jwt.js)
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  Bypasses the verifyToken() wrapper from jwt.js. If the JWT fallback default ('dev-jwt-secret-change-in-production') is in place and JWT_SECRET is unset,
  this is silently insecure. Also, JWT_SECRET could be undefined in environments where the var isn't set — jwt.verify() would throw a misleading error.

  12. backend/src/routes/auth.js — authLimiter (20 req/15min) applied to refresh-token
  Token refresh is a legitimate background operation done automatically by the app. The Flutter app uses a Dio interceptor to refresh on 401s. Under any
  usage pattern with concurrent API calls, 20 refresh attempts per 15 min is very easy to hit, causing cascading 429s and forcing re-login.

  13. backend/src/controllers/proxyController.js:272-274 — Manifest cached with stale encrypted tokens
  // tokens have different IVs per-call (correct)
  // but cache stores ONE set of tokens for `cacheManifest_ms` (8s)
  manifestCache.set(streamId, rewritten);
  Two users hitting the same stream within 8s get the same encrypted tokens — tokens include userId in encryption. Since encryptSegmentUrl(fullUrl,
  streamId, userId) is called with different userIds, the first user's cached manifest (with tokens encrypted for user A) is served to user B. User B's
  segments then fail token decryption with "stream binding" mismatch (if userId is part of the HMAC binding).

  14. mobile/lib/screens/player_screen.dart:1676-1688 — _getBoxFit() fill returns BoxFit.contain
  case 'fill':
    return BoxFit.contain;  // Semantic bug: 'fill' should be BoxFit.fill or BoxFit.cover
  The fill effect is achieved via a separate scale transform, but the BoxFit.contain here means if the scale transform ever fails to apply (e.g., render
  object not yet laid out), fill mode renders identically to fit — invisible to the user but silently wrong.

  15. mobile/lib/screens/player_screen.dart:325-328 — _nextPage calculated incorrectly
  _nextPage = (_contextChannels.length / limit).ceil() + 1;
  With limit = 50 hard-coded locally and channels.length from the passed list (often not 50 exactly), this can compute a page number that skips pages. For
  example, 30 channels → ceil(30/50)+1 = 2 which is correct; but 75 channels → ceil(75/50)+1 = 3, skipping page 2's data.

  16. frontend/src/lib/api.ts:104 — getPayments() fetches without pagination params
  export const getPayments = () => api.get('/payments').then((r) => r.data.data);
  Backend defaults to first 50 payments. Admin payments page only ever shows 50 records regardless of total. Same issue for getLicenses() (line 74) and
  getUsers() (line 59) — pagination exists in backend but ignored in frontend, admin sees incomplete data.

  17. frontend/src/lib/api.ts:273-282 — getStreamHealth, markStreamStatus, recheckStream return full AxiosResponse
  export const getStreamHealth = (params?: ...) =>
    api.get('/stream-health', { params });  // ← returns AxiosResponse, not .data.data
  All other API functions unwrap .then(r => r.data.data). These three return the raw Axios response object, requiring callers to manually unwrap. This
  inconsistency likely causes undefined data rendering in the stream-health admin page.

  18. backend/src/utils/jwt.js:23 — crypto.randomUUID() used without import
  return jwt.sign({ userId, type: 'refresh', jti: crypto.randomUUID() }, ...);
  crypto from Node's built-in is not imported at the top of jwt.js. The db module is imported (line 48) but there's no const crypto = require('crypto').
  This throws ReferenceError: crypto is not defined when generating refresh tokens. (Node 18+ provides globalThis.crypto but crypto.randomUUID() on the
  global is only available in Node 19+. In Node 18, you need require('crypto').randomUUID().)

  19. mobile/lib/services/api_client.dart:9 — ApiClient must call init() before use; no guard
  late Dio _dio;
  // init() sets _dio; getter exposes _dio:
  Dio get dio => _dio;
  If any code instantiates ApiClient and calls dio before calling init(), it throws LateInitializationError: Field '_dio@...' has not been initialized. No
  factory constructor or assertion prevents this.

  ---
  🔵 LOW / CODE QUALITY

  20. backend/src/app.js:126-134 — Migration failures are swallowed, server continues
  } catch (err) {
    console.error(`Migration failed for ${migrationFile}:`, err.message);
    // ← execution continues to next migration
  }
  If 001_initial_schema.sql fails (e.g., syntax error or missing table), later migrations that depend on it silently run against an incomplete schema.
  Consider failing fast or marking bad migrations in a failed state.

  21. backend/src/controllers/adminController.js:327-337 — deleteChannel has no 404 check
  await db.query('DELETE FROM channels WHERE id = $1', [id]);
  // Always returns 200 even if channel doesn't exist
  Unlike deleteCategory which also has no 404 check — deleting a non-existent channel silently succeeds. Should return 404 on rowCount === 0.

  22. mobile/lib/screens/player_screen.dart:1099-1105 — Auto quality upgrade timer not cancelled on channel switch
  _qualityUpgradeTimer = Timer(const Duration(minutes: 3), _tryUpgradeQuality);
  In _onChannelChanged() (line 1544), _qualityUpgradeTimer?.cancel() is NOT called. If you switch channels within 3 minutes of a quality downgrade, the old
  timer fires on the new channel and tries to upgrade quality that may not be appropriate for it.

  23. mobile/lib/screens/player_screen.dart — _VideoController not disposed
  late final VideoController _videoController;
  // dispose() (line 1846) disposes _player but never _videoController
  VideoController is initialized in initState but _videoController.dispose() is missing from dispose(). This can cause memory leaks when navigating back
  from the player.

  24. backend/src/controllers/authController.js — OTP table never cleaned up
  password_reset_otps rows are marked used=true but never deleted. Over time this table grows unboundedly. No cleanup job or TTL-based deletion exists.

  25. frontend/src/contexts/AuthContext.tsx:27 — Admin token in non-httpOnly cookie
  document.cookie = `adminToken=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict`;
  // Not httpOnly — accessible to any JS on the page
  XSS on the admin panel would exfiltrate the admin JWT directly. The comment acknowledges this is intentional (for middleware access), but the admin panel
  has no CSP header configured in next.config.ts to mitigate XSS.

  ---
  Summary Table

  ┌─────┬─────────────┬──────────┬─────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┐
  │  #  │  Severity   │  Layer   │          File           │                                       Issue                                       │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 1   │ 🔴 Critical │ Backend  │ authController.js:230   │ revokeRefreshToken not imported → token refresh crashes with 401 for ALL users    │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 2   │ 🔴 Critical │ Backend  │ authController.js:333   │ Mobile-based password reset always fails (OTP stored by email, queried by mobile) │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 3   │ 🔴 Critical │ Mobile   │ api_client.dart:37      │ All 403s (license/device errors) trigger logout instead of only token expiry      │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 4   │ 🟠 High     │ Backend  │ authController.js:36    │ Mobile number not normalized before duplicate check → duplicate accounts possible │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 5   │ 🟠 High     │ Backend  │ paymentController.js:95 │ Payment verification not idempotent → double license on duplicate webhook         │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 6   │ 🟠 High     │ Backend  │ adminController.js:175  │ updateLicense accepts unvalidated user_id                                         │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 7   │ 🟠 High     │ Backend  │ app.js:139              │ Seed data runs every startup → duplicates categories/plans on restart             │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 8   │ 🟠 High     │ Backend  │ app.js:290              │ WebSocket init stats call unhandled, req.user = null crash risk                   │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 9   │ 🟠 High     │ Mobile   │ auth_cubit.dart:149     │ 5xx server errors authenticate user silently                                      │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 10  │ 🟠 High     │ Backend  │ channelController.js:4  │ Schema flags cached false permanently on first DB failure                         │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 11  │ 🟡 Medium   │ Backend  │ streamController.js:31  │ Direct JWT_SECRET usage bypasses safe wrapper                                     │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 12  │ 🟡 Medium   │ Backend  │ routes/auth.js:10       │ Refresh token rate-limited at 20/15min — blocks legitimate auto-refresh           │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 13  │ 🟡 Medium   │ Backend  │ proxyController.js:272  │ Manifest cache serves one user's encrypted tokens to another user                 │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 14  │ 🟡 Medium   │ Mobile   │ player_screen.dart:1679 │ fill mode maps to BoxFit.contain (semantically wrong)                             │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 15  │ 🟡 Medium   │ Mobile   │ player_screen.dart:325  │ _nextPage computed incorrectly — can skip channel pages                           │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 16  │ 🟡 Medium   │ Frontend │ api.ts:104              │ Payments/licenses/users pages only ever show first 50 records                     │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 17  │ 🟡 Medium   │ Frontend │ api.ts:273              │ Stream health API functions return raw AxiosResponse (inconsistent)               │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 18  │ 🟡 Medium   │ Backend  │ jwt.js:23               │ crypto.randomUUID() used without require('crypto')                                │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 19  │ 🟡 Medium   │ Mobile   │ api_client.dart:9       │ late Dio _dio throws if init() not called before dio getter                       │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 20  │ 🔵 Low      │ Backend  │ app.js:126              │ Failed migration swallowed, server continues with broken schema                   │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 21  │ 🔵 Low      │ Backend  │ adminController.js:327  │ deleteChannel no 404 check, silently succeeds for missing IDs                     │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 22  │ 🔵 Low      │ Mobile   │ player_screen.dart:1099 │ Quality upgrade timer not cancelled on channel switch                             │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 23  │ 🔵 Low      │ Mobile   │ player_screen.dart      │ VideoController never disposed → memory leak                                      │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 24  │ 🔵 Low      │ Backend  │ authController.js       │ OTP table grows unboundedly, no cleanup                                           │
  ├─────┼─────────────┼──────────┼─────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ 25  │ 🔵 Low      │ Frontend │ AuthContext.tsx:27      │ Admin token in JS-accessible cookie, no CSP header                                │
  └─────┴─────────────┴──────────┴─────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘

  ---
  The three most urgent fixes are #1 (token refresh crashes for all users), #3 (403 responses log users out), and #18 (crypto not imported = refresh tokens
  can't be generated). Want me to fix any of these now?