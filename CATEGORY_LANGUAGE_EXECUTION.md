# Category & Language Normalization — Execution Guide

All code + the normalization engine are complete and validated against the live
469-channel catalog. The only remaining step is **running the DB normalization on
the server** (my sandbox can reach the API but not Postgres:5432, and SSH auth is
being rejected from here — see "SSH note" below).

## What was built

| File | Purpose |
|---|---|
| `backend/scripts/lib/channel-classifier.js` | Pure classifier: name/tvg_id/canonical → `{category, language}` with confidence. Never defaults to Hindi. |
| `backend/scripts/normalize-categories-languages.js` | Idempotent, dry-run-capable DB normalizer (single transaction) + report/review generator. Retires old categories with `status='inactive'` (CHECK-constraint-safe), never deletes. |
| `backend/src/controllers/channelController.js` | `getRelatedChannels` rewritten (4-tier priority, no Hindi default); language chips sort `Unknown` last; EPG fallback text de-languaged. |
| `mobile/lib/screens/channel_list_screen.dart` | Canonical language chip order (`Unknown` last). |
| `mobile/lib/screens/home_screen.dart` | `hindi entertainment` → `entertainment` in ordering maps. |
| `mobile/lib/screens/player_screen.dart` | EPG fallback text de-languaged. |

The 13 global content categories (created/normalized with this exact chip order):
`Doordarshan, Entertainment, Movies, News, Sports, Music, Devotional, Kids, Education, Business, Regional, Lifestyle, General`.

## Full runbook (on the server)

```bash
cd /home/ubuntu/iptv && git pull        # pull backend + script changes

# ── A. Deploy backend code (getRelatedChannels rewrite, language sort, EPG text)
cd backend
pm2 restart iptv-backend                # no new npm deps

# ── B. Normalize the data
# 1. DRY RUN — writes nothing, prints before/after + review CSVs to scripts/output/
node scripts/normalize-categories-languages.js --dry-run
# 2. Review scripts/output/review-*.csv (Unknown language, low-confidence category)
# 3. APPLY (single transaction; only category_id + language + categories table touched)
node scripts/normalize-categories-languages.js

# ── C. Verify via the public API (21 combos, counts, related, Hindi purity)
node scripts/verify-filters.js          # expect "N passed, 0 failed"

# ── D. (optional) rebuild the mobile app for the chip-order tweaks
#      cd ../mobile && flutter build apk --dart-define=BACKEND_URL=http://35.154.128.217
```

The normalizer is idempotent (safe to re-run) and does **not** touch stream_url,
channel_streams, favorites, watch_history, users, licenses, payments, or playback.
Category/language chips update immediately after step B (counts are read live);
the backend restart in step A is what activates the related-channels + sort changes.

`verify-filters.js` runs from anywhere with API access (`API_BASE=... node scripts/verify-filters.js`).

## Projected result (from the live 469 visible channels)

**Category (after):** News 107 · Regional 75 · General 66 · Devotional 50 · Music 35 ·
Doordarshan 26 · Movies 25 · Entertainment 22 · Lifestyle 22 · Business 18 · Kids 14 ·
Sports 7 · Education 2. *(No more "Hindi Entertainment / Hindi News / Hindi Movies / English News".)*

**Language (after):** English 111 · Unknown 109 · **Hindi 62** (was 325) · Telugu 46 ·
Tamil 26 · Bengali 19 · Malayalam 19 · Punjabi 19 · Urdu 14 · Kannada 13 · Odia 9 ·
Assamese 8 · Marathi 7 · Gujarati 5 · Bhojpuri 1 · Nepali 1.

**Review lists** (`backend/scripts/output/`): ~109 Unknown-language and ~141
low-confidence-category channels for optional manual review. These are safe defaults
(General/Regional/Unknown), not wrong guesses.

## SSH note

From this environment the server **accepts** the `iptv_rsa` public key (it is in
`authorized_keys`) but rejects the signature, even after forcing SHA-2 and SHA-1.
`iptv_rsa_new` is also rejected. This usually means the sandbox egress IP isn't the
one the key/host expects, or the keys were rotated server-side. Running the two
commands above from your own machine (where deploys already work) will succeed.
