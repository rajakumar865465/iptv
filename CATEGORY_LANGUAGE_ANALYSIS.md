# Phase 1 — Category & Language Filter Analysis (NivaTV)

_Generated from live production data (AWS EC2 `35.154.128.217`, DB `iptv_db`) via the public API._

## 1. How the system works today

**Backend** (`backend/src/controllers/channelController.js`)
- `getChannels` — already treats `categoryId` and `language` as **two independent AND-combined filters** (lines 229–248). This part is essentially correct.
- `getCategories` — returns categories with a live `COUNT` of visible channels; accepts optional `language` param (combined count works).
- `getLanguages` — returns `INITCAP(language)` grouped counts; accepts optional `categoryId` (combined count works).
- `getRelatedChannels` — **buggy**: if `language` is empty it derives it from the category name (`includes('hindi')`…) and finally **defaults to `'Hindi'` for every Indian channel** (line 692). Priority is "same category" then "same language", not "same category+language first".

**Frontend** (Flutter) — fully **data-driven**. `filter_chip_row.dart` + `channel_list_screen.dart` render whatever categories/languages the API returns. Chips already: change category independently, keep category when language changes, have "All"/"All Lang" resets, dynamic counts, preserved filter state, working-only toggle. **No hardcoded "Hindi Entertainment" chips in code** — the wrong labels come entirely from the database.

**Conclusion:** This is ~85% a **data problem**, not a UI problem. Fix the data and most of Tasks 5/6 resolve automatically.

## 2. The actual problem (measured)

Current categories (visible channel counts):

| Category | Count | Problem |
|---|---|---|
| **Hindi Entertainment** | 219 | Garbage dumping bucket (see below) |
| International News | 75 | OK-ish (content), but language-agnostic |
| **Hindi News** | 40 | Language in name |
| Doordarshan | 26 | OK (content type) |
| Lifestyle / Infotainment | 15 | OK |
| **Hindi Movies** | 11 | Language in name |
| Music | 10 | OK |
| **Bengali** | 9 | Language-as-category |
| Kids | 9 | OK |
| Devotional | 8 | OK |
| **Telugu / Kannada / Tamil / Marathi / Punjabi / Malayalam / Gujarati / Odia / Assamese** | ~42 | Language-as-category |
| Sports | 7 | OK |
| **English Movies** | 3 | Language in name |

**"Hindi Entertainment" (219) contains, all falsely tagged `language=Hindi`:**
- **Bengali**: ABP Ananda, Kolkata TV, Tolly TV, Star Jalsha, Ananda Barta
- **Tamil**: Makkal TV, Polimer TV, Thanthi TV, Suriya TV, Vendhar TV, Peppers TV, Puthiya Thalaimurai, Vaanavil
- **Telugu**: Star Maa, HMTV, ETV Andhra/Telangana, 10 TV, 99TV, ABN, SVBC 2/3/4, Subhavaartha
- **Malayalam**: Mazhavil Manorama, Kappa TV, Kaumudy, Jeevan, Amrita, Kairali We, Safari, Shalom
- **Kannada**: Public TV, Power TV, Raj Digital Plus
- **Odia**: Tarang TV, Kalinga TV, Nandighosha, Kanshi
- **Punjabi**: Chardikla, PTC Chakde/Simran, Balle Balle, Apna Punjab, Gaunda Punjab
- **Assamese**: Rengoni, Ramdhenu, Pratidin Time, Pravasi
- **Gujarati**: ABP Asmita, Zee 24 Kalak
- **Urdu**: Munsif, Hyder, Salaam, Zainabia, Tehzeeb, Sana
- **Bhojpuri**: B4U Bhojpuri (already lang=Bhojpuri, wrong category)
- Plus **News** (NDTV 24x7, Republic TV/Bharat, Times Now Navbharat, CNBC TV18, India TV, TV9, IBC24, Reporter TV), **Movies** (Star Gold ×5, Goldmines, Anmol), **Kids** (Animax, Mr Bean, Disney Stories, Nazara), **Music** (9XM, Zoom, Stingray ×6, Qello, MBC Bollywood), **Devotional** (Aastha, Sanskar, Satsang, Sadhna, Angel, Shalom, Harvest, Hebron), **Business** (Zee Business, CNBC Awaaz, ET Now Swadesh).

**Language field is blanket-defaulted to Hindi:** 325 of 469 visible channels = "Hindi", vastly over-counted. Root cause: importers + `fix-channel-categories.js` set `language='Hindi'` as the default for anything Indian.

**Why regional channels show under Hindi:** they carry `language='Hindi'` in the DB (data), so the Hindi language chip returns them. Nothing in the app logic is at fault.

## 3. Root causes
1. `scripts/seed-indian-categories.js` created language-mixed categories (`Hindi Entertainment`, `Hindi Movies`, `Hindi News`, `English News`, `Business News`) **and** language-as-category (`Tamil`, `Telugu`, `Bengali`…).
2. Import scripts + `fix-channel-categories.js` hard-set `language='Hindi'` as the Indian default and used the language-mixed category names.
3. `getRelatedChannels` hardcodes `language='Hindi'` fallback.

## 4. What needs to change
- **Data (main):** create clean global content categories; re-classify every channel's `category_id` by content type; re-detect every channel's `language` from name/tvg_id/canonical_name (stop defaulting to Hindi; use `Unknown` when unclear); retire old mixed/language categories via `is_visible_public=false` (no deletes).
- **Backend logic:** rewrite `getRelatedChannels` priority (same cat+lang → same cat → same lang → popular) and remove the Hindi default. Minor: EPG fallback text references old category names.
- **Frontend:** optionally enforce a canonical chip order + put "Unknown" language last. Counts already dynamic — no fake numbers.

## 5. Data-safety notes
- All changes touch only `channels.category_id`, `channels.language`, and `categories.is_visible_public`/`status`. **No** deletes of channels, streams, favorites, watch_history, users, licenses, payments. Stream URLs untouched. Playback logic untouched.
- Old categories are hidden, not dropped, so any FK references stay valid.

## 6. Blocker
Direct Postgres port (5432) is firewalled to this machine. DB writes must run **on the server** (SSH) or be executed by you. Normalization will be an **idempotent, `--dry-run`-first** node script following the existing `scripts/` pattern.
