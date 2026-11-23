/**
 * Hubtel Commission Services response-code classification (single source of truth for the
 * airtime webhook, reconcile cron and failure categorisation).
 * 0000 = success, 0001 = pending (callback finalizes), 0005 = state UNKNOWN (never terminal-fail),
 * 4075 = insufficient float, 4101/4103 = credentials/permission, 4000/4010 = validation.
 */
export type CommissionOutcome =
    | 'completed' // rc 0000
    | 'pending' // rc 0001 (callback will finalize)
    | 'unknown' // rc 0005 — state UNKNOWN: caller must keep order in-flight + status-check; NEVER fail/refund
    | 'insufficient_float' // rc 4075 (or message matches /insufficient/i)
    | 'config_error' // rc 4101 | 4103 (auth/permission — credentials problem, NOT float)
    | 'permanent_failure' // rc 4000 | 4010 (validation — do not retry)
    | 'failed' // rc 2000 | 2001 | any other non-0000 rc (terminal per Hubtel: "not 0000 = FAILED")

const RESPONSE_CODE_MAP: Record<string, CommissionOutcome> = {
    '0000': 'completed',
    '0001': 'pending',
    '0005': 'unknown',
    '4075': 'insufficient_float',
    '4101': 'config_error',
    '4103': 'config_error',
    '4000': 'permanent_failure',
    '4010': 'permanent_failure',
}

/**
 * String(rc) exact-match against the table above (default 'failed' for any other code,
 * including non-string/undefined/null rc). A message matching /insufficient/i upgrades the
 * outcome to 'insufficient_float' ONLY when the table classified it as generic 'failed'
 * (Hubtel sometimes signals float exhaustion via a generic failure code like 2000/2001 plus
 * a human-readable message — mirrors the airtime service, where the insufficient check only
 * runs in the failure branch). Specifically-mapped codes always keep their table outcome:
 * '0005' (unknown — the NEVER-fail/refund state), '0000'/'0001' (success/pending) and
 * '4101'/'4103' (config_error) must never be reclassified by message text.
 */
export function classifyResponseCode(rc: unknown, message?: unknown): CommissionOutcome {
    const outcome: CommissionOutcome = RESPONSE_CODE_MAP[String(rc)] ?? 'failed'
    if (outcome === 'failed' && typeof message === 'string' && /insufficient/i.test(message)) {
        return 'insufficient_float'
    }
    return outcome
}
