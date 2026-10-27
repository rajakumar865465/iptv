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

- **Full-Stack Security Audit, Hardening & Vulnerability Remediation (October 2026):**
  - **Brute-Force & OTP Guessing Protection (OWASP A07):** Added attempt counters and strict lockout thresholds (max 5 failed attempts -> 429 Too Many Requests and immediate token/OTP invalidation) to password reset (`authController.resetPassword`) and mobile phone OTP verification (`otpAuthController.verifyOtp`). Added migration `063_secure_otp_attempts.sql` with safe DO block.
  - **JWT Hardening & Algorithm Confusion Prevention:** Enforced `{ algorithms: ['HS256'] }` across all token verifications in `backend/src/utils/jwt.js` and `frontend/src/middleware.ts` (jose `jwtVerify`).
  - **Server Fingerprint Elimination:** Disabled `X-Powered-By` header in both Express (`backend/src/app.js`) and Next.js (`frontend/next.config.ts`).
  - **Information Disclosure & Error Masking:** Sanitized error responses across `channelImportController`, `channelStreamController`, `planController`, `scannerController`, `googleAuthController`, and `errorHandler.js` so database schema, file paths, and raw queries are never leaked to clients in production.
  - **SSRF Prevention:** Enforced `assertSafeUrl` and `safeFetch` in `scannerController.js` and `m3u_import_engine.js` to block internal IP and cloud metadata endpoints (`169.254.169.254`, `127.0.0.1`, RFC 1918) from stream scanners and background playlist importers.
  - **Admin Access Control & Privilege Hardening:**
    - Validated admin account status: Suspended/blocked admins are rejected with `403 Forbidden` (`adminController.adminLogin`).
    - Whitelisted admin roles (`admin`, `superadmin`, `moderator`, `support`) and enforced strict password length (8+ chars) with duplicate email collision prevention in `adminUserController.js`.
    - Normalized email inputs (`toLowerCase().trim()`) across admin and user authentication.
  - **Client-Side Security Headers:** Injected `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")` in `frontend/next.config.ts`.
  - **PostgreSQL Database Ownership Alignment:** Reassigned ownership of all tables and sequences in `iptv_db` to the application user `iptvdb`, resolving migration runner ownership conflicts and ensuring continuous zero-downtime boots.
  - **Verification:** Both `iptv-backend` and `iptv-frontend` are verified online, healthy, and operational on EC2 (`44.206.18.189`) with database connected and public API responses verified.

- **Full-Website Light/Dark Theme Visibility & High-Contrast Bugfix (October 2026):**
  - **Identified Root Cause:** In light mode (`[data-theme='light']`), pages like `/my-account`, `/payment/pending`, `/browse`, and components had hardcoded `text-white` or dark card wrappers directly on off-white backgrounds (`bg-[var(--color-base)] = #FAFAF8`). As a result, page headings ("My Account", "Active Licenses", "Quick Actions") and action buttons ("Try Again", "Reveal/Copy") were rendered as white text on white backgrounds, making them completely invisible.
  - **Comprehensive Visibility Overhaul:**
    - **My Account Page (`/my-account`):** Replaced all hardcoded `text-white` and `bg-slate-900` classes with semantic theme tokens (`text-[var(--color-ink)]`, `text-[var(--color-ink-muted)]`, `bg-[var(--color-surface)]`, `border-[var(--color-line)]`, `shadow-card`). Headings, subtitles, empty state cards, license cards, and Quick Actions cards now render with high-contrast, crisp typography in both light and dark modes.
    - **License Key Display Component (`LicenseKeyDisplay.tsx`):** Upgraded container to `bg-[var(--color-surface-2)]` and buttons ("Reveal" and "Copy") to `bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-line)]`, eliminating white-on-white text and invisible buttons.
    - **Pending Order Verification (`/payment/pending/[orderId]`):** Updated "Try Again" button from `bg-[var(--color-surface)] text-white` to `bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20` for a high-contrast primary CTA.
    - **Payment Failed Page (`/payment/failed`):** Corrected primary CTA inside `bg-red-600` from `text-[var(--color-ink)]` to `text-white shadow-lg shadow-red-600/20` to prevent dark-on-dark text in light mode.
    - **Channel Browse Page (`/browse`):** Updated active category button pill from `bg-brand-500 text-[var(--color-ink)]` to `bg-brand-500 text-white` for crisp contrast against red background.
    - **Pricing Page (`/pricing`):** Fixed recommendation strip border to use dynamic `border-[var(--color-line)]`.
  - **Deployed & Verified:** Compiled cleanly locally and on EC2 VPS (`44.206.18.189`). Reloaded `iptv-frontend` via PM2. Verified HTTP 200 and visual contrast across `https://nivatv.luxomall.in/my-account`.

- **Free Trial Pro Card Visibility Restriction for Claimed Users (October 2026):**
  - **Identified Root Causes:**
    1. In the database, when free trial orders were created with an unauthenticated session or email, `user_id` on the license remained `NULL` and `users.has_claimed_trial` remained `false` (e.g. `superadmin@nivatv.in` had claimed license 38 for plan 64, but `has_claimed_trial` in `users` table was `false`).
    2. Endpoint `/api/auth/me` and `/admin/login` only returned `users.has_claimed_trial` without cross-checking existing licenses or public orders, leading the frontend to treat returning claimants as eligible for another free trial.
    3. In `UnifiedProCard.tsx`, the component defaulted to `'trial'` mode and rendered free trial elements (green "1-Month Free Trial" banner, "100% FREE TRIAL" pill, "1 Device • ₹0 Free Trial" toggle, and "Claim 1-Month Free Trial" CTA) before or whenever `hasClaimedTrial` was not strictly enforced.
  - **Comprehensive Fixes Applied:**
    - **Backend Self-Healing & Trial Association:**
      - Updated `authController.me` to automatically inspect `licenses` and `public_orders` by both user ID and email. If a user has any trial license or free order, it atomically updates `users.has_claimed_trial = true`, associates orphaned licenses/orders, and returns `has_claimed_trial: true`.
      - Updated `adminController.adminLogin` to verify and return `has_claimed_trial: true` for admin users.
      - Updated `publicController.createOrder` to auto-link `userId` and set `has_claimed_trial = true` whenever an order for ₹0 is submitted.
      - Executed database healing query on EC2 linking license 38 to user ID 2 (`superadmin@nivatv.in`) and setting `has_claimed_trial = true`.
    - **Frontend Strict Pro Card Rendering for Claimed Users:**
      - Updated `UnifiedProCard.tsx`: For any user who has claimed the trial (`hasClaimedTrial === true` or stored in `localStorage`), the card strictly renders as the Paid Pro plan (`₹79/month`, 2 Devices, "Start Watching Instantly" CTA) with zero free trial elements:
        - The green "1-Month Free Trial" top banner is hidden.
        - The "100% FREE TRIAL" badge is hidden.
        - The "1 Device • ₹0 Free Trial" toggle pill is completely removed.
        - The awkward amber "Trial Already Claimed" badge is replaced with a clean "2 Devices Access" badge.
        - Price cleanly displays `₹79 /month` without strikethroughs.
        - CTA strictly directs to paid checkout (`/payment?plan_id=63` or `/checkout?plan=63`).
      - Updated `AuthContext.tsx` to persist `nivatv_trial_claimed: 'true'` in `localStorage` upon profile fetch and login, and clear on logout.
      - Updated `payment/page.tsx` so users who already claimed the trial do not see the free trial option in the plan selector dropdown, and any direct navigation to `?plan_id=64` auto-redirects to the paid Pro plan (`id: 63`).
  - **Deployed & Verified:** Synced backend and frontend to EC2 (`44.206.18.189`). Rebuilt Next.js cleanly (56/56 pages static/dynamic) and reloaded `iptv-backend` and `iptv-frontend` via PM2. Live endpoint `https://nivatv.luxomall.in/pricing` verified HTTP 200.

- **Homepage Pricing Cards Alignment & Free Trial Elimination for Claimed Users (October 2026):**
  - **Identified Root Cause:** The Homepage (`frontend/src/app/page.tsx`) previously did not use `<PricingGrid />`. Instead, it sliced the raw public plans (`plans.slice(0, 3)`) and directly mapped them to `<PlanCard />`. Because Plan 64 (`Pro Free Trial`) was among the top 3 sort order plans, the Homepage always rendered the raw "Pro Free Trial" card alongside the paid "Pro" card, regardless of whether the user was logged in and had already claimed or purchased the trial.
  - **Comprehensive Fixes Applied:**
    - **Homepage Integration (`frontend/src/app/page.tsx`):** Replaced the static `top3.map` with `<PricingGrid plans={plans} paymentMode={paymentMode} />`, aligning the Homepage pricing tier section with the exact same intelligent, auto-detecting card system as `/pricing`.
    - **Defense-in-Depth Guard in `PlanCard.tsx`:** Added an automatic safety filter in `PlanCard.tsx` so that if `plan.price === 0` and `hasClaimedTrial` is detected (from `AuthContext` or `localStorage`), the card returns `null` and is never rendered to claimed users.
    - **Immediate State Initialization in `UnifiedProCard.tsx`:** Updated `UnifiedProCard.tsx` to initialize `mode` to `'paid'` and `hasClaimedTrial` to `true` synchronously during state declaration whenever the user or `localStorage` indicates trial claim status, preventing any visual hydration flicker.
  - **Deployed & Verified:** Rebuilt frontend locally and on EC2 VPS (`44.206.18.189`). Reloaded `iptv-frontend` via PM2 (PID 295228). Verified HTTP 200 on live URL `https://nivatv.luxomall.in/`.
