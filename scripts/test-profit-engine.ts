// scripts/test-profit-engine.ts
import { netProfitAfterRecruiterMargin } from '../lib/pricing/profit-engine'

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

// ── No sub-agent involved: plain revenue minus admin cost ──
{
    const r = netProfitAfterRecruiterMargin(15, 10, null, null)
    assertEqual(r, { cost: 10, profit: 5 }, 'no recruiter margin: cost/profit unchanged')
}

// ── Sub-agent order, recruiter margin PENDING: subtract from cost ──
{
    const r = netProfitAfterRecruiterMargin(15, 10, 2, 'pending')
    assertEqual(r, { cost: 12, profit: 3 }, 'pending recruiter margin subtracted from profit')
}

// ── Sub-agent order, recruiter margin CREDITED: subtract from cost ──
{
    const r = netProfitAfterRecruiterMargin(15, 10, 2, 'credited')
    assertEqual(r, { cost: 12, profit: 3 }, 'credited recruiter margin subtracted from profit')
}

// ── Sub-agent order, recruiter margin REVERSED: recruiter was never paid, platform kept it ──
{
    const r = netProfitAfterRecruiterMargin(15, 10, 2, 'reversed')
    assertEqual(r, { cost: 10, profit: 5 }, 'reversed recruiter margin NOT subtracted — platform kept the full amount')
}

// ── Zero markup is legal (a sub-agent sale with no recruiter cut) ──
{
    const r = netProfitAfterRecruiterMargin(10, 10, 0, 'pending')
    assertEqual(r, { cost: 10, profit: 0 }, 'zero markup: no adjustment needed, profit is zero')
}

// ── recruiterMarginAmount present but status null (defensive — should never happen from a real join, but never silently subtract) ──
{
    const r = netProfitAfterRecruiterMargin(15, 10, 2, null)
    assertEqual(r, { cost: 10, profit: 5 }, 'null status treated as no adjustment (fail closed, matches SQL LEFT JOIN producing NULL)')
}
