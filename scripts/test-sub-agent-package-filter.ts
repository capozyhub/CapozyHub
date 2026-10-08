// scripts/test-sub-agent-package-filter.ts
import { filterPackagesForSubAgent, SubAgentPricingMap } from '../lib/sub-agent-package-filter'

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

interface Pkg { id: string; size: string }

async function main() {
// ── Unconfigured package is hidden ──
{
    const packages: Pkg[] = [{ id: 'pkg-1', size: '1GB' }, { id: 'pkg-2', size: '2GB' }]
    const pricing: SubAgentPricingMap = { 'pkg-1': { subPrice: 5, configured: true } }
    const out = filterPackagesForSubAgent(packages, pricing)
    assertEqual(out.map(p => p.id), ['pkg-1'], 'only the configured package survives')
}

// ── Empty pricing map hides everything (fail closed) ──
{
    const packages: Pkg[] = [{ id: 'pkg-1', size: '1GB' }, { id: 'pkg-2', size: '2GB' }]
    const out = filterPackagesForSubAgent(packages, {})
    assertEqual(out, [], 'empty pricing map hides every package')
}

// ── All configured means nothing is dropped ──
{
    const packages: Pkg[] = [{ id: 'pkg-1', size: '1GB' }, { id: 'pkg-2', size: '2GB' }]
    const pricing: SubAgentPricingMap = {
        'pkg-1': { subPrice: 5, configured: true },
        'pkg-2': { subPrice: 9, configured: true },
    }
    const out = filterPackagesForSubAgent(packages, pricing)
    assertEqual(out.map(p => p.id), ['pkg-1', 'pkg-2'], 'every configured package survives, order preserved')
}

// ── A pricing entry for an unrelated id never leaks onto a different package ──
{
    const packages: Pkg[] = [{ id: 'pkg-1', size: '1GB' }]
    const pricing: SubAgentPricingMap = { 'pkg-other': { subPrice: 5, configured: true } }
    const out = filterPackagesForSubAgent(packages, pricing)
    assertEqual(out, [], 'a pricing row for a different package id does not make pkg-1 visible')
}

if (process.exitCode === 1) {
    console.error('\nSome tests FAILED')
} else {
    console.log('\nAll tests PASSED')
}
}

main()
