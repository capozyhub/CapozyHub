# Admin page pass — reusable prompt

Paste this once per admin page (or per small group). Replace `{{PAGE}}` and `{{API}}`.
One page per pass. Each pass ends with a local verified commit. Push only after owner approval.

---

## PROMPT

You are working on **Capozy Hub** (D:\Projects\Capozy Hub). Target: **{{PAGE}}** (e.g. `app/admin/orders/page.tsx`) and the API routes it calls (**{{API}}**, under `app/api/admin/`).

Read first: `docs/stage-1-5-scope-down.md`, `docs/security-audits/*`, `lib/fetch-all-rows.ts`, `components/dashboard/nav-config.ts`, and one finished page for the Capozy look (`app/dashboard/shop/*`).

### Step 0 — Decide before touching code (STOP and ask me)
For this page, list every feature, tab, button, column, API route, lib file and DB object it touches, and sort each into:

- **KEEP** — Capozy uses it as-is.
- **CHANGE** — Capozy uses it but it needs a generic rename (e.g. supplier-specific column to `supplier_id` / `supplier_reference`).
- **REMOVE** — Capozy will not use it.

Anything that names a KiNG FLEXY / KingFlexyGH supplier, staff member, vendor, phone number, wallet, key, webhook, or SMS/payment provider we dropped (Hubtel, Moolre, mNotify, Brevo, MailerSend, utility bills, shop SMS, USSD) is **REMOVE by default**. Suppliers in the repo today: atishare, codecraft, dakazina, ghdata, hendylinks, spfastit, xpress, agentportal, bundleportal, datagod.

Ask me, per item: *"Will Capozy reuse this? Yes / No / Unsure."* Do not guess. Wait for my answers.

### Step 1 — Remove what Capozy will not use (code level, not hidden)
For every REMOVE item, delete or park (`_parked/<area>/`, gitignored) **all** of:
- the page section/tab/UI and its nav entry (`nav-config.ts`, `ADMIN_COUNT_KEYS`, sidebar, bottom nav)
- the API route(s), the lib service, webhooks, cron entries (`vercel.json`, `.github/workflows`)
- types, constants, env var names (`.env.example`, `docs/security-audits/vercel-env-var-names.md`), copy/text, comments, test fixtures, seed data
- direct imports and dynamic/string references (grep the whole repo, case-insensitive, including `supabase/` and `migrations/`)

Goal: a grep for any KiNG FLEXY supplier, staff name, or credential name returns **nothing** in tracked files. List what you grepped and the result. Do not remove a shared lib file until nothing else imports it.

### Step 2 — Audit what stays (report BEFORE fixing)
Give me a table: `#`, severity (critical/high/medium/low), file:line, problem, proposed fix. Cover:

**Security**
- Every route: `validateAdminAccess` first, correct `allowSubAdmin`, role re-read from DB (not JWT claims).
- Service-role client used only after the auth check; no user-supplied column names/filters/sort keys passed through unvalidated.
- Input validation (zod or manual): types, lengths, enums, UUIDs, numeric bounds, `limit`/`page` clamps.
- Money routes: atomic RPC, idempotency key, row lock, no read-then-write races, no negative or NaN amounts, audit-log row written.
- No `error.message` or stack returned to the client on 500 (log server-side, return generic text).
- No secrets, provider names, or internal IDs in the client bundle or API responses.
- SECURITY DEFINER RPCs: `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role`, `SET search_path`.
- Destructive actions (delete, refund, role change, wallet adjust): confirmation in UI, server-side permission check, audit trail.
- Run the `payments-security-reviewer` agent if the page touches money, wallet, orders or roles.

**The 1000-row bug (PostgREST silently truncates at 1000)**
- Find every `.select()` without `.range()`/`.limit()`, every client-side `.reduce()`/`.filter()`/`.length` over fetched rows used as a total, and every "count" computed from a returned array.
- Fix by the cheapest correct option, in this order: (1) a SQL aggregate / RPC returning the number (sums, counts, group-bys); (2) server-side pagination with `count: 'exact'` and `.range()` for tables, with a unique tiebreaker in `order()`; (3) `fetchAllRows` only for bounded exports, with `maxRows` and the `truncated` flag shown in the UI.
- Totals, badges, and stat cards must never come from a paged list. Filters, search and sort run in the query, not on the loaded page.
- Search is debounced, uses indexed columns, and escapes `%`/`_`/`,` in `ilike`/`.or()` strings.
- Realtime/polling: no unbounded intervals, cleanup on unmount, no refetch storms.
- Say which indexes the new queries need and add them as migration **files only** (nothing applied to live Supabase before Stage 4).

**Bugs and robustness**
- Race conditions on rapid filter/range changes (stale response overwriting a newer one: use an abort/sequence guard).
- Error and empty states: a failed secondary fetch must not blank the page or show a fake `0`/`₵0` as truth.
- Loading states, double-submit protection on every mutation, optimistic updates that roll back.
- Timezone/date boundaries (use one UTC/Africa-Accra rule everywhere), currency rounding, NaN/undefined in formatters.
- Dead code, unused state, duplicate fetches, 3,000+ line files that should be split into `_components/`.
- Accessibility: labels, focus, keyboard, contrast on the gold/black palette.

### Step 3 — Capozy UI (admin-appropriate, not stepped or decorative)
- Admin is a **work tool**: dense, scannable, fast. No multi-step wizards, hero banners, marketing tone, or decorative gradients. Tables, filters, bulk actions and keyboard-friendly forms come first.
- Must not look or read like KiNG FLEXY: redesign layout and copy, not just colours. Rewrite headings, empty states, button labels, toasts and helper text in Capozy's plain voice.
- Palette from the logo: black `#000`, gold `#F6A900 / #F6C30F / #FEE21C`, silver `#C2C2C2 / #E8E8E8 / #F9F9F9`. Use theme CSS variables and shared primitives (`components/ui/*`, `components/dashboard/shell`), **no hard-coded hex** like the old red `#E60000`. Gold marks primary actions and key numbers only; status uses semantic colours.
- Shared pieces over copy-paste: one stat card, one data table (sticky header, column sort, pagination footer with "Showing x–y of N"), one filter bar, one confirm dialog, one empty state. If one exists in `components/`, reuse it; if not, create it once in `components/admin/` and use it here.
- Responsive: usable at 360px (card list instead of a wide table), no horizontal page scroll, 16px gutters. Dark and light both correct.
- Money shown with one `formatCurrency`; statuses with one status badge.

### Step 4 — Verify and hand over
- `npx tsc --noEmit` clean; `npm run test:guards` passes.
- Fresh-clone gate from `docs/stage-1-5-scope-down.md` (`npm ci`, `tsc`, `next build`, compiled CSS check, `git ls-files` vs source list) before any push.
- Test the 1000-row fix with a seeded count above 1000 (or an RPC check) and say how you tested it.
- Commit message: `fix(admin-<page>): ...` / `design(admin-<page>): ...` / `chore(admin-<page>): remove <feature>`; one reviewable commit per concern. Do not push.
- Final report: what was removed (with grep proof), what was fixed (table), what I need to decide next, and anything you could not verify.

Do not start Step 1 until I answer Step 0.
