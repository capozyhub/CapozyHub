// scripts/test-sub-agent-cost.ts
import { computeSubAgentCost } from '../lib/pricing/sub-agent-cost'

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

// ── Happy path ──
{
    const r = computeSubAgentCost({ recruiterCost: 4, markup: 1, customerPrice: 10 })
    assertEqual(r.ok, true, 'valid input is ok')
    assertEqual(r.subCost, 5, 'subCost = recruiterCost + markup')
    assertEqual(r.recruiterEarns, 1, 'recruiterEarns = markup')
}

// ── Zero markup is LEGAL (new sub, or airtime/mashup's forced zero) ──
{
    const r = computeSubAgentCost({ recruiterCost: 4, markup: 0, customerPrice: 10 })
    assertEqual(r.ok, true, 'zero markup is legal')
    assertEqual(r.subCost, 4, 'zero markup: subCost equals recruiter cost')
    assertEqual(r.recruiterEarns, 0, 'zero markup: recruiter earns nothing')
}

// ── 2dp rounding ──
{
    const r = computeSubAgentCost({ recruiterCost: 4.005, markup: 0.005, customerPrice: 10 })
    assertEqual(r.subCost, 4.01, 'subCost rounds to 2dp')
}

// ── Negative markup rejected — a recruiter must never sell below their own cost ──
{
    const r = computeSubAgentCost({ recruiterCost: 4, markup: -1, customerPrice: 10 })
    assertEqual(r.ok, false, 'negative markup rejected')
    assertEqual(r.subCost, 0, 'rejection returns subCost 0 (fail closed)')
    assertEqual(r.recruiterEarns, 0, 'rejection returns recruiterEarns 0 (fail closed)')
}

// ── Zero/negative recruiter cost rejected (broken package row) ──
{
    assertEqual(computeSubAgentCost({ recruiterCost: 0, markup: 1, customerPrice: 10 }).ok, false,
        'zero recruiter cost rejected')
    assertEqual(computeSubAgentCost({ recruiterCost: -4, markup: 1, customerPrice: 10 }).ok, false,
        'negative recruiter cost rejected')
}

// ── Ceiling TEMPORARILY DISABLED (Task 6, 2026-09-14, explicit user request — see the
//    marker in lib/pricing/sub-agent-cost.ts): a subCost above the standard customer
//    price is now accepted, not rejected. Restore the old rejection assertions here
//    when the ceiling check itself is reinstated. ──
{
    const r = computeSubAgentCost({ recruiterCost: 9, markup: 2, customerPrice: 10 })
    assertEqual(r.ok, true, 'subCost above customer price is currently ALLOWED (ceiling disabled)')
    assertEqual(r.subCost, 11, 'subCost above customer price still computed normally')
}
{
    const r = computeSubAgentCost({ recruiterCost: 9, markup: 1, customerPrice: 10 })
    assertEqual(r.ok, true, 'subCost exactly at customer price is allowed')
}

// ── Non-finite inputs rejected ──
{
    assertEqual(computeSubAgentCost({ recruiterCost: NaN, markup: 1, customerPrice: 10 }).ok, false,
        'NaN recruiter cost rejected')
    assertEqual(computeSubAgentCost({ recruiterCost: 4, markup: Infinity, customerPrice: 10 }).ok, false,
        'infinite markup rejected')
}

// ── Reason strings must not disclose the recruiter's own cost ──
{
    const r = computeSubAgentCost({ recruiterCost: 9, markup: 2, customerPrice: 10 })
    assertEqual(/\b9\b|recruiter cost is/i.test(r.reason ?? ''), false,
        'reason does not disclose the recruiter cost')
}
