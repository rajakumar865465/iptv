# IPTV App Admin Dashboard — Detailed Requirements Document

## 1. Project Context

We have an IPTV Live TV mobile app built with Flutter and a Node.js/Express backend with PostgreSQL database.

The mobile app already includes:

* User signup/login
* License activation
* Live TV channel browsing
* IPTV player
* Search
* Favorites
* Profile
* License status
* Channel categories/language filters
* Stream health checking system
* Indian/regional IPTV channel import system

Now we need to build a professional **Admin Dashboard Web UI** where the app owner can manage:

* Users
* Licenses
* Payments
* Plans
* Channels
* IPTV links
* Stream health
* Channel scan/check jobs
* App settings
* Server status
* Logs/errors
* Reports
* Maintenance/force update/blocked user controls

The admin dashboard should be connected to the existing backend and database. It should not break the current mobile app.

---

# 2. Admin Dashboard Goal

Create a complete web-based admin panel for managing the IPTV business.

The dashboard should allow admin to:

1. See business overview.
2. Manage users and devices.
3. Generate and manage license keys.
4. Track active, expired, suspended, and unused licenses.
5. Manage payment records and manual payment approvals.
6. Add, edit, delete, enable, disable IPTV channels.
7. Add single IPTV links manually.
8. Bulk import M3U/M3U8 playlists.
9. Scan/check channel streams.
10. See broken/offline/unstable channels.
11. Recheck streams manually.
12. Manage categories and languages.
13. View server health, uptime, API errors, request logs.
14. Control app maintenance mode, force update, app version, blocked app access.
15. Manage admin users and permissions.
16. View analytics such as active users, logged-in users, watch activity, top channels, and expired licenses.

---

# 3. Admin Roles and Permissions

## Required Roles

### Super Admin

Full access to everything.

Can:

* Manage admin accounts
* Manage users
* Manage licenses
* Manage payments
* Manage channels
* Delete data
* Change app settings
* View logs
* Run channel scans

### Admin

Can manage daily operations.

Can:

* Manage users
* Create licenses
* Approve payments
* Manage channels
* View reports
* Run channel scans

Cannot:

* Delete admin accounts
* Change critical backend secrets
* Delete full database

### Support Staff

Limited support access.

Can:

* View users
* View licenses
* Check payment status
* Extend/suspend license if allowed
* View logs for a user

Cannot:

* Add IPTV links
* Delete channels
* Change app settings

---

# 4. Admin Authentication

## Admin Login Page

Create separate admin login:

```txt
/admin/login
```

Fields:

* Email
* Password
* Remember me
* Login button

Security:

* JWT-based admin auth
* Admin token separate from normal user token
* Password hashing
* Rate limit login attempts
* Logout button
* Auto logout after session expiry
* Optional 2FA support later

Admin login API:

```txt
POST /api/internal/admin/login
GET /api/internal/admin/me
POST /api/internal/admin/logout
```

---

# 5. Main Dashboard Overview Page

Route:

```txt
/admin/dashboard
```

Show cards:

## Business Stats

* Total users
* Active users
* New users today
* Logged-in users today
* Total licenses
* Active licenses
* Expired licenses
* Unused license keys
* Suspended licenses
* Revenue this month
* Pending payments
* Approved payments

## Channel Stats

* Total channels
* Active channels
* Online channels
* Unstable channels
* Offline channels
* Duplicate/merged channels
* Channels missing logos
* Channels without EPG
* Channels needing recheck

## Server Stats

* Server uptime
* Database status
* API health
* Last deployment time
* Error count today
* Average response time
* Render/server status
* Last channel scan time

## Quick Actions

Buttons:

* Generate license
* Add channel
* Import M3U playlist
* Run channel scan
* View broken channels
* Approve pending payments
* Enable maintenance mode
* Send app notice

---

# 6. User Management

Route:

```txt
/admin/users
```

## User List Table

Columns:

* User ID
* Name
* Email/mobile
* Status
* Active license
* License expiry date
* Devices count
* Last login
* Created date
* Actions

Filters:

* Active users
* Blocked users
* Users with active license
* Users with expired license
* Users without license
* Recently joined
* Search by name/email/mobile

Actions:

* View user
* Edit user
* Block user
* Unblock user
* Reset password
* View devices
* View licenses
* View payments
* View watch history
* Delete user only if Super Admin

## User Detail Page

Route:

```txt
/admin/users/:id
```

Show:

* User profile
* License information
* Device list
* Payment history
* Favorite channels
* Watch history
* Login history
* Support notes

Actions:

* Activate license
* Extend license
* Suspend license
* Block user
* Remove device
* Force logout
* Add admin note

---

# 7. Device Management

Route:

```txt
/admin/devices
```

Show all registered devices.

Columns:

* Device ID
* User
* Device name
* Platform
* App version
* License key
* Last active
* Status

Actions:

* Remove device
* Block device
* Unblock device
* Reset device limit for user

Important:

If a user reaches device limit, admin should be able to remove old devices manually.

---

# 8. License Management

Route:

```txt
/admin/licenses
```

## License List

Columns:

* License key
* Plan
* User assigned
* Status
* Duration
* Max devices
* Activated at
* Expires at
* Created at
* Actions

Filters:

* Active
* Expired
* Unused
* Suspended
* Revoked
* Expiring soon
* Created today
* By plan

Actions:

* Create license
* Bulk generate licenses
* Assign to user
* Extend expiry
* Suspend
* Revoke
* Delete unused license
* Copy license key
* Export CSV

## Generate License Modal

Fields:

* Plan
* Duration days
* Max devices
* Quantity
* Prefix optional
* Expiry after activation
* Notes

Result:

* Generated license keys table
* Copy all
* Download CSV

## License Status Rules

Statuses:

```txt
unused
active
expired
suspended
revoked
pending_payment
```

---

# 9. Plans and Pricing Management

Route:

```txt
/admin/plans
```

Admin can manage subscription plans.

Fields:

* Plan name
* Price
* Duration days
* Max devices
* Description
* Is visible in app
* Status

Example plans:

* 1 Month
* 3 Months
* 6 Months
* 1 Year
* Trial Plan

Actions:

* Create plan
* Edit plan
* Disable plan
* Delete only if unused
* Mark featured plan

---

# 10. Payment Management

Route:

```txt
/admin/payments
```

The app may use manual payment now and payment gateway later.

## Payment List

Columns:

* Payment ID
* User
* Plan
* Amount
* Method
* Status
* Transaction ID / UTR
* Screenshot/proof
* Created at
* Updated at
* Actions

Payment statuses:

```txt
pending
approved
rejected
failed
refunded
```

Actions:

* View payment
* Approve payment
* Reject payment
* Add note
* Activate/generate license after approval
* Upload/see proof
* Export payment report

## Manual Payment Approval Flow

1. User submits payment request/proof.
2. Admin checks proof.
3. Admin approves payment.
4. System creates or activates license automatically.
5. User gets active subscription.

---

# 11. Channel Management

Route:

```txt
/admin/channels
```

This is one of the most important modules.

## Channel List Table

Columns:

* Logo
* Channel name
* Category
* Language
* Quality
* Premium/free
* Status
* Health status
* Health score
* Active stream
* Last checked
* Fail count
* Source
* Actions

Filters:

* Active
* Offline
* Unstable
* Unknown
* Missing logo
* Missing stream
* Premium
* Free
* Category
* Language
* Source
* Search channel name

Actions:

* Add channel
* Edit channel
* Delete/disable channel
* View streams
* Add stream URL
* Recheck stream
* Open stream in player test
* Mark featured
* Mark premium
* Change category/language
* View logs for this channel

---

# 12. Add/Edit Channel Form

Route/modal:

```txt
/admin/channels/new
/admin/channels/:id/edit
```

Fields:

* Channel name
* Display name
* Category
* Language
* Country
* Logo URL
* Local logo upload optional
* Stream URL
* Backup stream URL
* Quality
* Resolution
* Is premium
* Is featured
* Sort order
* Status
* Source
* User-Agent
* Referer
* Notes

Buttons:

* Save channel
* Save and check stream
* Save and add another
* Cancel

Validation:

* Channel name required
* Stream URL required unless inactive target channel
* Category required
* Language required
* Stream URL must be valid HTTP/HTTPS
* Avoid duplicate channel creation

---

# 13. Channel Streams Management

Route:

```txt
/admin/channels/:id/streams
```

Each channel can have multiple stream URLs.

Example:

```txt
Aaj Tak
- 1080p stream
- 720p stream
- 480p stream
- SD backup stream
```

Table columns:

* Stream URL
* Quality
* Resolution
* Bitrate
* Source
* Priority
* Health status
* Health score
* Last checked
* Fail count
* Is primary
* Actions

Actions:

* Add stream
* Edit stream
* Delete stream
* Recheck stream
* Set as primary
* Test play
* Move priority up/down

Important:

Do not create duplicate channel cards for different stream qualities. Store them under one channel.

---

# 14. Bulk Import M3U/M3U8 Playlist

Route:

```txt
/admin/import
```

Admin can import channels from M3U/M3U8 source.

Input options:

* Paste M3U URL
* Upload M3U file
* Paste raw M3U text
* Select source type
* Country filter
* Language filter
* Category mapping

Supported sources:

```txt
iptv-org India playlist
iptv-org API
custom legal M3U playlist
licensed provider playlist
```

Import options:

* Import only Indian channels
* Import only selected languages
* Skip adult channels
* Skip duplicates
* Merge duplicates into channel_streams
* Check streams after import
* Import as inactive first
* Import as pending check
* Auto map categories

After import show report:

* Total parsed
* Inserted channels
* Updated channels
* Duplicate channels merged
* Streams added
* Broken streams
* Missing logo
* Skipped entries
* Import errors

---

# 15. Stream Scanner / Channel Health

Route:

```txt
/admin/stream-scanner
```

Admin can scan streams to check which are working.

## Scanner Features

Buttons:

* Check all channels
* Check selected category
* Check offline channels
* Check unknown channels
* Check one channel
* Stop running scan
* View scan logs

Scanner must deep check HLS:

1. Open M3U8 manifest
2. Check `#EXTM3U`
3. Open variant playlist
4. Fetch media playlist
5. Fetch first 1–2 video segments
6. Confirm segment returns 200/206
7. Mark stream health

Health statuses:

```txt
online
stable
unstable
offline
unknown
timeout
forbidden_403
geo_blocked
drm_or_unsupported
not_hls
segment_failed
requires_licensed_source
```

Scan result table:

* Channel
* Stream
* Previous status
* New status
* Response code
* Reason
* Time taken
* Last checked

Actions:

* Recheck
* Disable
* Set unstable
* Mark online manually
* Add backup stream
* View error details

---

# 16. Broken Channels Page

Route:

```txt
/admin/channels/broken
```

Show channels with problems.

Groups:

* Offline channels
* Unstable channels
* Missing stream URL
* Missing logo
* DRM/unsupported
* Geo-blocked
* 403 forbidden
* Timeout
* Segment failed
* Duplicates
* No active stream
* Requires licensed source

Actions:

* Recheck
* Edit stream
* Add backup
* Disable from app
* Mark as inactive target
* Delete if duplicate

---

# 17. Duplicate Channels Management

Route:

```txt
/admin/channels/duplicates
```

Show duplicate groups like:

```txt
Aaj Tak
- Aaj Tak
- Aaj Tak HD
- Aaj Tak 1080p
```

Admin can:

* View duplicate group
* Select master channel
* Merge duplicates
* Move streams into master channel
* Preserve favorites/watch history
* Delete duplicate rows
* Run auto-dedupe

Important:

User app must show only one channel card per canonical channel.

---

# 18. Categories Management

Route:

```txt
/admin/categories
```

Admin can:

* Add category
* Edit category
* Disable category
* Sort category order
* Upload icon
* See channel count

Fields:

* Name
* Slug
* Icon
* Sort order
* Status

Default categories:

```txt
Hindi Entertainment
Hindi Movies
Hindi News
English News
Business News
Sports
Music
Kids
Devotional
Education
Doordarshan
Tamil
Telugu
Malayalam
Kannada
Bengali
Marathi
Punjabi
Gujarati
Odia
Assamese / North East
Urdu
Bhojpuri
Lifestyle / Infotainment
International News
Free FAST Channels
General
```

---

# 19. Language Management

Route:

```txt
/admin/languages
```

Admin can manage languages shown in app.

Fields:

* Language name
* Code
* Status
* Sort order
* Channel count

Default languages:

```txt
Hindi
English
Bengali
Tamil
Telugu
Malayalam
Kannada
Marathi
Punjabi
Gujarati
Odia
Assamese
Urdu
Bhojpuri
Sanskrit
Unknown
```

---

# 20. App Settings / Remote Config

Route:

```txt
/admin/app-settings
```

Admin can control mobile app behavior remotely.

Settings:

* App maintenance mode on/off
* Maintenance message
* Force update on/off
* Minimum supported app version
* Latest app version
* APK download URL
* Signup enabled/disabled
* Login enabled/disabled
* License activation enabled/disabled
* Payment enabled/disabled
* Trial enabled/disabled
* Default workingOnly filter
* Allow unknown streams
* Show offline channels in app
* Stream retry count
* Buffer timeout seconds
* Default quality
* Data saver default
* Support WhatsApp number
* Support email
* Privacy policy URL
* Terms URL

Mobile app should fetch config:

```txt
GET /api/app/config
```

---

# 21. Server Health / System Monitor

Route:

```txt
/admin/system
```

Show:

* Backend server status
* Server uptime
* Database connection status
* PostgreSQL size
* API request count
* Error count
* Average response time
* Last restart
* Last deployment
* Memory usage
* CPU usage if available
* Disk usage if available
* Render service URL
* Environment mode
* Node version
* App version

Health endpoint:

```txt
GET /api/internal/system/health
```

---

# 22. Logs and Error Monitoring

Route:

```txt
/admin/logs
```

Log types:

* API errors
* Login failures
* Payment actions
* License actions
* Channel import logs
* Stream scan logs
* Playback failure reports
* Admin activity logs
* Server errors

Filters:

* Date range
* Log type
* Severity
* User ID
* Channel ID
* Admin ID

Severity:

```txt
info
warning
error
critical
```

Actions:

* View details
* Download logs
* Clear old logs
* Export CSV/JSON

---

# 23. Playback Analytics

Route:

```txt
/admin/analytics/playback
```

Show:

* Most watched channels
* Channels with most failures
* Average watch duration
* Buffering reports
* Playback failures by device
* Playback failures by network type
* Stream health over time
* Top categories watched
* Active viewers today

Data sources:

* watch_history
* playback_failure_reports
* channel_streams health data

---

# 24. User Analytics

Route:

```txt
/admin/analytics/users
```

Show:

* New users today/weekly/monthly
* Active users
* Logged-in users
* Users with active licenses
* Users with expired licenses
* Churned users
* Device count
* Top regions if available
* App version distribution

---

# 25. License and Payment Analytics

Route:

```txt
/admin/analytics/revenue
```

Show:

* Monthly revenue
* Pending payments
* Approved payments
* Rejected payments
* Active subscriptions
* Expiring soon licenses
* Plan-wise subscriptions
* Revenue by plan

---

# 26. Notifications / App Messages

Route:

```txt
/admin/notifications
```

Admin can create app notices.

Types:

* Info message
* Warning message
* Maintenance notice
* Payment reminder
* License expiry reminder
* New channel update
* App update notice

Target:

* All users
* Active users
* Expired users
* Specific user
* Specific plan

Fields:

* Title
* Message
* Type
* Start date
* End date
* Status

Mobile app should display active notices.

---

# 27. Admin Activity Audit Log

Every admin action should be logged.

Track:

* Admin ID
* Action type
* Target table
* Target ID
* Old value
* New value
* IP address
* User agent
* Timestamp

Examples:

```txt
Admin created license
Admin blocked user
Admin approved payment
Admin added channel
Admin changed stream URL
Admin enabled maintenance mode
Admin ran channel scan
```

---

# 28. UI Design Requirements

Admin dashboard should be professional and modern.

## Theme

* Dark mode default
* Red accent color matching mobile app
* Clean cards
* Responsive layout
* Sidebar navigation
* Topbar with admin profile
* Tables with pagination
* Search and filters
* Status badges
* Charts/cards
* Loading skeletons
* Toast notifications
* Confirmation modals for dangerous actions

## Sidebar Menu

```txt
Dashboard
Users
Devices
Licenses
Plans
Payments
Channels
Channel Streams
Import Playlist
Stream Scanner
Broken Channels
Duplicates
Categories
Languages
App Settings
Notifications
Analytics
Logs
System Health
Admin Users
```

## Status Badge Colors

```txt
active / online / approved -> green
pending / unknown -> yellow
unstable -> orange
offline / expired / rejected -> red
inactive / disabled -> gray
premium -> purple
```

---

# 29. Backend API Requirements for Admin

Create internal admin routes with admin JWT protection.

Base:

```txt
/api/internal
```

All internal APIs require:

```txt
Authorization: Bearer <admin_token>
```

Required route groups:

```txt
/api/internal/dashboard/stats
/api/internal/users
/api/internal/devices
/api/internal/licenses
/api/internal/plans
/api/internal/payments
/api/internal/channels
/api/internal/channel-streams
/api/internal/import
/api/internal/scanner
/api/internal/categories
/api/internal/languages
/api/internal/app-settings
/api/internal/notifications
/api/internal/analytics
/api/internal/logs
/api/internal/system
/api/internal/admin-users
```

---

# 30. Data Safety Rules

Admin dashboard must not accidentally destroy data.

Rules:

* Never delete channels permanently by default; use disabled/inactive.
* Never delete users with active licenses without confirmation.
* Dangerous actions require confirmation modal.
* Bulk delete requires typing confirmation.
* Keep audit logs.
* Backups should be recommended before running destructive imports.
* Migrations must be idempotent.
* Import scripts must not wipe channels unless explicitly requested.

---

# 31. Required Reports

Generate downloadable reports:

* Users CSV
* Active licenses CSV
* Expired licenses CSV
* Payments CSV
* Channel list CSV
* Broken channels CSV
* Stream scan report JSON
* Import report JSON
* Duplicate channel report JSON
* Revenue report CSV

---

# 32. Testing Checklist

## Dashboard

* Stats load correctly.
* Counts match database.
* Server status is correct.

## Users

* Search user.
* Block/unblock user.
* View user license/devices.

## Licenses

* Generate one license.
* Generate bulk licenses.
* Activate license in mobile app.
* Expire/suspend license.

## Payments

* Create pending payment.
* Approve payment.
* Confirm license activation.

## Channels

* Add channel manually.
* Edit channel.
* Add stream URL.
* Disable channel.
* Recheck channel.
* Confirm mobile app updates.

## Import

* Import M3U URL.
* Dedupe channels.
* Check stream health.
* Confirm only working unique channels show in app.

## Stream Scanner

* Run full scan.
* Run category scan.
* Recheck one stream.
* Confirm health status updates.

## App Settings

* Enable maintenance mode.
* Mobile app shows maintenance screen.
* Enable force update.
* Mobile app shows force update screen.

## Logs

* Admin action appears in audit log.
* Playback failure appears in logs.
* Stream scan errors appear in logs.

---

# 33. Acceptance Criteria

Admin dashboard is complete when:

* Admin can login securely.
* Admin can see full business overview.
* Admin can manage users and devices.
* Admin can create, extend, suspend, revoke licenses.
* Admin can approve/reject payments.
* Admin can manage plans.
* Admin can add/edit/disable channels.
* Admin can add multiple streams per channel.
* Admin can import M3U/M3U8 playlists.
* Admin can scan and recheck streams.
* Admin can see broken/offline/unstable channels.
* Admin can merge duplicate channels.
* Admin can manage categories/languages.
* Admin can control app settings remotely.
* Admin can see server health and uptime.
* Admin can view API errors, playback errors, and logs.
* Admin can see analytics and reports.
* Mobile app data updates correctly after admin changes.
