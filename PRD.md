# Updated PRD: Flutter IPTV Live TV APK with License System and Future Admin Control Support

## 1. Product Summary

This project is a **Flutter Android IPTV live TV app** where users can watch live TV channels using IPTV/HLS/M3U8 streams.

The first version will focus on the **mobile app and backend system**. The full admin website/dashboard will be created later, but the app and backend must already support admin-controlled features such as:

* User access control
* License activation
* License expiry
* Channel control
* Payment status control
* App update control
* Maintenance mode
* Subscription status
* Device limit control
* Remote app settings

The app should look modern, smooth, animated, and user-friendly like JioTV.

Important: The app must only use legal IPTV/live TV streams that the owner has permission to distribute.

---

# 2. Main Goal

The main goal is to build a professional IPTV mobile APK where:

1. User installs the app.
2. User signs up or logs in.
3. User activates a license key.
4. Server verifies the license.
5. If license is active, user can watch live TV.
6. If license expires, app blocks access.
7. App receives all control settings from the backend.
8. Future admin website can control the app without changing the app code.

---

# 3. Important Scope Update

## Admin Website Status

The **admin website/dashboard is not required in the first version**.

It will be created later.

## But Backend Must Support Admin Control

Even though the admin website will be built later, the backend must already have the data structure and APIs to support admin control.

For now, admin actions can be managed through:

* Backend database
* Backend API
* Simple protected admin API endpoints
* Manual database update
* Postman/API testing
* Temporary internal tools

Later, a proper admin website will be connected to the same backend APIs.

---

# 4. System Parts

## Version 1 Required

1. Flutter Android App
2. Backend Server
3. Database
4. License System
5. IPTV Channel API
6. Remote App Control API
7. Payment Status Support

## Version 2 Later

1. Full Admin Website
2. Advanced analytics dashboard
3. Stream health dashboard
4. Bulk license management UI
5. Payment dashboard
6. User management dashboard

---

# 5. Flutter App Requirements

## 5.1 Splash Screen

The splash screen must check important backend data before opening the app.

Checks:

* Is user logged in?
* Is license active?
* Is app under maintenance?
* Is app version allowed?
* Is user blocked?
* Is device allowed?
* Is payment completed?
* Are channels available?

Based on backend response, app redirects user to the correct screen.

Example logic:

* Not logged in → Login screen
* Logged in but no license → License activation screen
* License expired → Renewal/expired screen
* App maintenance active → Maintenance screen
* Old app version → Force update screen
* User blocked → Blocked account screen
* License active → Home screen

---

## 5.2 Signup and Login

The app must support:

* Signup
* Login
* Logout
* Forgot password
* Profile loading from backend

Signup fields:

* Full name
* Email
* Mobile number
* Password
* Confirm password

Login fields:

* Email/mobile
* Password

Backend should return:

* User ID
* Access token
* User status
* License status
* Device status

---

## 5.3 License Activation

The user must activate the app with a license key.

The license key is generated from the server side.

Activation flow:

1. User enters license key.
2. App sends key to backend.
3. Backend validates the key.
4. Backend checks user and device.
5. Backend activates the license.
6. App unlocks live TV access.

Backend must check:

* License key exists
* License is unused or assigned to this user
* License is not expired
* License is not revoked
* License is not suspended
* Device limit is not exceeded
* User account is not blocked

After activation, backend returns:

* License status
* Plan name
* Activation date
* Expiry date
* Remaining days
* Max device limit

---

## 5.4 License Expiry Handling

The app must check license status from the server.

Rules:

* App must not depend only on phone date/time.
* Backend decides if license is active or expired.
* Expired users cannot watch live TV.
* Expired users should see renewal screen.
* App should show remaining days when license is active.
* App should check license status when app opens.
* App should check license status before playing a channel.

License statuses:

* Active
* Expired
* Suspended
* Revoked
* Pending payment
* Trial
* Blocked

---

## 5.5 Home Screen

The home screen should be clean, premium, and user-friendly.

Home screen sections:

* User greeting
* Active license badge
* Remaining days
* Search bar
* Featured channels
* Categories
* Recently watched channels
* Favorites
* Popular channels
* Continue watching

Bottom navigation:

* Home
* Live TV
* Search
* Favorites
* Profile

---

## 5.6 Channel List

The app must show channels from backend API.

Each channel should show:

* Channel logo
* Channel name
* Category
* Language
* Quality badge
* Live badge
* Favorite icon

Channel filters:

* Category
* Language
* HD/SD
* Favorite
* Search

The app should not hardcode channels locally. Channels must come from backend so that future admin can control them.

---

## 5.7 Live TV Player

The app must have a smooth IPTV player.

Player features:

* M3U8/HLS support
* IPTV stream support
* Full-screen mode
* Landscape mode
* Play/pause
* Buffering loader
* Retry button
* Auto-reconnect
* Next channel
* Previous channel
* Favorite button
* Channel name overlay
* Error screen if stream fails

Recommended packages:

* Better Player
* Video Player
* Chewie
* ExoPlayer integration if needed

---

## 5.8 Favorites

Users should be able to add channels to favorites.

Favorites should sync with backend.

Features:

* Add favorite
* Remove favorite
* Favorite list
* Sync after login
* Favorite data linked to user account

---

## 5.9 Search

Search should allow users to find channels quickly.

Search by:

* Channel name
* Category
* Language

---

## 5.10 Profile Screen

Profile screen should show:

* User name
* Email
* Mobile number
* Account status
* License status
* Plan name
* Expiry date
* Remaining days
* Linked devices
* Logout button
* Support option

---

## 5.11 License Status Screen

This screen should show full license details.

Details:

* License key
* Plan name
* Status
* Activation date
* Expiry date
* Remaining days
* Max devices
* Current device status
* Renewal message

If expired:

* Show “Your license has expired”
* Show “Please renew to continue watching”
* Show contact/payment option

---

## 5.12 Payment Support in App

The app should support payment flow, even if full automatic payment is added later.

Version 1 payment support:

* Show available plans from backend
* Show price
* Show payment instructions
* Show UPI/WhatsApp/contact support button
* Show payment pending status
* Show payment completed status
* Unlock only after backend confirms payment or license activation

Version 2 payment support:

* Razorpay
* Stripe
* UPI gateway
* Auto license generation after successful payment

---

# 6. Future Admin Control Support

The app must be designed so future admin website can control the app remotely.

The app should receive all important settings from backend.

## 6.1 User Control Support

Backend must support:

* Active user
* Blocked user
* Suspended user
* Expired user
* Trial user
* Paid user

App behavior:

* If user is blocked, app shows blocked screen.
* If user is suspended, app blocks live TV.
* If user is expired, app shows renewal screen.
* If user is active, app allows live TV.

---

## 6.2 License Control Support

Backend must support:

* Create license
* Activate license
* Expire license
* Suspend license
* Revoke license
* Extend license
* Assign license to user
* Limit device count

App behavior:

* App checks license status from backend.
* App shows correct status.
* App blocks access if license is not active.

---

## 6.3 Channel Control Support

Backend must support:

* Add channel
* Update channel
* Delete channel
* Hide channel
* Show channel
* Change stream URL
* Add backup stream URL
* Change logo
* Change category
* Mark featured channel
* Mark premium/free channel

App behavior:

* App fetches latest channel list from backend.
* Hidden channels should not appear.
* Updated channels should update without app release.
* Disabled channels should show unavailable or disappear.

---

## 6.4 App Settings Control Support

Backend must support remote app settings.

Settings:

* Maintenance mode
* Force update
* Minimum app version
* Signup enabled/disabled
* Trial enabled/disabled
* Payment enabled/disabled
* Support WhatsApp number
* Support email
* Privacy policy URL
* Terms URL
* App announcement
* Banner message
* Player settings
* Ads enabled/disabled

App behavior:

* If maintenance mode is on, app shows maintenance screen.
* If force update is on, app shows update screen.
* If signup is disabled, app hides signup option.
* If payment is disabled, app hides payment button.
* If announcement exists, app shows banner.

---

## 6.5 Payment Control Support

Backend must support:

* Manual payment record
* Payment pending status
* Payment completed status
* Payment failed status
* Payment refunded status
* Plan pricing
* Plan duration
* Plan visibility

App behavior:

* User sees plans from backend.
* User sees payment status.
* User gets access only after payment/license is active.
* Admin can later update payment status from admin website.

---

## 6.6 Device Control Support

Backend must support:

* Device binding
* Max device limit
* Remove device
* Block device
* Allow device
* Track last active device

App behavior:

* App sends device ID to backend.
* Backend checks if device is allowed.
* If device limit is reached, app shows device limit message.
* If device is blocked, app blocks access.

---

# 7. Backend Requirements

The backend is required in Version 1.

Even without admin website, backend must be ready for admin control.

## 7.1 Backend Main Responsibilities

Backend must handle:

* User authentication
* JWT token system
* License activation
* License validation
* License expiry
* User status
* Device control
* Channel list
* Category list
* Favorites
* Watch history
* App settings
* Payment status
* Plan list
* Remote app control

---

## 7.2 Backend APIs

### Auth APIs

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
GET  /api/auth/me
```

### App Control APIs

```txt
GET /api/app/config
GET /api/app/status
GET /api/app/version-check
```

### License APIs

```txt
POST /api/license/activate
GET  /api/license/status
POST /api/license/validate
GET  /api/license/history
```

### Channel APIs

```txt
GET /api/channels
GET /api/channels/:id
GET /api/channels/search?q=
GET /api/channels/category/:categoryId
GET /api/categories
```

### User APIs

```txt
GET    /api/user/profile
PUT    /api/user/profile
GET    /api/user/favorites
POST   /api/user/favorites/:channelId
DELETE /api/user/favorites/:channelId
GET    /api/user/watch-history
GET    /api/user/devices
```

### Payment APIs

```txt
GET  /api/plans
GET  /api/payments/status
POST /api/payments/manual-request
GET  /api/payments/history
```

### Temporary Admin-Support APIs

These APIs will be used later by the admin website.

For now, they can be protected and used through Postman/internal tools.

```txt
POST /api/internal/admin/login

GET  /api/internal/users
PUT  /api/internal/users/:id/status

POST /api/internal/licenses/create
GET  /api/internal/licenses
PUT  /api/internal/licenses/:id
POST /api/internal/licenses/:id/extend
POST /api/internal/licenses/:id/suspend
POST /api/internal/licenses/:id/revoke

POST /api/internal/channels
GET  /api/internal/channels
PUT  /api/internal/channels/:id
DELETE /api/internal/channels/:id

POST /api/internal/categories
GET  /api/internal/categories
PUT  /api/internal/categories/:id

GET  /api/internal/app-settings
PUT  /api/internal/app-settings

GET  /api/internal/payments
PUT  /api/internal/payments/:id/status
```

---

# 8. Database Requirements

## 8.1 Users Table

Fields:

* id
* full_name
* email
* mobile
* password_hash
* status
* created_at
* updated_at
* last_login_at

---

## 8.2 Licenses Table

Fields:

* id
* license_key
* plan_id
* user_id
* status
* duration_days
* max_devices
* activated_at
* expires_at
* created_at
* updated_at

---

## 8.3 Plans Table

Fields:

* id
* name
* price
* duration_days
* max_devices
* description
* status
* is_visible
* created_at
* updated_at

---

## 8.4 Devices Table

Fields:

* id
* user_id
* license_id
* device_id
* device_name
* platform
* app_version
* status
* last_active_at
* created_at

---

## 8.5 Channels Table

Fields:

* id
* name
* logo_url
* stream_url
* backup_stream_url
* category_id
* language
* quality
* status
* is_featured
* is_premium
* sort_order
* created_at
* updated_at

---

## 8.6 Categories Table

Fields:

* id
* name
* icon_url
* status
* sort_order
* created_at
* updated_at

---

## 8.7 Payments Table

Fields:

* id
* user_id
* plan_id
* license_id
* amount
* currency
* payment_method
* transaction_id
* status
* paid_at
* created_at
* updated_at

---

## 8.8 App Settings Table

Fields:

* id
* setting_key
* setting_value
* updated_at

Example settings:

* maintenance_mode
* force_update
* minimum_app_version
* signup_enabled
* payment_enabled
* trial_enabled
* support_whatsapp
* support_email
* privacy_policy_url
* terms_url
* announcement_message

---

## 8.9 Favorites Table

Fields:

* id
* user_id
* channel_id
* created_at

---

## 8.10 Watch History Table

Fields:

* id
* user_id
* channel_id
* watched_at
* watch_duration

---

# 9. Mobile App Screens

## Required MVP Screens

1. Splash screen
2. Onboarding screen
3. Login screen
4. Signup screen
5. Forgot password screen
6. License activation screen
7. Home screen
8. Live TV channel list
9. Category screen
10. Search screen
11. Favorites screen
12. Live TV player screen
13. Profile screen
14. License status screen
15. Payment/renewal instruction screen
16. Maintenance screen
17. Force update screen
18. Blocked account screen
19. Device limit reached screen

---

# 10. Security Requirements

Security requirements:

* Passwords must be hashed.
* Use JWT authentication.
* Use HTTPS APIs.
* License validation must happen on server.
* App must not trust phone time for expiry.
* Device binding should be used.
* API rate limiting should be added.
* Stream URLs should be protected where possible.
* Admin/internal APIs must be protected.
* App config API must not expose secret data.
* Payment status must only be changed from backend/internal admin APIs.
* User cannot unlock license from frontend only.

---

# 11. MVP Scope

## MVP Includes

* Flutter Android app
* Backend server
* Database
* Signup/login
* License key activation
* License expiry check
* Channel list from backend
* Category list from backend
* Live TV player
* Favorites
* Profile
* Payment instruction page
* Remote app settings support
* User status control support
* Device limit support
* Internal admin-support APIs

## MVP Does Not Include

* Full admin website
* Advanced analytics dashboard
* Automatic payment gateway
* Stream health dashboard
* Bulk license UI
* Android TV version
* iOS version

---

# 12. Later Version: Admin Website

The admin website will be built later.

It will connect to the backend APIs already created in MVP.

Future admin website features:

* Admin login
* Dashboard stats
* User management
* License management
* Payment management
* Channel management
* Category management
* App settings control
* Maintenance mode control
* Force update control
* Notification management
* Device management
* Analytics
* Stream health monitoring

Because the backend already supports these controls, the admin website can be added later without rebuilding the mobile app.

---

# 13. User Journey

## New User

1. User installs APK.
2. User opens app.
3. User signs up.
4. User enters license key or follows payment instructions.
5. Backend activates license.
6. User opens home screen.
7. User watches live TV.

## Active User

1. User opens app.
2. App checks backend config.
3. App checks license status.
4. App loads channels.
5. User watches TV.

## Expired User

1. User opens app.
2. Backend says license expired.
3. App shows renewal screen.
4. User renews license or contacts support.
5. Backend updates license.
6. App unlocks access again.

## Blocked User

1. User opens app.
2. Backend says user is blocked.
3. App shows blocked message.
4. User cannot access live TV.

---

# 14. Developer Build Prompt

Build a Flutter Android IPTV live TV app with backend support for future admin control.

In the first version, do not build the full admin website. Build the Flutter app, backend, database, license system, channel APIs, payment status support, and remote app control APIs. The backend must be designed so that a full admin dashboard can be added later without changing the mobile app.

The Flutter app must include signup, login, license activation, license expiry check, home screen, channel list, category filter, search, favorites, profile, payment instruction screen, and a smooth IPTV live TV player with M3U8/HLS support.

The app must fetch all channels, categories, user status, license status, payment status, and app settings from the backend. Nothing important should be hardcoded in the app. The app must support remote control from backend, including maintenance mode, force update, signup enabled/disabled, payment enabled/disabled, blocked user, expired license, suspended license, device limit, and hidden channels.

The backend must include user authentication, JWT auth, license key activation, server-side license expiry, device binding, channel management APIs, category APIs, app config APIs, payment status APIs, and protected internal admin-support APIs that can later be connected to a full admin website.

The app should have a premium, smooth, dark-themed, animated UI similar to JioTV. The live TV player should support full-screen mode, landscape mode, buffering loader, retry on stream failure, next/previous channel, and favorite button.

Do not build the admin dashboard now, but make the full backend and app ready for admin control in the future.
