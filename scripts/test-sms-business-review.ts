// scripts/test-sms-business-review.ts
// Pure-logic tests for the business-profile review/revoke rules introduced
// by the WhatsApp-based KYC redesign – no DB, no network.

import {
    reviewTransitionFor,
    validateBusinessReview,
    isBusinessProfileLocked,
} from '../lib/sms-business-review'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) throw new Error(`FAIL ${label}: expected ${e}, got ${a}`)
}

// Approve/reject move from under_review; revoke moves from approved.
assertEqual(reviewTransitionFor('approved'), { from: 'under_review', to: 'approved' }, 'approve transition')
assertEqual(reviewTransitionFor('rejected'), { from: 'under_review', to: 'rejected' }, 'reject transition')
assertEqual(reviewTransitionFor('revoked'), { from: 'approved', to: 'revoked' }, 'revoke transition')

// Approval requires whatsapp_verified = true; reject/revoke do not.
assertEqual(validateBusinessReview('approved', false), { ok: false, error: 'Confirm documents were verified via WhatsApp before approving' }, 'approve blocked without verification')
assertEqual(validateBusinessReview('approved', true), { ok: true }, 'approve allowed with verification')
assertEqual(validateBusinessReview('rejected', false), { ok: true }, 'reject never needs verification')
assertEqual(validateBusinessReview('revoked', false), { ok: true }, 'revoke never needs verification')

// A profile is only locked from user edits while under_review or approved –
// rejected AND revoked must both stay resubmittable, same as today's
// rejected-only behavior.
assertEqual(isBusinessProfileLocked('under_review'), true, 'under_review is locked')
assertEqual(isBusinessProfileLocked('approved'), true, 'approved is locked')
assertEqual(isBusinessProfileLocked('rejected'), false, 'rejected is resubmittable')
assertEqual(isBusinessProfileLocked('revoked'), false, 'revoked is resubmittable')
assertEqual(isBusinessProfileLocked('draft'), false, 'draft is editable')
assertEqual(isBusinessProfileLocked(null), false, 'no profile yet is editable')
assertEqual(isBusinessProfileLocked(undefined), false, 'undefined status is editable')

console.log('All sms-business-review tests passed.')
