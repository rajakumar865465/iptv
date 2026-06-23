# Requirements Document: Flutter IPTV Live TV APK with License System and Future Admin Control Support

## 1. Project Overview

Build a **Flutter Android IPTV Live TV APK** that allows users to watch live TV channels using IPTV/HLS/M3U8 streams.

The app will support:

* User signup and login
* License key activation
* Monthly/limited-time access
* License expiry system
* Payment status support
* Smooth live TV player
* User-friendly UI like JioTV
* Backend-controlled app behavior
* Future admin dashboard support

The **admin website/dashboard will be created later**, but the app and backend must be prepared so the admin can control users, licenses, payments, channels, and app settings in the future.

The app must only use IPTV streams that the owner has legal rights to distribute.

---

# 2. Project Scope

## 2.1 Version 1 Scope

Version 1 will include:

* Flutter Android mobile app
* Backend server
* Database
* User authentication
* License activation
* License expiry validation
* IPTV channel loading from backend
* Category loading from backend
* Favorites
* Watch history
* Payment instruction/status support
* Remote app settings support
* Internal admin-support APIs

## 2.2 Not Included in Version 1

The following features are not required in the first version:

* Full admin website
* Advanced analytics dashboard
* Automatic payment gateway
* Stream health dashboard
* Android TV app
* iOS app
* Smart TV app

These can be added later.

---

# 3. Main Objective

The main objective is to create a professional IPTV app where:

1. User installs the APK.
2. User signs up or logs in.
3. User activates the app using a license key.
4. Backend validates the license.
5. User watches live TV if the license is active.
6. User is blocked if license expires.
7. Backend controls all important app behavior.
8. Future admin website can connect to the backend without rebuilding the mobile app.

---

# 4. User Types

## 4.1 Normal User

A normal user can:

* Sign up
* Log in
* Activate license
* Watch live TV
* Search channels
* Add favorites
* View license status
* Renew after expiry

## 4.2 Expired User

An expired user can:

* Log in
* View expiry message
* See renewal/payment instruction
* Contact support

An expired user cannot:

* Watch live TV
* Open premium channels

## 4.3 Blocked User

A blocked user cannot access the app content.

The app should show:

```txt
Your account has been blocked. Please contact support.
```

## 4.4 Admin / App Owner

The admin website will be created later, but backend must support admin control such as:

* Manage users
* Block/unblock users
* Generate license keys
* Expire/suspend/revoke licenses
* Manage channels
* Manage categories
* Manage payment status
* Control maintenance mode
* Control force update
* Control app settings

---

# 5. Mobile App Requirements

## 5.1 Splash Screen

The splash screen should:

* Show app logo
* Show loading animation
* Check login status
* Check license status
* Check backend app config
* Check maintenance mode
* Check force update
* Check user status
* Check device status

Navigation logic:

```txt
If not logged in → Login screen
If app is in maintenance → Maintenance screen
If app version is old → Force update screen
If user is blocked → Blocked account screen
If license is missing → License activation screen
If license is expired → Renewal screen
If license is active → Home screen
```

---

## 5.2 Onboarding Screen

The app should show onboarding for new users.

Example onboarding slides:

1. Watch live TV anywhere
2. Smooth HD IPTV experience
3. Activate with license key
4. Enjoy premium channels

Buttons:

* Next
* Skip
* Get Started

---

## 5.3 Signup Screen

Users should be able to create an account.

Required fields:

* Full name
* Email
* Mobile number
* Password
* Confirm password

Validation:

* Email must be valid
* Mobile number must be valid
* Password must be secure
* Email/mobile must be unique
* User must accept Terms and Privacy Policy

After signup:

* User account is created
* User goes to license activation screen

---

## 5.4 Login Screen

Users should be able to log in.

Required fields:

* Email/mobile
* Password

Features:

* Show/hide password
* Remember login
* Forgot password
* Error messages
* Blocked account detection

---

## 5.5 Forgot Password

User should be able to reset password using:

* Email OTP, or
* Mobile OTP, or
* Password reset link

MVP can support email-based reset first.

---

# 6. License System Requirements

## 6.1 License Activation

User must activate the app using a license key.

Flow:

1. User enters license key.
2. App sends key to backend.
3. Backend validates key.
4. Backend activates license.
5. App unlocks live TV access.

Backend must check:

* License key exists
* License is not expired
* License is not revoked
* License is not suspended
* License is unused or assigned to this user
* User is not blocked
* Device limit is not exceeded

---

## 6.2 License Status

License statuses:

* Active
* Expired
* Suspended
* Revoked
* Trial
* Pending payment
* Blocked

The app must show:

* Plan name
* License status
* Activation date
* Expiry date
* Remaining days
* Max device limit

---

## 6.3 License Expiry

License expiry must be handled from the backend.

Rules:

* App must not trust phone date/time.
* Backend must decide license validity.
* App must check license on app start.
* App must check license before playing a channel.
* Expired user cannot watch live TV.
* Expired user should see renewal screen.

Expired message example:

```txt
Your license has expired. Please renew your plan to continue watching live TV.
```

---

## 6.4 License Duration Types

Backend should support:

* 1 day trial
* 7 days
* 15 days
* 1 month
* 3 months
* 6 months
* 1 year
* Custom duration

---

# 7. Device Control Requirements

To prevent license sharing, backend should support device control.

Requirements:

* App sends device ID during login/license activation.
* Backend stores device information.
* License can have max device limit.
* If device limit is reached, app should block new device.
* Backend should support removing/blocking devices later.

Device data:

* Device ID
* Device name
* Android version
* App version
* Last active time
* User ID
* License ID
* Status

Device limit message:

```txt
Device limit reached. Please contact support or remove an old device.
```

---

# 8. Home Screen Requirements

Home screen should look premium and user-friendly like JioTV.

Home sections:

* User greeting
* License status badge
* Remaining days
* Search bar
* Featured channels
* Categories
* Recently watched
* Favorites
* Popular channels
* Continue watching

Bottom navigation:

* Home
* Live TV
* Search
* Favorites
* Profile

UI style:

* Dark theme
* Smooth animations
* Rounded cards
* Channel logos
* Live badges
* Shimmer loading
* Fast transitions

---

# 9. Channel Requirements

## 9.1 Channel List

Channels must come from backend API.

The app must not hardcode channel data.

Each channel should have:

* Channel name
* Channel logo
* Stream URL
* Backup stream URL
* Category
* Language
* Quality
* Status
* Featured status
* Premium/free status
* Sort order

---

## 9.2 Channel Categories

Categories should come from backend.

Example categories:

* News
* Sports
* Movies
* Music
* Kids
* Entertainment
* Regional
* Religious
* Education
* Documentary
* International

---

## 9.3 Channel Visibility

Backend should control channel visibility.

If backend marks a channel as hidden or disabled:

* It should not appear in the app, or
* It should show unavailable status

This allows future admin dashboard to control channels without app update.

---

# 10. Live TV Player Requirements

The app must include a smooth IPTV player.

Player must support:

* M3U8/HLS streams
* Full-screen mode
* Landscape mode
* Auto-rotate
* Play/pause
* Buffering loader
* Retry on failure
* Auto-reconnect
* Next channel
* Previous channel
* Favorite button
* Channel name overlay
* Error message if stream fails

Recommended Flutter packages:

* Better Player
* Video Player
* Chewie
* ExoPlayer integration if needed

Stream error message:

```txt
This channel is currently unavailable. Please try again later.
```

---

# 11. Search Requirements

Search should allow users to search channels by:

* Channel name
* Category
* Language

Search should be fast and smooth.

---

# 12. Favorites Requirements

Users should be able to:

* Add channel to favorites
* Remove channel from favorites
* View favorite channels
* Sync favorites with backend

Favorites should be linked to the user account.

---

# 13. Watch History Requirements

The app should store watch history.

Backend should track:

* User ID
* Channel ID
* Watched time
* Watch duration

App should show:

* Recently watched channels
* Continue watching section

---

# 14. Profile Requirements

Profile screen should show:

* Full name
* Email
* Mobile number
* Account status
* License status
* Plan name
* Expiry date
* Remaining days
* Linked devices
* Support contact
* Logout button

---

# 15. Payment Support Requirements

## 15.1 MVP Payment Support

In the first version, payment can be manual.

The app should show:

* Available plans
* Plan price
* Plan duration
* Payment instructions
* UPI details or QR code
* WhatsApp/contact support button
* Payment pending status
* Payment completed status

Admin can later confirm payment from backend/admin website.

---

## 15.2 Future Automatic Payment

Later, app can support:

* Razorpay
* Stripe
* UPI payment gateway
* Auto license generation
* Auto payment verification

---

# 16. Remote App Control Requirements

The backend must support remote app control even before admin website is built.

App should fetch remote config from backend.

Remote settings:

* Maintenance mode
* Force update
* Minimum app version
* Signup enabled/disabled
* Payment enabled/disabled
* Trial enabled/disabled
* Support WhatsApp number
* Support email
* Privacy policy URL
* Terms URL
* App announcement message
* Banner message
* Ads enabled/disabled
* Player settings

---

## 16.1 Maintenance Mode

If backend enables maintenance mode, app should show:

```txt
App is under maintenance. Please try again later.
```

Users should not access live TV during maintenance.

---

## 16.2 Force Update

If app version is below minimum version, app should show:

```txt
A new version is required. Please update the app to continue.
```

User should not continue until app is updated.

---

## 16.3 Signup Control

If backend disables signup:

* Signup button should be hidden or disabled.
* App should show message:

```txt
New registration is currently closed.
```

---

# 17. Backend Requirements

The backend must be built in Version 1.

Recommended stack:

* Node.js with Express or NestJS
* PostgreSQL database
* JWT authentication
* Redis cache optional
* Firebase Cloud Messaging optional
* Cloud storage for logos optional

Backend must handle:

* User authentication
* License validation
* License expiry
* Device control
* Channel data
* Category data
* Favorites
* Watch history
* Payment status
* App remote config
* Internal admin-support APIs

---

# 18. API Requirements

## 18.1 Auth APIs

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
GET  /api/auth/me
```

## 18.2 App Control APIs

```txt
GET /api/app/config
GET /api/app/status
GET /api/app/version-check
```

## 18.3 License APIs

```txt
POST /api/license/activate
GET  /api/license/status
POST /api/license/validate
GET  /api/license/history
```

## 18.4 Channel APIs

```txt
GET /api/channels
GET /api/channels/:id
GET /api/channels/search?q=
GET /api/channels/category/:categoryId
GET /api/categories
```

## 18.5 User APIs

```txt
GET    /api/user/profile
PUT    /api/user/profile
GET    /api/user/favorites
POST   /api/user/favorites/:channelId
DELETE /api/user/favorites/:channelId
GET    /api/user/watch-history
GET    /api/user/devices
```

## 18.6 Payment APIs

```txt
GET  /api/plans
GET  /api/payments/status
POST /api/payments/manual-request
GET  /api/payments/history
```

## 18.7 Internal Admin-Support APIs

These are not for public users. These APIs will later connect to the admin website.

```txt
POST /api/internal/admin/login

GET  /api/internal/users
GET  /api/internal/users/:id
PUT  /api/internal/users/:id/status

POST /api/internal/licenses/create
GET  /api/internal/licenses
GET  /api/internal/licenses/:id
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
DELETE /api/internal/categories/:id

GET  /api/internal/app-settings
PUT  /api/internal/app-settings

GET  /api/internal/payments
PUT  /api/internal/payments/:id/status
```

---

# 19. Database Requirements

## 19.1 Users Table

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

## 19.2 Licenses Table

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

## 19.3 Plans Table

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

## 19.4 Devices Table

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

## 19.5 Channels Table

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

## 19.6 Categories Table

Fields:

* id
* name
* icon_url
* status
* sort_order
* created_at
* updated_at

---

## 19.7 Payments Table

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

## 19.8 Favorites Table

Fields:

* id
* user_id
* channel_id
* created_at

---

## 19.9 Watch History Table

Fields:

* id
* user_id
* channel_id
* watched_at
* watch_duration

---

## 19.10 App Settings Table

Fields:

* id
* setting_key
* setting_value
* updated_at

Example setting keys:

```txt
maintenance_mode
force_update
minimum_app_version
signup_enabled
payment_enabled
trial_enabled
support_whatsapp
support_email
privacy_policy_url
terms_url
announcement_message
```

---

# 20. Security Requirements

Security requirements:

* Passwords must be hashed with bcrypt.
* Use JWT authentication.
* Use HTTPS APIs.
* Do not trust local phone time for license expiry.
* Validate license from server.
* Use device binding.
* Add API rate limiting.
* Protect internal admin APIs.
* Do not expose secret keys in the app.
* Do not allow frontend to manually unlock license.
* Payment status must be changed only from backend/internal admin APIs.
* Stream URLs should be protected where possible.
* Use legal IPTV streams only.

---

# 21. Required App Screens

MVP screens:

1. Splash screen
2. Onboarding screen
3. Login screen
4. Signup screen
5. Forgot password screen
6. License activation screen
7. Home screen
8. Live TV channel list screen
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

# 22. UI/UX Requirements

The app should feel like a premium live TV app.

Design style:

* Dark theme
* Smooth animation
* JioTV-like layout
* Rounded channel cards
* High-quality channel logos
* Fast loading
* Shimmer loaders
* Live badges
* Modern bottom navigation
* Clean typography
* Full-screen video experience

The app should be simple and easy for normal users.

---

# 23. Future Admin Website Requirements

The admin website will be created later.

It will use the backend APIs created in Version 1.

Future admin website will include:

* Admin login
* Dashboard
* User management
* License management
* Payment management
* Plan management
* Channel management
* Category management
* Device management
* App settings control
* Maintenance mode control
* Force update control
* Notification management
* Analytics
* Stream health monitoring

---

# 24. Acceptance Criteria

The project is complete when:

* User can sign up and log in.
* User can activate license key.
* Backend validates license correctly.
* Expired license blocks live TV.
* Active license allows live TV.
* App loads channels from backend.
* App plays M3U8/HLS streams.
* User can search channels.
* User can add favorites.
* User can view profile and license status.
* Backend supports remote app settings.
* Backend supports future admin control APIs.
* App supports maintenance mode.
* App supports force update screen.
* App supports blocked user screen.
* App supports device limit check.
* App has smooth and modern UI.

---

# 25. Final Developer Instruction

Build the Flutter Android IPTV app and backend first. Do not build the full admin website now.

However, make sure the backend and app are ready for future admin control. The app must fetch user status, license status, payment status, channel list, category list, and app settings from the backend.

Nothing important should be hardcoded in the app. Future admin website should be able to control the app without rebuilding the APK.

