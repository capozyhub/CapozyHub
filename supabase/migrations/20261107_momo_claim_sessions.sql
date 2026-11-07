-- Send & Claim redesign (2026-11-07): amount-first flow.
--
-- Old flow: user gets a permanent reference code once, is shown the payment
-- numbers, sends money whenever, then manually pastes the transaction ID to
-- claim. New flow: user types an amount first; the system shows them the
-- reference + number to pay in a modal that waits and auto-detects the
-- credit (no manual transaction-ID step for the common case).
--
-- The underlying identity + matching mechanism is UNCHANGED: a user still has
-- one permanent user_payment_references.reference_code, and the SMS-forward
-- webhook still auto-claims purely by finding that code in the incoming MoMo
-- narration (see app/api/webhooks/sms-forward/route.ts) — amount is NOT part
-- of matching, so a sender who transfers a different amount than they typed
-- still gets credited the real amount, just like today. momo_claim_sessions
-- is a thin, purely informational layer on top of that: it gives the modal
-- something to poll, a server-set countdown, and resilience across a page
-- refresh — it is never on the money-crediting critical path, so a bug in it
-- can at worst leave the UI not auto-transitioning (the user can still fall
-- back to pasting the transaction ID, which is untouched).

CREATE TABLE IF NOT EXISTS public.momo_claim_sessions (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reference_code      text NOT NULL,
    expected_amount     numeric(12,2) NOT NULL CHECK (expected_amount > 0),
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'expired', 'cancelled')),
    momo_transaction_id uuid REFERENCES public.momo_transactions(id) ON DELETE SET NULL,
    expires_at          timestamp with time zone NOT NULL,
    created_at          timestamp with time zone NOT NULL DEFAULT now(),
    updated_at          timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momo_claim_sessions_user_status ON public.momo_claim_sessions (user_id, status, created_at DESC);
-- Used by the SMS-forward webhook to find the open session to decorate after an auto-claim.
CREATE INDEX IF NOT EXISTS idx_momo_claim_sessions_open ON public.momo_claim_sessions (user_id, expires_at) WHERE status = 'pending';

ALTER TABLE public.momo_claim_sessions ENABLE ROW LEVEL SECURITY;

-- Client may only ever READ its own sessions (for the waiting modal's poll). Every write
-- (create / mark credited / cancel / expire) goes through a service-role route, matching
-- the "lock client money-adjacent writes" posture already used for the other wallet tables.
CREATE POLICY momo_claim_sessions_select_own ON public.momo_claim_sessions
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.momo_claim_sessions FROM anon, authenticated;
GRANT SELECT ON TABLE public.momo_claim_sessions TO authenticated;
GRANT ALL ON TABLE public.momo_claim_sessions TO service_role;
