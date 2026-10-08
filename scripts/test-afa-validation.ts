// scripts/test-afa-validation.ts
//
// validateAfaRegistration is the single source of AFA input validation for BOTH
// the dashboard (app/api/user/afa-registration) and the developer API
// (app/api/v2/afa/register). It gates a KYC-bearing money endpoint, so the
// allowlists, the fail-closed ID check and the 18+ rule are pinned here.
import { validateAfaRegistration, VALID_REGIONS, ageOn } from '@/lib/afa-validation'

function assert(cond: boolean, label: string) {
    if (!cond) throw new Error(`FAILED: ${label}`)
}

const eighteenYearsAgo = new Date()
eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 20)

const valid: Record<string, any> = {
    full_name: 'Kwame Mensah',
    phone: '0551617309',
    id_type: 'Ghana Card',
    id_number: 'GHA-123456789-0',
    location: 'Madina',
    region: 'Greater Accra',
    date_of_birth: eighteenYearsAgo.toISOString().slice(0, 10),
}

// ── Happy path ───────────────────────────────────────────────────────────────
assert(validateAfaRegistration(valid).ok, 'a complete, valid registration passes')

// ── Required fields ──────────────────────────────────────────────────────────
for (const field of ['full_name', 'phone', 'id_type', 'id_number', 'location', 'region', 'date_of_birth']) {
    const r = validateAfaRegistration({ ...valid, [field]: '' })
    assert(!r.ok && r.field === field, `missing ${field} is rejected and names the field`)
}

// ── Ghana Card format — the exact shape matters ─────────────────────────────
for (const bad of ['GHA-12345678-0', 'GHA-1234567890-0', 'GHA-123456789-01', '123456789', 'gha-123456789-0']) {
    const r = validateAfaRegistration({ ...valid, id_number: bad })
    assert(!r.ok && r.field === 'id_number', `rejects malformed Ghana Card "${bad}"`)
}
assert(validateAfaRegistration({ ...valid, id_number: '  GHA-123456789-0  ' }).ok, 'trims surrounding whitespace on the ID')

// ── Allowlists ───────────────────────────────────────────────────────────────
assert(VALID_REGIONS.length === 16, 'exactly the 16 official regions of Ghana are allowed')
for (const region of VALID_REGIONS) {
    assert(validateAfaRegistration({ ...valid, region }).ok, `accepts official region "${region}"`)
}
{
    const r = validateAfaRegistration({ ...valid, region: 'Lagos' })
    assert(!r.ok && r.field === 'region', 'rejects a non-Ghanaian region')
}
{
    const r = validateAfaRegistration({ ...valid, id_type: 'Passport' })
    assert(!r.ok && r.field === 'id_type', 'rejects an ID type outside the allowlist')
}

// ── Age ──────────────────────────────────────────────────────────────────────
{
    const seventeen = new Date()
    seventeen.setFullYear(seventeen.getFullYear() - 17)
    const r = validateAfaRegistration({ ...valid, date_of_birth: seventeen.toISOString().slice(0, 10) })
    assert(!r.ok && r.field === 'date_of_birth', 'rejects an applicant under 18')

    const r2 = validateAfaRegistration({ ...valid, date_of_birth: 'not-a-date' })
    assert(!r2.ok && r2.field === 'date_of_birth', 'rejects an unparseable date of birth')
}
{
    // A birthday later this year must NOT round up to 18.
    const today = new Date()
    const almost = new Date(today.getFullYear() - 18, today.getMonth() + 1, today.getDate())
    assert(ageOn(almost, today) === 17, 'age honours month/day, not just the year')
}

// ── Stored-XSS defence in depth ─────────────────────────────────────────────
// These fields are rendered into admin email and in-app notification HTML.
for (const field of ['full_name', 'location', 'notes']) {
    const r = validateAfaRegistration({ ...valid, [field]: '<img src=x onerror=alert(1)>' })
    assert(!r.ok && r.field === field, `rejects angle brackets in free-text field ${field}`)
}

// ── Length caps ──────────────────────────────────────────────────────────────
{
    const r = validateAfaRegistration({ ...valid, full_name: 'a'.repeat(101) })
    assert(!r.ok && r.field === 'full_name', 'enforces the full_name length cap')
}

console.log('All afa-validation tests passed.')
