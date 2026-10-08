// scripts/test-commission-wallet-routing.ts
// Static guard: ensures credit_utility_commission's SQL text actually routes
// source='api' orders to credit_commission_wallet, and never inserts directly
// into shop_wallets for that branch. Protects against a future edit
// accidentally re-merging the two paths.
//
// credit_utility_commission checks shop_id IS NOT NULL FIRST (takes precedence),
// then ELSIF source='api' -> delegates to credit_commission_wallet.
//
// Rather than hard-coding the migration filename that currently defines this
// function (drift risk: a future migration could redefine it and leave this
// guard passing against stale SQL), scan supabase/migrations/ and use whichever
// file is LEXICOGRAPHICALLY LAST among those containing a
// `CREATE OR REPLACE FUNCTION public.credit_utility_commission` block — since
// this repo's migration filenames are date-prefixed (YYYYMMDD[a-z]_name.sql),
// lexicographic order matches chronological order, so "last" means "most recent
// redefinition". Resolve paths from process.cwd(), not __dirname: these scripts
// run as `npx tsx scripts/test-*.ts` from the repo root, and __dirname is not
// guaranteed under tsx's ESM resolution.
//
// ASSUMPTION (unchanged from the original hard-coded version): the extraction
// below slices the function body from the `CREATE OR REPLACE FUNCTION` marker
// to the FIRST `$$;` after it, and further slices the api branch from its
// `ELSIF` to the FIRST `END IF;` after that. This assumes the api branch
// contains no NESTED `IF ... END IF;` of its own — if one is ever added, this
// slicing would truncate the branch early and the assertions below could pass
// vacuously. Re-verify this assumption if the function's api branch grows an
// inner IF.
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

function assert(cond: boolean, label: string) {
    if (!cond) {
        console.error(`FAIL: ${label}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

const FN_MARKER = 'CREATE OR REPLACE FUNCTION public.credit_utility_commission'
const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const candidateFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort() // filenames are date-prefixed, so lexicographic === chronological
    .filter((f) => readFileSync(join(migrationsDir, f), 'utf-8').includes(FN_MARKER))

const latestFile = candidateFiles[candidateFiles.length - 1]
assert(!!latestFile, 'a migration file defines credit_utility_commission')
console.log(`Using latest definition from: ${latestFile}`)

const sql = readFileSync(join(migrationsDir, latestFile), 'utf-8')

// The selected file defines credit_utility_commission exactly once — grab that
// single definition by its start marker through the `$$;` that closes the
// plpgsql body.
const fnStart = sql.indexOf(FN_MARKER)
assert(fnStart !== -1, 'migration file defines credit_utility_commission')

const fnEnd = sql.indexOf('$$;', fnStart)
const fnBody = sql.slice(fnStart, fnEnd)

// (a) the function references source IN ('api', 'dashboard')
assert(fnBody.includes("v_order.source IN ('api', 'dashboard')"), 'credit_utility_commission checks source IN (api, dashboard)')

// (b) it delegates to credit_commission_wallet
assert(fnBody.includes('RETURN public.credit_commission_wallet(p_utility_order_id);'), 'credit_utility_commission delegates to credit_commission_wallet')

// (c) the api branch does not credit shop_wallets. The api branch is the
// ELSIF v_order.source = 'api' THEN ... END IF block, which — per the current
// structure — sits between the shop_id check that precedes it and the
// `IF v_partner_id IS NULL THEN` guard that follows (the shop-crediting code
// lives after that guard, gated on v_partner_id which is never set on the
// api branch). Slice from the source='api' check to the RETURN statement
// that ends that branch, and confirm shop_wallets never appears in it.
const apiCheckIdx = fnBody.indexOf("ELSIF v_order.source IN ('api', 'dashboard') THEN")
assert(apiCheckIdx !== -1, 'credit_utility_commission has an ELSIF source IN (api, dashboard) branch')

const apiBranchEnd = fnBody.indexOf('END IF;', apiCheckIdx)
assert(apiBranchEnd !== -1, 'the source=api branch is closed by an END IF')

const apiBranch = fnBody.slice(apiCheckIdx, apiBranchEnd)
assert(apiBranch.includes('RETURN public.credit_commission_wallet'), 'the source=api branch returns via credit_commission_wallet before falling through')
assert(!apiBranch.includes('shop_wallets'), 'the source=api branch never touches shop_wallets')

// Sanity check for (c): the function DOES touch shop_wallets elsewhere (in the
// shop_id branch), proving the assertion above is meaningful and not vacuously
// true because the string never appears anywhere in the function.
assert(fnBody.includes('public.shop_wallets'), 'sanity: the function does credit shop_wallets on its shop_id branch (elsewhere)')

if (process.exitCode !== 1) console.log('\nAll commission-wallet-routing tests passed.')
