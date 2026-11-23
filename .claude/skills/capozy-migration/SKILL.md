---
name: capozy-migration
description: Use when adding or changing a Supabase migration, table, RLS policy, RPC or database function for Capozy Hub, or when applying SQL to the Capozy database.
---

# Database changes for Capozy Hub

Also load `supabase:supabase` and `supabase:supabase-postgres-best-practices`. This skill adds the project rules.

## Hard rules
- **Never write to project `ubvjtacdmwynqcxuposj`.** It is the old KiNG FLEXY production database. `scripts/apply-sql.js` refuses it. The Capozy project is the one behind the `supabase-capozy` MCP server; check the target before every write.
- **Apply SQL with `node scripts/apply-sql.js <file>`** (transactional; reads `CAPOZY_DB_URL` from the environment or the gitignored `.env.db`). Do not paste large SQL through MCP calls: copy errors in wallet functions are expensive.
- **Never print or save connection strings or env values.**
- Migrations live in `supabase/migrations/<yyyymmdd>[letter]_<name>.sql`. The baseline (`00000000000000_baseline.sql`) is trimmed last; do not edit it for feature work.

## Writing the migration
1. **Inspect first.** List the existing tables/functions involved (`mcp__supabase-capozy__list_tables`, or read the baseline) before changing them.
2. **RLS on every new table**, with explicit policies. Users read and write only their own rows; admin access goes through the service role in server code.
3. **Money moves only through RPCs** that lock the row (`FOR UPDATE`), are idempotent on a reference, and check authorisation inside the function. Never grant clients direct `UPDATE` on wallets or transactions.
4. **SECURITY DEFINER functions** must set `search_path`, must not write `users.role` or move money without an authorisation check, and must be reviewed with `payments-security-reviewer`.
5. **Signups** go through `handle_new_user` only (creates `customer`). Do not add a client path that sets a role.
6. `admin_settings.value` is jsonb: compare as text (`value #>> '{}'`) or cast explicitly.
7. Add indexes for new foreign keys and common filters; keep migrations re-runnable where practical (`IF NOT EXISTS`).

## After writing
- Regenerate types only when you intend to (the generated file loses the hand-added aliases such as `export type User = ...`; restore them afterwards).
- Run `mcp__supabase-capozy__get_advisors` (security and performance) after applying.
- Update the RPC/column usage in code, then `npx tsc --noEmit` and the relevant guard tests.
- Commit the migration file with the code that needs it. Do not apply to the live project until the owner has approved the step.
