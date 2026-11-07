// Shared "ensure this user has a permanent MoMo payment reference" logic, used by
// both /api/wallet/reference (the standalone endpoint) and /api/wallet/claim-momo/session
// (which now creates this lazily as part of starting a Send & Claim session). One
// reference per user, generated once and reused forever — this is the identity the
// SMS-forward webhook matches against, so moving the generation logic is the only
// change; the generated codes and uniqueness handling are unchanged from before.
// ── Dictionary of natural-looking payment reference words ─────
// These look like legitimate merchant payment references to
// prevent network providers from flagging them as suspicious.
const REFERENCE_WORDS = [
    'BOOK', 'GIFT', 'ITEM', 'PAY', 'BUY', 'RENT', 'BILL',
    'SHOP', 'CART', 'ORDER', 'FOOD', 'CASH', 'SEND', 'LOAD',
    'TOP', 'FUND', 'SAVE', 'PLAN', 'CARD', 'FUEL', 'FARE',
    'FEE', 'TIP', 'DEAL', 'SALE', 'PASS', 'TICKET', 'WATER',
    'LIGHT', 'DATA', 'AIRTIME', 'GOODS', 'SUPPLY', 'STOCK',
    'TRADE', 'OFFER', 'CREDIT', 'DEBIT', 'TRANSFER',
]

function generateCandidateCode(): string {
    const word = REFERENCE_WORDS[Math.floor(Math.random() * REFERENCE_WORDS.length)]
    // Generate a 2-3 digit number (10-999)
    const num = Math.floor(Math.random() * 900) + 10 // 10..909 → mostly 2-3 digits
    // Randomly place number before or after the word
    return Math.random() < 0.5 ? `${num}${word}` : `${word}${num}`
}

export type UserReference = { code: string; is_active: boolean }

/**
 * Returns the user's existing reference, or generates and persists a new one.
 * Safe to call concurrently for the same user (a unique-constraint race just
 * re-fetches and returns the row the other request inserted).
 */
export async function ensureUserPaymentReference(
    supabaseAdmin: any,
    userId: string,
    attempt = 0,
): Promise<UserReference | { error: string }> {
    const { data: existing } = await (supabaseAdmin
        .from('user_payment_references') as any)
        .select('reference_code, is_active')
        .eq('user_id', userId)
        .single()

    if (existing) {
        return { code: (existing as any).reference_code, is_active: (existing as any).is_active }
    }

    // Generate a collision-free unique code. The extremely low collision
    // probability (~1 in 800k) makes this converge in 1 iteration almost always.
    let finalCode: string | null = null
    for (let i = 0; i < 10; i++) {
        const candidate = generateCandidateCode()
        const { data: clash } = await (supabaseAdmin
            .from('user_payment_references') as any)
            .select('id')
            .eq('reference_code', candidate)
            .single()
        if (!clash) { finalCode = candidate; break }
    }

    if (!finalCode) {
        console.error('[WalletReference] Could not generate a unique code after 10 attempts')
        return { error: 'Failed to generate a unique reference. Please try again.' }
    }

    const { error: insertError } = await (supabaseAdmin
        .from('user_payment_references') as any)
        .insert({ user_id: userId, reference_code: finalCode, is_active: true })

    if (insertError) {
        if (insertError.code === '23505') {
            const isUserDuplicate = insertError.message?.includes('user_id') || insertError.details?.includes('user_id')
            if (isUserDuplicate) {
                // Another concurrent request for the SAME user already inserted — fetch and return it.
                const { data: raceData } = await (supabaseAdmin
                    .from('user_payment_references') as any)
                    .select('reference_code, is_active')
                    .eq('user_id', userId)
                    .single()
                if (raceData) return { code: (raceData as any).reference_code, is_active: (raceData as any).is_active }
            }
            // reference_code collision with another user — extremely rare (~1 in 33M); retry once.
            if (attempt < 3) {
                console.warn(`[WalletReference] Code collision for "${finalCode}", retrying...`)
                return ensureUserPaymentReference(supabaseAdmin, userId, attempt + 1)
            }
        }
        console.error('[WalletReference] Insert error:', insertError.message)
        return { error: 'Failed to save reference. Please try again.' }
    }

    console.log(`[WalletReference] Generated code ${finalCode} for user ${userId}`)
    return { code: finalCode, is_active: true }
}
