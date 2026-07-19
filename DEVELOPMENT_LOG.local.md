# FrazerPTA — Development Log (local)

> **Local-only note:** This file is for your machine. It is not intended to be committed or pushed to GitHub unless you choose to later.

**Project:** Frazer School PTA static website with Supabase-backed submissions, admin review, and GitHub Pages deploy.  
**Repo:** `xi10017/tfspta`  
**Primary branch for workflow work:** `feature/submission-workflow` (aligned with `main` for much of the history)

---

## Stage 0 — Initial static site (commit `bd93db0`)

**Goal:** Multi-page PTA site for middle school, high school, and district-wide content.

**What existed:**
- Static HTML build via `build_html.js` and custom tags (`<site-header>`, `<page-hero>`, etc.)
- Pages: home, competitions, clubs, calendar, announcements, about, contacts, submit
- Spreadsheet-driven content from `TFS Activities.xlsx` via Python import
- Placeholder PTA/office info on contacts page
- No database, no auth, no submission workflow

**Architecture:** Pure static site. All “live” listings were baked into HTML at build time from Excel.

---

## Stage 1 — Competitions template / TS experiment (commits `98b2cc0`, `68402eb`)

**Goal:** Generate competitions page from TypeScript/array data instead of Python-only import.

**What changed:**
- `site-competitions.ts` and TS execution in `build_html.js` (`runTsFiles`)
- Array-based system for `<site-competitions>` template

**Problems introduced:**
- Every `npm run build` could **overwrite** `site-competitions.html` with full spreadsheet rows
- This conflicted with later “DB-only live listings” direction
- Became a recurring regression source after merges from `main`

**Resolution (later):** TS generator removed; `build_html.js` reverted to simple tag resolution only (commit `02c61c8`).

---

## Stage 2 — Submission workflow foundation (commit `1bbfebb`)

**Goal:** Parents submit announcements, events, competitions, and clubs → admin approves → content goes live.

**Major additions:**

### Database (`supabase/schema.sql`)
- Tables: `profiles`, `submissions`, `published_*` (announcements, events, competitions, clubs)
- Enums: `submission_status`, `content_type`, `submission_intent`
- Row Level Security (RLS) on all tables
- `is_admin()` security-definer function
- Signup trigger `handle_new_user()` → creates `profiles` row with role `parent`
- Public read on published tables; admin-only write on published content
- Submissions: users insert/read own; admins read/update all

### Frontend modules
| Area | Files |
|------|-------|
| Auth | `auth.js`, `reset-password.js`, `auth-reset-request.js`, `auth-change-password.js` |
| Submit | `submit.js`, `submission-form.js`, `submission-workflow.js` |
| Admin | `admin.js`, inbox / live / rejected / archive tabs |
| Publish | `submission-publish.js` — approve → insert/update published rows |
| Live pages | `announcements-live.js`, `calendar-live.js`, `competitions-live.js`, `clubs-live.js` |
| Pending UI | `pending-live.js` — ghost previews for user’s pending items |
| Versions | `published-versions.js`, `supabase/published-item-versions.sql` |
| Archive | `submission-archive.js`, `submission-events.js` |

### Intents
- `create` — new item
- `edit_published` — change request against live item (with `target_published_*_id` columns)
- `update_pending`, `resubmit` — edit while in queue / after rejection

### Build / config
- `supabase-config.example.js` → copy to gitignored `supabase-config.js`
- `supabase-client.js` loads config; rejects placeholder values

**Design choice:** Competitions/clubs page shells stay in templates (category nav, empty lists); live rows injected by JS from Supabase after approval — not from spreadsheet at build time.

---

## Stage 3 — GitHub Pages + Supabase secrets (commits `899c82b`–`e547c75`)

**Goal:** Deploy static `dist/` via GitHub Actions with Supabase config injected at deploy time.

**Workflow:** `.github/workflows/deploy-pages.yml`
1. Checkout, Node 20, Python 3.12
2. `npm run build:ci`
3. `scripts/write-supabase-config.mjs` — writes `dist/assets/supabase-config.js` from secrets
4. Verify config exists and has no `YOUR_PROJECT` placeholder
5. Upload artifact → deploy-pages

**Required secrets:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (legacy JWT `eyJ…` or publishable key after later fix)

**Config notice:** `config-notice.js` — different messages for localhost vs `github.io` vs wrong `/dist/` URL

**Pages source:** Must be **GitHub Actions**, not “Deploy from a branch” (old branch deploy served `/tfspta/dist/...` without injected config).

**Important:** Anon key in deployed `supabase-config.js` is **public by design** — protection is RLS, not hiding the key.

---

## Stage 4 — Duplicate-on-edit bug (multiple iterations)

**Symptom:** Editing an approved competition/club created a **second** live row instead of updating in place.

**Root causes:**
1. Republish logic sometimes inserted instead of updating when intent/target ID was wrong
2. `enforceApprovedPublishedSync` could republish stale approved `create` submissions
3. Static spreadsheet rows + live rows could coexist visually
4. Merge from `main` reintroduced full spreadsheet HTML on competitions page

**Fixes:**
- Unified `publishCatalogItem()` in `submission-publish.js` — update in place for `edit_published`
- `submissionAlreadyOnSite()` to skip stale sync republish
- `removeDuplicatePublishedRows`, `cleanupPublishedCatalogDuplicates` on admin load
- Dedupe in `static-entry-supersede.js`, `published-live.js`
- `contextual-submit.js` — use `edit_published` when target published ID is known
- `static_entry_id` columns (`supabase/published-static-entry-id.sql`) for legacy static entry mapping

---

## Stage 5 — Merge regression: spreadsheet clutter + calendar (commits `02c61c8`, `6cfc955`)

**Symptom:** After merging `main`, competitions page showed full spreadsheet again; calendar felt missing or broken.

**Cause:** `site-competitions.ts` + TS runner in `build_html.js` restored from `main`, overwriting empty DB-first template on every build.

**Fixes:**
- Deleted `site-competitions.ts`
- Reverted `build_html.js` to simple version (no `runTsFiles`)
- `import_activities.py` writes **empty** category shells only; spreadsheet rows not written to public site
- Calendar: always show month grid even with zero events (`calendar-live.js`)
- Hide static calendar fallback (`calendar-static-fallback` hidden)

---

## Stage 6 — UI polish (commit `eb2c94f`)

**Long text overflow:** CSS in `styles.css` so announcement/event/competition/club card text wraps instead of overflowing horizontally.

---

## Stage 7 — “Setup required” banner returns (session ~Jun 2026)

**Symptom:** Submit/admin pages showed “Setup required” even when config existed.

**Causes identified:**
1. **Local:** `supabase-config.js` used `sb_publishable_…` key; client only accepted `eyJ…` JWT
2. **GitHub Pages:** Usually fine if secrets set and Actions deploy used; live config at `/tfspta/assets/supabase-config.js` had correct JWT
3. Wrong URL (`/dist/` path from old branch deploy)
4. Stale deploy before secrets added

**Fixes:**
- `supabase-client.js` — accept both `eyJ…` and `sb_publishable_…`
- Clearer `config-notice.js` copy for local vs Pages
- Deploy workflow fails loudly if secrets missing

**User responsibilities (not automatic):**
- Run SQL migrations in Supabase SQL Editor (`schema.sql`, published tables, versions, archive, events, etc.)
- Promote first admin via `supabase/promote-admin.sql`
- Auth URL config for password reset on Pages

---

## Stage 8 — Announcements placeholders + calendar UX (commit `54253c6`)

### Announcements
**Symptom:** Demo cards (“Book fair volunteers…”) still visible on announcements page.

**Cause:** `site-announcements.html` had static fallback; `announcements-live.js` showed it when DB empty or Supabase unconfigured.

**Fix:** Removed `#announcements-static-fallback` HTML and all fallback show/hide logic. Page shows Supabase data or empty message only.

### Calendar — campus filter broken
**Cause:** `<select data-action="cal-campus-filter">` listened to **click** before value updated; `renderPage()` replaced DOM and reset filter.

**Fix:** Separate handlers — `click` for month/day buttons only; `change` on `#calendar-campus-filter`.

### Calendar — missing arrow buttons
**Cause:** `.btn-secondary` styled for blue hero (white text/border) — invisible on white calendar background.

**Fix:** `.calendar-controls .btn-secondary` overrides for light background; `←` / `→` / **Today** labels.

**Pushed:** `54253c6` to `feature/submission-workflow`.

---

## Stage 9 — Performance / static HTML question (not implemented)

**Question:** Can site be faster by incorporating static HTML from `main`?

**Answer documented:**
- `main` and feature branch already use **empty** shells for competitions/clubs at build time
- Old spreadsheet HTML was fast but wrong source of truth
- Slowness = client fetch + Supabase JS, not missing static HTML
- Recommended future option: **deploy-time snapshot** (`published-snapshot.json`) for instant paint, then background refresh — not implemented in this session

---

## Stage 10 — Security review (session ~May/Jun 2026)

### What was already good
- RLS enabled on all tables with sensible policies
- Consistent `escapeHtml()` before `innerHTML` for user content
- Static GitHub Pages hosting (minimal server attack surface)
- Supabase handles auth/password hashing

### Critical issue found: profile role escalation
**Policy:** `"Profiles: users update own name"` allowed updating **any column** on own row, including `role`.

**Exploit:** Any signed-in parent could run in browser console:
```javascript
supabase.from('profiles').update({ role: 'admin' }).eq('id', session.user.id)
```

**Fix:** `supabase/fix-role-escalation.sql` — `WITH CHECK` ensures `role` cannot change on self-update.

### Other items (accepted risk for PTA scale)
- No submission rate limiting
- No server-side payload size limits
- Email verification disabled intentionally
- Broad `authenticated` grants safe only while RLS stays enabled

### Third-party security review of `announcements-live.js`
Claims assessed:
| Claim | Verdict |
|-------|---------|
| Prototype pollution via `data-payload` JSON | Mostly false — parsed object used for form prefill, not deep merge |
| Spoof `viewerId` to read others’ pending | False if RLS correct — DB enforces `auth.uid()` |
| `innerHTML` rerender performance | Valid UX/perf concern, not security |
| XSS via escapeHtml | True — handled well |

---

## Stage 11 — Admin user management (commit `2b07d22`)

**Goal:** Admins promote/demote users in UI instead of raw SQL only.

**SQL (`fix-role-escalation.sql`):**
1. Block self role change
2. Admin read all profiles
3. Admin update any profile role

**Admin UI:**
- New **Users** tab on admin page
- List all profiles with promote/demote buttons
- Cannot demote self (“You” badge)
- Confirmation before role change

**Denied panel:** Removed SQL instructions and debug details (user id, role) for non-admins; replaced with “contact an existing PTA admin.”

**User action required:** Run `fix-role-escalation.sql` in Supabase — demote/promote silently failed without admin update policy.

**Pushed:** `2b07d22`.

---

## Stage 12 — Hide admin inbox from parents (commit `80ac652`)

**Change:** Submit page “Admin inbox” link hidden by default; shown only when `isAdmin(profile)`.

**Files:** `pages/submit.src.html` (`id="admin-link" hidden`), `submit.js` toggles visibility.

**Debugging note:** Demoted users still saw link if demotion didn’t persist (SQL not run). For admin accounts, link correctly remains visible.

**Pushed:** `80ac652`.

---

## Stage 13 — Staff contacts import (local, not pushed in this session)

**Goal:** Import Outlook `contacts.csv`; staff = `@frazerschool.org`, exclude students `@my.frazerschool.org`.

**Added:**
- `scripts/import_contacts.py` — filters CSV, groups by Department, generates HTML block
- Markers in `site-contacts.html`: `<!-- staff-contacts:start/end -->`
- Wired into `npm run import` and `build:ci`
- CSS `.contact-staff-list` for multi-column staff grid

**Status at write time:** `contacts.csv` contained header row only → 0 staff imported; placeholder text on contacts page until full CSV is added.

---

## Stage 14 — Approved edit created duplicate published row (local, Jul 19 2026)

**Symptom:** Approving an `edit_published` change request for an announcement could leave two published rows in the admin Live tab: the updated item and the original pre-edit item recreated as a duplicate.

**Cause:** `publishSubmission()` correctly updated the live row in place and moved its `submission_id` to the newly approved edit submission. Later, admin page self-heal logic in `enforceApprovedPublishedSync()` saw the original approved `create` submission as “missing from site” and republished it.

**Fix:** `src/assets/admin.js` now loads superseded submission IDs from `published_item_versions` snapshots and skips republishing approved submissions that have already been superseded by a later approved edit.

**Effect:** Approved edit requests should no longer resurrect the older announcement/event as a second published row during admin reload/sync.

---

## Stage 15 — School logo + campus photo branding (local, Jul 19 2026)

**Goal:** Replace the placeholder header mark with the real school logo and use the campus photo as the home hero background.

**Added assets:**
- `src/assets/school-logo.jpeg`
- `src/assets/school-background.webp`

**Frontend changes:**
- `site-header.html` now uses the image logo instead of the text-only badge
- `styles.css` updates logo sizing and adds the school photo as the home hero background with a dark overlay for readability

**Effect:** The homepage branding now feels tied to the school itself rather than a generic PTA template, while keeping the existing text readable and mobile-safe.

---

## Current architecture summary

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages (static dist/)                                 │
│  ├── HTML from build_html.js + templates                     │
│  ├── assets/*.js (ES modules, Supabase client from esm.sh)   │
│  └── supabase-config.js (injected at CI deploy)              │
└───────────────────────────┬─────────────────────────────────┘
                            │ anon key + JWT session
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + RLS)                            │
│  ├── profiles (parent | admin)                               │
│  ├── submissions (pending → approved/rejected/archived)      │
│  ├── published_* (public read)                               │
│  ├── submission_events (audit log)                           │
│  └── archived_published_items, published_item_versions       │
└─────────────────────────────────────────────────────────────┘
```

**Two-layer public pages (competitions/clubs/announcements/calendar):**
1. Empty or minimal HTML shells from build
2. Live data from `*-live.js` fetching `published_*` (+ pending ghosts for signed-in submitter)

**Admin flow:** Queue → Approve → publish / Reject / Archive / Revert one version / Remove from site

---

## SQL files reference (run manually in Supabase)

| File | Purpose |
|------|---------|
| `schema.sql` | Core schema + RLS |
| `fix-permissions.sql` | Grants + profile insert policy |
| `fix-role-escalation.sql` | Block self-promotion; admin promote/demote |
| `promote-admin.sql` | First admin by email |
| `published-competitions-clubs.sql` | Published catalog tables |
| `published-static-entry-id.sql` | Static entry ID columns |
| `published-item-versions.sql` | One-step revert history |
| `submission-events.sql` | Audit log |
| `submission-archived.sql` | Archive tables |
| `submissions-admin-delete.sql` | Admin delete policy |

---

## Commits timeline (recent)

| Commit | Summary |
|--------|---------|
| `bd93db0` | Initial multi-page static site |
| `98b2cc0` / `68402eb` | TS competitions generator (later removed) |
| `1bbfebb` | Submission workflow + live modules |
| `899c82b` | GitHub Pages workflow |
| `e547c75` | Deploy verification + Supabase key handling |
| `fbeaa27` | Merge feature/submission-workflow to main |
| `eb2c94f` | Long text overflow CSS |
| `02c61c8` | Remove TS generator overwriting competitions |
| `6cfc955` | Always show navigable calendar |
| `54253c6` | Calendar UX, remove announcement placeholders, publishable keys |
| `2b07d22` | User management + role escalation fix |
| `80ac652` | Hide admin inbox link for non-admins |

**Uncommitted local work (as of log write):** contacts import script, `DEVELOPMENT_LOG.local.md`, possibly unstaged template/CSS/package.json changes from Stage 13.

---

## Known issues / follow-ups

1. **Run `fix-role-escalation.sql`** if not already — required for Users tab and demote/promote
2. **Admin link visibility** — depends on actual DB role, not cached UI state; sign out/in after role change
3. **Duplicate published rows** — may remain in DB from earlier testing; archive extras in admin Live tab
4. **Deploy from `main` vs `feature/submission-workflow`** — keep branches aligned for production
5. **Optional:** deploy-time Supabase snapshot for faster first paint
6. **Optional:** remove `data-payload` from change-request buttons; use ID + in-memory map
7. **contacts.csv** — populate with full Outlook export, then `npm run build`

---

## Files to avoid reintroducing

- `src/components/site-competitions.ts` — overwrites template with spreadsheet on build
- TS execution in `build_html.js` — removed intentionally

---

## Local development commands

```bash
# Copy config (local only)
cp src/assets/supabase-config.example.js src/assets/supabase-config.js
# Fill in Supabase URL + anon key

npm run build          # import activities + contacts + HTML
npm run dev            # build + serve dist (port may vary if 3000 busy)

# GitHub Pages deploy: Actions → Deploy GitHub Pages (secrets required)
```

---

*Log compiled from project history, git commits, and assistant sessions through July 2026.*
