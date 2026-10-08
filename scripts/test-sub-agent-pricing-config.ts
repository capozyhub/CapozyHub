// scripts/test-sub-agent-pricing-config.ts
// Pure-arithmetic tests for lib/sub-agent-pricing-config.ts (Plan 4, Task 4).
// No DB/env required — mirrors scripts/test-sub-agent-cost.ts's convention.

import {
    subPriceToMarkup,
    markupToSubPrice,
    parsePackageSizeGb,
    computeFlatRateSubPrice,
    buildFlatRateRows,
    buildMatchParentPriceRows,
    buildValidatedWrites,
    resolveSubPriceForRow,
} from '../lib/sub-agent-pricing-config'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// ── subPriceToMarkup: happy path ──
// Worked example from the task report: yourPrice = 4.50 (recruiter's own
// agent-tier cost), subPrice = 6.00 (what the UI operator wants their sub
// charged) -> markup = 6.00 - 4.50 = 1.50, the delta actually persisted.
{
    const r = subPriceToMarkup(6.0, 4.5)
    assertEqual(r.ok, true, 'subPriceToMarkup: valid input is ok')
    assertEqual(r.markup, 1.5, 'subPriceToMarkup: markup = subPrice - yourPrice')
}

// ── subPriceToMarkup: subPrice exactly equal to yourPrice -> markup 0 (legal) ──
{
    const r = subPriceToMarkup(4.5, 4.5)
    assertEqual(r.ok, true, 'subPriceToMarkup: equal prices are legal (zero markup)')
    assertEqual(r.markup, 0, 'subPriceToMarkup: equal prices -> markup 0')
}

// ── subPriceToMarkup: floor violation rejected server-side ──
{
    const r = subPriceToMarkup(4.0, 4.5)
    assertEqual(r.ok, false, 'subPriceToMarkup: subPrice below yourPrice rejected')
    assertEqual(r.markup, undefined, 'subPriceToMarkup: rejection returns no markup')
}

// ── subPriceToMarkup: bad inputs rejected ──
{
    assertEqual(subPriceToMarkup(5, 0).ok, false, 'subPriceToMarkup: zero yourPrice rejected')
    assertEqual(subPriceToMarkup(5, -1).ok, false, 'subPriceToMarkup: negative yourPrice rejected')
    assertEqual(subPriceToMarkup(0, 4).ok, false, 'subPriceToMarkup: zero subPrice rejected')
    assertEqual(subPriceToMarkup(NaN, 4).ok, false, 'subPriceToMarkup: NaN subPrice rejected')
    assertEqual(subPriceToMarkup(5, NaN).ok, false, 'subPriceToMarkup: NaN yourPrice rejected')
}

// ── subPriceToMarkup: 2dp rounding ──
{
    const r = subPriceToMarkup(6.005, 4.5)
    assertEqual(r.markup, 1.51, 'subPriceToMarkup: rounds to 2dp (6.005 - 4.5 -> 1.51 per r2 rounding)')
}

// ── markupToSubPrice: inverse of subPriceToMarkup ──
{
    assertEqual(markupToSubPrice(4.5, 1.5), 6.0, 'markupToSubPrice: yourPrice + markup')
    assertEqual(markupToSubPrice(4.5, 0), 4.5, 'markupToSubPrice: zero markup returns yourPrice unchanged')
    assertEqual(markupToSubPrice(4.5, null), null, 'markupToSubPrice: null markup ("not configured") -> null')
    assertEqual(markupToSubPrice(4.5, undefined), null, 'markupToSubPrice: undefined markup -> null')
    assertEqual(markupToSubPrice(null, 1.5), null, 'markupToSubPrice: null yourPrice -> null')
}

// ── round-trip: subPriceToMarkup then markupToSubPrice recovers the original subPrice ──
{
    const yourPrice = 12.34
    const subPrice = 15.0
    const { markup } = subPriceToMarkup(subPrice, yourPrice)
    assertEqual(markupToSubPrice(yourPrice, markup), subPrice, 'round-trip: subPrice -> markup -> subPrice is stable')
}

// ── parsePackageSizeGb ──
{
    assertEqual(parsePackageSizeGb('1GB'), 1, 'parsePackageSizeGb: "1GB" -> 1')
    assertEqual(parsePackageSizeGb('1.5GB'), 1.5, 'parsePackageSizeGb: "1.5GB" -> 1.5')
    assertEqual(parsePackageSizeGb('10GB'), 10, 'parsePackageSizeGb: "10GB" -> 10')
    assertEqual(parsePackageSizeGb('not-a-size'), 0, 'parsePackageSizeGb: unparseable -> 0')
    // Regression (Task 4 review, controller fix): a sub-GB label must fail closed, not be
    // misread as GB — parseFloat("500MB") would have returned 500 (a ~500x overcharge) before
    // this fix, since it passed the floor check by landing far ABOVE yourPrice, not below it.
    assertEqual(parsePackageSizeGb('500MB'), 0, 'parsePackageSizeGb: "500MB" fails closed (not 500)')
    assertEqual(parsePackageSizeGb('1GB '), 1, 'parsePackageSizeGb: trailing whitespace still parses')
}

// ── buildValidatedWrites: duplicate ref rejected with a clean error, not a DB 500 ──
// Regression (Task 4 review, controller fix): two rows sharing one conflict key used to reach
// the upsert and fail as a generic 500 from Postgres's ON CONFLICT DO UPDATE.
{
    const yourPriceByRef = new Map([['p1', 4]])
    const result = buildValidatedWrites(
        [{ ref: 'p1', subPrice: 5 }, { ref: 'p1', subPrice: 6 }],
        yourPriceByRef,
    )
    assertEqual(result.ok, false, 'buildValidatedWrites: duplicate ref in one request rejected')
}

// ── computeFlatRateSubPrice ──
{
    assertEqual(computeFlatRateSubPrice(5, 2), 10, 'computeFlatRateSubPrice: 5 GHS/GB x 2GB = 10')
    assertEqual(computeFlatRateSubPrice(4.99, 1.5), 7.49, 'computeFlatRateSubPrice: rounds to 2dp (4.99 x 1.5 = 7.485 -> 7.49)')
}

// ── buildFlatRateRows: derives one row per package from a single rate ──
{
    const rows = buildFlatRateRows(5, [
        { packageId: 'p1', sizeLabel: '1GB' },
        { packageId: 'p2', sizeLabel: '2GB' },
    ])
    assertEqual(rows, [
        { ref: 'p1', subPrice: 5 },
        { ref: 'p2', subPrice: 10 },
    ], 'buildFlatRateRows: per-package subPrice = rate x sizeGb')
}

// ── buildValidatedWrites: happy path ──
{
    const yourPriceByRef = new Map([['p1', 4], ['p2', 8]])
    const result = buildValidatedWrites(
        [{ ref: 'p1', subPrice: 5 }, { ref: 'p2', subPrice: 8 }],
        yourPriceByRef,
    )
    assertEqual(result.ok, true, 'buildValidatedWrites: valid rows are ok')
    if (result.ok) {
        assertEqual(result.writes, [
            { productRef: 'p1', markup: 1 },
            { productRef: 'p2', markup: 0 },
        ], 'buildValidatedWrites: writes carry the correct markup per row')
    }
}

// ── buildValidatedWrites: empty input rejected ──
{
    const result = buildValidatedWrites([], new Map())
    assertEqual(result.ok, false, 'buildValidatedWrites: empty rows rejected')
}

// ── buildValidatedWrites: unknown ref fails the WHOLE batch (never a partial save) ──
{
    const yourPriceByRef = new Map([['p1', 4]])
    const result = buildValidatedWrites(
        [{ ref: 'p1', subPrice: 5 }, { ref: 'unknown', subPrice: 5 }],
        yourPriceByRef,
    )
    assertEqual(result.ok, false, 'buildValidatedWrites: unknown ref rejects the whole batch')
}

// ── buildValidatedWrites: one below-floor row fails the WHOLE batch ──
{
    const yourPriceByRef = new Map([['p1', 4], ['p2', 8]])
    const result = buildValidatedWrites(
        [{ ref: 'p1', subPrice: 5 }, { ref: 'p2', subPrice: 7 }], // p2 below its floor of 8
        yourPriceByRef,
    )
    assertEqual(result.ok, false, 'buildValidatedWrites: any below-floor row rejects the whole batch')
}

// ── resolveSubPriceForRow: default-only (recruiter-wide route) ──
{
    const defaultMap = new Map([['data:p1', 1.5]])
    assertEqual(resolveSubPriceForRow(4.5, 'data', 'p1', defaultMap), 6.0, 'resolveSubPriceForRow: default markup applied')
    assertEqual(resolveSubPriceForRow(4.5, 'data', 'p2', defaultMap), null, 'resolveSubPriceForRow: unconfigured row -> null, not 0')
}

// ── resolveSubPriceForRow: override wins over default (per-sub route) ──
{
    const defaultMap = new Map([['data:p1', 1.5]])
    const overrideMap = new Map([['data:p1', 3.0]])
    assertEqual(resolveSubPriceForRow(4.5, 'data', 'p1', defaultMap, overrideMap), 7.5, 'resolveSubPriceForRow: override markup wins over default')
}

// ── resolveSubPriceForRow: falls back to default when no override exists for this ref ──
{
    const defaultMap = new Map([['data:p1', 1.5]])
    const overrideMap = new Map<string, number>() // sub has overrides for OTHER refs only
    assertEqual(resolveSubPriceForRow(4.5, 'data', 'p1', defaultMap, overrideMap), 6.0, 'resolveSubPriceForRow: falls back to default when no matching override')
}

// ── resolveSubPriceForRow: zero markup is distinguishable from "not configured" ──
{
    const defaultMap = new Map([['afa', 0]]) // wrong key on purpose to prove the miss path
    const zeroMap = new Map([['afa:afa_registration', 0]])
    assertEqual(resolveSubPriceForRow(10, 'afa', 'afa_registration', defaultMap), null, 'resolveSubPriceForRow: no match at all -> null')
    assertEqual(resolveSubPriceForRow(10, 'afa', 'afa_registration', zeroMap), 10, 'resolveSubPriceForRow: configured-at-zero -> yourPrice unchanged, not null')
}

// ── buildMatchParentPriceRows: subPrice = yourPrice exactly (0 markup) ──
{
    const yourPriceByRef = new Map([['a', 10], ['b', 20]])
    const rows = buildMatchParentPriceRows(['a', 'b'], yourPriceByRef)
    assertEqual(rows, [
        { ref: 'a', subPrice: 10 },
        { ref: 'b', subPrice: 20 },
    ], 'buildMatchParentPriceRows: subPrice = yourPrice for every ref')
}

// ── buildMatchParentPriceRows: a ref missing from yourPriceByRef is dropped, not defaulted to 0 ──
{
    const yourPriceByRef = new Map([['a', 10]])
    const rows = buildMatchParentPriceRows(['a', 'b'], yourPriceByRef)
    assertEqual(rows, [{ ref: 'a', subPrice: 10 }], 'buildMatchParentPriceRows: unknown ref dropped, not defaulted to 0')
}

if (process.exitCode === 1) {
    console.error('\nSome tests FAILED')
} else {
    console.log('\nAll tests PASSED')
}
