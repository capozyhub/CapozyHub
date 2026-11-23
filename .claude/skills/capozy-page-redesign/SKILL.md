---
name: capozy-page-redesign
description: Use when redesigning or restyling any Capozy Hub page, component or flow (landing, auth, dashboard, shop, admin, developers). Applies the Capozy tokens and tone, removes inherited KiNG FLEXY patterns, and gates the work.
---

# Redesigning a Capozy Hub page

Read `CLAUDE.md` (Design and Working agreements) first. This skill is the checklist; for the visual thinking itself use `frontend-design:frontend-design`, and for planning a larger sector use `superpowers:brainstorming` then `superpowers:writing-plans`.

## One page, one commit
1. **Read the page and everything it calls** (components, `/api` routes, libs). Write down what it actually does before changing how it looks.
2. **List bugs while you are there** (stale fetch races, silent 1000-row caps, raw server errors in toasts, native `confirm()`, unhandled loading/error states). Fix them in the same pass; note them in the commit message.
3. **Match the Capozy UI preset** in `PRESET.md` (next to this file). It comes from the landing page and the account pages, which are the reference; look at one similar finished page (`app/dashboard/shop/*`, `app/dashboard/upgrade`, `app/auth`) before you start. **Re-lay-out, do not just recolour**: change structure and section order so the page does not read as the original. Surfaces `neu-*`, buttons `clay-*`, headings `font-display`, forms from `components/auth/fields.tsx`.
4. **Rewrite the words.** Headings, empty states, button labels, toasts and helper text in plain, direct language. Delete anything about removed features (SMS credits, utility bills, USSD, Hubtel, Moolre, commission wallet, phone OTP, Google/PIN login) and any named supplier.
5. **Use `BRAND` from `lib/brand.ts`** for the name, domain and URLs. No literals.
6. **States and access:** loading, empty, error, success; labelled controls; visible focus; works at 360px; both themes.
7. **Review:** run the `capozy-ui-reviewer` agent on the changed files. If the page touches money, wallets, fulfillment or roles, also run `payments-security-reviewer`.
8. **Gate before committing:** `npx tsc --noEmit`, `npx next build` (with the placeholder env from `CLAUDE.md`), the relevant guard tests, and confirm the built CSS contains utilities. Then `superpowers:verification-before-completion`.
9. **Commit locally** with a message that names the page and lists the bugs fixed. Push only after the owner approves.
