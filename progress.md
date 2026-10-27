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
- **Production APK v2.8.0 Release Synchronization (August 2026):**
  - Synchronized Semantic Versioning across the entire ecosystem: `v2.8.0` (versionCode `28`).
  - Updated `mobile/pubspec.yaml`, `mobile/lib/constants.dart` (`AppConstants.appVersion = '2.8.0'`), and in-app profile views.
  - Added Database Migration `056_update_app_release_v28.sql` and backend runner `scripts/run-056.js` to update public API release metadata (version `2.8.0`, size `32.5 MB`, minimum Android `5.0+`).
  - Compiled and hosted optimized `app-release.apk` (32.5 MB) and `app-release-32bit.apk` (29.3 MB).
- **Legal Pages Redesign & Contrast Upgrade (August 2026):**
  - Completely redesigned `Privacy Policy` (`/privacy`) and `Terms & Conditions` (`/terms`) with clean SaaS document styling.
  - Resolved low-contrast and dark text issues: All text now renders with crisp high contrast (`text-slate-200` / `text-white`).
  - Added sticky Table of Contents sidebar for seamless section navigation.
  - Integrated the Open-Source Content Indexing & DMCA Takedown Disclaimer into Section 2 of the official policy body without intrusive alert banners.
- **Google Search Console Merchant Listings Fix (August 2026):**
  - Resolved "Merchant listings: 1 invalid item detected" in Google Search Console on `/pricing`.
  - Enriched `Product` and `Offer` Schema.org JSON-LD with mandatory Merchant listing properties: product image array (`/opengraph-image.jpg`, `/logo.png`), SKU/MPN identifiers, `priceValidUntil`, `itemCondition: NewCondition`, `hasMerchantReturnPolicy` (7-day full refund window), and digital `shippingDetails` (₹0 immediate delivery).
- **Admin Panel Bulk M3U Channel Importer Fix (September 2026):**
  - Resolved `Failed to parse M3U: Content does not look like a valid M3U playlist` crash when pasting multiple M3U URLs or plain stream links in `/channel-import`.
  - Upgraded backend `channelImportController.parseAndCreateSession` to automatically detect URL lists in pasted content or bulk URL fields, safely fetch all playlists in parallel, deduplicate streams, and insert in parameter-safe chunked batches (200 items per query).
  - Added language auto-detection from ISO code playlist URLs (e.g. `bho.m3u` -> `Bhojpuri`, `tam.m3u` -> `Tamil`, `tel.m3u` -> `Telugu`, `urd.m3u` -> `Urdu`, `ory.m3u` -> `Odia`, `hin.m3u` -> `Hindi`).
  - Upgraded frontend admin import UI with a multi-URL textarea, dynamic URL counter, quick language preset buttons (Hindi, Bhojpuri, Tamil, Telugu, Urdu, Odia, Bengali, Punjabi), and a 1-click "Load Indian Pack" button.
- **Google Sign-In Loop & Authentication Fix (September 2026):**
  - **Identified Core Failure Causes:**
    1. Silent exception swallowing in `AuthCubit`: `errorStr.contains('canceled')` was catching Credential Manager code 16 / Account reauth failures and silently emitting `AuthInitial()`, returning to the login screen with zero error message.
    2. Missing timeout: In Android Credential Manager, delayed callbacks left `state is AuthLoading` active indefinitely ("came same state again loading").
    3. Missing pre-sign-in session clearing: Google Sign-In v7+ requires `signOut()` prior to `authenticate()` to avoid stale credential reuse.
    4. Missing access token fallback: If `idToken` was empty, the app did not request authorization scopes for an `accessToken`.
  - **Mobile App Upgrades:**
    - Upgraded `mobile/lib/cubits/auth_cubit.dart` with pre-clear `signOut()`, 40s timeout protection on `authenticate()`, 25s timeout on server API call, and fallback to `authorizationForScopes(['email', 'profile', 'openid'])` to obtain `accessToken`.
    - Differentiated genuine user dismissals from configuration/Google Play Services rejections (`code: 16`, `developer_error`, `reauth failed`) so users receive actionable messages.
    - Added dedicated visual loading spinners (`isGoogleLoading`) to both `LoginScreen` and `SignupScreen` on the "Sign in with Google" button.
    - Updated `mobile/android/app/google-services.json` to map both Android OAuth client IDs (`u2lfb2qm...`, `tkp8rhpq...`) and certificate fingerprints (Release `2f8d2f60...`, Debug `387bf637...`).
  - **Backend Upgrades:**
    - Upgraded `backend/src/controllers/googleAuthController.js` to verify ID tokens against all project audiences (`activeClientId`, `DEFAULT_GOOGLE_CLIENT_ID`, and Android client IDs) with deduplication.
  - **Compiled Production Release APKs:**
    - Recompiled production split APKs with `BACKEND_URL=https://nivatv.luxomall.in` (`app-release.apk` 33.0 MB, `app-release-32bit.apk` 29.8 MB) and copied to `backend/public/downloads/`.
- **Payment Flow Auth Guard & Login Screen Integration (October 2026):**
  - **Plan Card "Start Watching" Interception:** Updated `PlanCard.tsx` so clicking "Start Watching Instantly" (or any plan CTA) checks if the user is authenticated first. If unauthenticated, it blocks navigation and opens `AuthModal`. Upon successful authentication, it seamlessly navigates to `/payment?plan_id=...` (or `/checkout?plan=...`).
  - **Payment & Checkout Pages Protection:** Enforced auth gates on `/payment` and `/checkout`. Unauthenticated visitors are presented with a dedicated "Sign In Required" view with auto-opening `AuthModal` rather than the payment or UPI submission forms.
  - **AuthModal Capabilities Upgrade:** Enhanced `AuthModal.tsx` to support Google Sign-In, Email & Password (login and register), and Phone OTP, connecting directly into `AuthContext` with instant global state synchronization.
  - **Scratch Card Offer Protection:** Updated `ScratchCardModal.tsx` to verify authentication prior to redirecting to discounted payment checkout.
- **AuthModal Adaptive Light & Dark Mode (October 2026):**
  - Integrated `next-themes` (`useTheme()`) into `frontend/src/components/auth/AuthModal.tsx`.
  - Configured high-contrast adaptive classes for modal background, headers, input fields, action buttons, Google login button, and backdrop overlay, ensuring crisp readability in both light and dark themes.
- **Pricing Plans Deduplication Bugfix (October 2026):**
  - **Identified Cause:** In `frontend/src/app/(public)/pricing/page.tsx`, `dedupePlans()` was previously deduplicating plans using `${plan.duration_days}-${plan.price === 0 ? 'free' : 'paid'}`. Because both the "Starter" plan (₹49) and "Pro" plan (₹79) shared a 30-day duration, the "Pro" plan was erroneously dropped.
  - **Fix:** Switched deduplication to `plan.id` and updated sorting to respect `sort_order` and price. Updated `PlanCard.tsx` to display custom plan descriptions when provided and refined variant resolution so non-popular 30-day plans don't falsely claim the "Most Popular" badge.
- **Payment Gateway Proxy Redirect Fix (October 2026):**
  - **Identified Cause:** When completing payment on `/payment`, the browser was redirected to `https://luxomall.pdf-cropper.site/api/proxy/checkout`, an obsolete domain that was unreachable (`ERR_CONNECTION_CLOSED`).
  - **Fix:** Updated `frontend/src/app/(public)/payment/page.tsx` to redirect to `/api/proxy/checkout` on the active site origin (`https://nivatv.luxomall.in/api/proxy/checkout`), which is served with valid HTTPS and proxies to the Express backend. Also updated `mobile/lib/screens/proxy_checkout_screen.dart` to use `BackendConfig.baseUrl`.
  - Rebuilt and restarted `iptv-frontend` on EC2.

- **Admin Dashboard Login Redirect Loop Bugfix (October 2026):**
  - **Identified Root Causes:**
    1. In `frontend/src/middleware.ts`, `ADMIN_JWT_SECRET` was absent from `frontend/.env.local`, causing Next.js to fall back to a random dynamic secret in memory. The edge middleware failed token verification and responded with `307 Temporary Redirect` back to `/login?redirect=%2Fdashboard`.
    2. In `frontend/src/contexts/AuthContext.tsx`, `login(token)` triggered `fetchProfile(token)` hitting `/api/auth/me`. Because backend `authMiddleware` previously only checked user tokens (`JWT_SECRET`), it rejected admin tokens with `401 Unauthorized`, triggering `AuthContext` to wipe the `adminToken` cookie and localStorage.
    3. In `frontend/src/app/login/page.tsx`, `loginAdmin` did not supply user data to `login()` and used client router navigation which didn't wait for cookie synchronization.
    4. In `frontend/src/middleware.ts`, role verification did not explicitly allow `superadmin`.
  - **Fixes Applied:**
    - Updated `backend/src/middleware/auth.js` so both `authMiddleware` and `optionalAuth` accept `verifyAdminToken` fallback, allowing `/api/auth/me` to authenticate admins seamlessly.
    - Updated `frontend/src/contexts/AuthContext.tsx` with a strict `401` status guard in `fetchProfile` to prevent unwanted session clearing.
    - Updated `frontend/src/app/login/page.tsx` to pass the admin payload to `login(token, admin)` and use `window.location.href = '/dashboard'` for atomic cookie-first navigation.
    - Updated `frontend/src/middleware.ts` to allow both `admin` and `superadmin` roles, and use predictable fallback secret.
    - Added `ADMIN_JWT_SECRET` to `frontend/.env.local` on the server and rebuilt frontend.

- **1-Month Free Trial Pro Plan (₹0) Implementation (October 2026):**
  - Added Migration `062_create_one_month_free_trial.sql` creating the `Pro Free Trial` plan (`₹0`, 30 Days, 1 Device, `plan_tier = 'pro'`, `regular_price = 79.00`, `offer_label = '100% FREE TRIAL'`).
  - Added `has_claimed_trial BOOLEAN DEFAULT FALSE` to `users` table to enforce a strict one-trial-per-account limit and prevent abuse.
  - Created `ensureUserTrial(userId)` in `subscriptionService.js` to auto-provision an active 30-day Pro license and ₹0 order for eligible users upon signup or login.
  - Integrated trial auto-activation across all auth flows: standard email/password login and signup (`authController.js`), Google OAuth (`googleAuthController.js`), phone OTP login (`otpAuthController.js`), and mobile app status sync (`licenseController.js`).
  - Enforced abuse-prevention guards in `publicController.createOrder` to block repeated free trial claims for the same user or email.
  - Enhanced frontend UI:
    - Added dedicated `'free-trial'` emerald theme and badge in `PlanCard.tsx`, displaying regular price `₹79` crossed out alongside `₹0` Free.
    - Expanded pricing grid in `pricing/page.tsx` (`lg:grid-cols-4`) to accommodate all 4 plans seamlessly.
    - Updated checkout and payment flow in `payment/page.tsx` for instant 1-click free trial claiming.
- **Unified Auto-Detecting Pro Card & 3-Tier Grid Layout (October 2026):**
  - Consolidated duplicate "Pro Free Trial" (₹0) and "Pro" (₹79) cards into a single intelligent `<UnifiedProCard />` component on the pricing page.
  - Automatically detects the user's trial status:
    - New or anonymous visitors see the 1-Month Free Trial (`₹0` with `₹79` strikethrough, 1 Device, "Claim 1-Month Free Trial" CTA) along with a clean interactive toggle pill to optionally choose 2 Devices for ₹79/month.
    - Returning logged-in users who already claimed their trial automatically see the paid Pro plan (`₹79/month`, 2 Devices, "Start Watching Instantly" CTA) with trial claiming locked.
    - Updated paid Pro mode styling to clean white / neutral surface theme (neutral tag, crisp dark price, green checkmarks, clean neutral button, removed top red banner) ensuring clear visual differentiation from the pink/red "Most Popular" Starter plan.
  - Re-balanced the Pricing page into a standard 3-tier SaaS grid (`Starter` ₹49 | `Pro` Unified | `Plus` ₹699) with no wrapping or duplicate tier cards.
  - Updated backend user profile endpoints (`/api/auth/me`, `/login`, `/signup`) to return `has_claimed_trial` in real-time.
