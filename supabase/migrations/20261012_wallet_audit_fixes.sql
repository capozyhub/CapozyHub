-- Wallet page audit fixes (2026-10-12).
--
--  1. momo_claim_attempts: the result CHECK rejected most values the claim route
--     writes (not_found, claimed_successfully, cap hits...), so failed guesses were
--     never recorded and the brute-force limits never saw them. Widen it.
--  2. reserve_momo_claim_attempt: burst limit + distinct-ID cap + per-IP cap, checked
--     and recorded atomically (per-user advisory lock) so parallel requests cannot
--     slip past the count-then-insert race.
--  3. complete_wallet_topup: marks the payment completed, credits the wallet and logs
--     the transaction in ONE transaction. Replaces credit_wallet_balance (a refund RPC
--     that also decremented total_spent) + a separate counter RPC + a separate insert.
--  4. reserve_wallet_payment: pending-payment cap, daily cap, distinct-number cap and
--     per-number cap, checked and inserted atomically (stops MoMo prompt spam).
--  5. Throttles for check-pending (Paystack calls) and submit-otp (attempt cap).
--  6. claim_momo_transaction: expired agents no longer keep the agent claim fee, and
--     the history description no longer contains mojibake.
--  7. Revoke table privileges the wallet tables never need from anon/authenticated.

-- ── 1. momo_claim_attempts ────────────────────────────────────────────────
ALTER TABLE public.momo_claim_attempts DROP CONSTRAINT IF EXISTS momo_claim_attempts_result_check;
ALTER TABLE public.momo_claim_attempts ADD CONSTRAINT momo_claim_attempts_result_check CHECK (result = ANY (ARRAY[
    'attempt', 'found', 'not_found', 'already_claimed', 'rate_limited', 'below_minimum',
    'flagged', 'voided', 'wallet_not_found', 'invalid_format', 'claim_failed',
    'claimed_successfully', 'distinct_id_cap_exceeded', 'ip_rate_limited'
]));

ALTER TABLE public.momo_claim_attempts ADD COLUMN IF NOT EXISTS ip text;
CREATE INDEX IF NOT EXISTS idx_momo_claim_attempts_user_created ON public.momo_claim_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_momo_claim_attempts_ip_created ON public.momo_claim_attempts (ip, created_at DESC) WHERE ip IS NOT NULL;

-- ── 2. Atomic claim-attempt reservation ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_momo_claim_attempt(
    p_user_id        uuid,
    p_transaction_id text,
    p_ip             text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_recent    integer;
    v_distinct  integer;
    v_known     boolean;
    v_ip_fails  integer;
    v_id        uuid;
BEGIN
    -- Serialise every claim attempt of this user: the counts below and the INSERT
    -- at the end are one critical section, so a parallel burst cannot all read "0".
    PERFORM pg_advisory_xact_lock(hashtextextended('momo_claim:' || p_user_id::text, 0));
    IF p_ip IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('momo_claim_ip:' || p_ip, 0));
    END IF;

    -- Burst limit: 3 real attempts per 30 seconds.
    SELECT count(*) INTO v_recent
    FROM public.momo_claim_attempts
    WHERE user_id = p_user_id
      AND created_at >= now() - interval '30 seconds'
      AND result NOT IN ('rate_limited', 'distinct_id_cap_exceeded', 'ip_rate_limited');

    IF v_recent >= 3 THEN
        INSERT INTO public.momo_claim_attempts (user_id, transaction_id_input, result, ip)
        VALUES (p_user_id, p_transaction_id, 'rate_limited', p_ip);
        RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited');
    END IF;

    -- Distinct-ID cap: at most 2 different IDs per hour that did not end in a claim.
    -- Re-trying the same ID is always allowed. Telco IDs are near-sequential, so
    -- guessing neighbours of a real ID is the attack this stops.
    SELECT count(DISTINCT transaction_id_input),
           COALESCE(bool_or(transaction_id_input = p_transaction_id), false)
      INTO v_distinct, v_known
    FROM public.momo_claim_attempts
    WHERE user_id = p_user_id
      AND created_at >= now() - interval '1 hour'
      AND result NOT IN ('rate_limited', 'distinct_id_cap_exceeded', 'ip_rate_limited', 'claimed_successfully');

    IF NOT v_known AND v_distinct >= 2 THEN
        INSERT INTO public.momo_claim_attempts (user_id, transaction_id_input, result, ip)
        VALUES (p_user_id, p_transaction_id, 'distinct_id_cap_exceeded', p_ip);
        RETURN jsonb_build_object('allowed', false, 'reason', 'distinct_id_cap');
    END IF;

    -- Per-IP cap: signup is free, so the per-user caps alone are bypassed by opening
    -- accounts. Deliberately generous (shared mobile-carrier NAT addresses exist).
    IF p_ip IS NOT NULL THEN
        SELECT count(*) INTO v_ip_fails
        FROM public.momo_claim_attempts
        WHERE ip = p_ip
          AND created_at >= now() - interval '1 hour'
          AND result IN ('attempt', 'not_found');

        IF v_ip_fails >= 20 THEN
            INSERT INTO public.momo_claim_attempts (user_id, transaction_id_input, result, ip)
            VALUES (p_user_id, p_transaction_id, 'ip_rate_limited', p_ip);
            RETURN jsonb_build_object('allowed', false, 'reason', 'ip_rate_limited');
        END IF;
    END IF;

    INSERT INTO public.momo_claim_attempts (user_id, transaction_id_input, result, ip)
    VALUES (p_user_id, p_transaction_id, 'attempt', p_ip)
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('allowed', true, 'attempt_id', v_id);
END;
$function$;

-- ── 3. Atomic wallet top-up completion ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_wallet_topup(
    p_reference         text,
    p_provider_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_pay         RECORD;
    v_wallet      RECORD;
    v_new_balance numeric;
BEGIN
    SELECT * INTO v_pay
    FROM public.wallet_payments
    WHERE reference = p_reference
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_pay.status = 'completed' THEN
        RETURN jsonb_build_object('status', 'already_processed');
    END IF;

    IF v_pay.status <> 'pending' THEN
        RETURN jsonb_build_object('status', 'not_pending', 'payment_status', v_pay.status);
    END IF;

    -- Membership-upgrade payments live in the same table; they must never be
    -- converted into wallet balance by the top-up path.
    IF v_pay.metadata ->> 'upgrade_type' IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'not_topup');
    END IF;

    IF v_pay.amount IS NULL OR v_pay.amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_TOPUP_AMOUNT';
    END IF;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_pay.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    -- Keep the phone/network we recorded when the charge was reserved, so the
    -- per-number limit still sees completed payments.
    UPDATE public.wallet_payments
    SET status     = 'completed',
        metadata   = CASE
                         WHEN jsonb_typeof(p_provider_metadata) = 'object'
                         THEN p_provider_metadata || jsonb_strip_nulls(jsonb_build_object(
                                  'momo_phone',   v_pay.metadata -> 'momo_phone',
                                  'momo_network', v_pay.metadata -> 'momo_network'))
                         ELSE v_pay.metadata
                     END,
        updated_at = now()
    WHERE id = v_pay.id;

    UPDATE public.wallets
    SET balance        = COALESCE(balance, 0) + v_pay.amount,
        total_credited = COALESCE(total_credited, 0) + v_pay.amount,
        updated_at     = now()
    WHERE id = v_wallet.id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, description, reference, source, status
    ) VALUES (
        v_wallet.id, v_pay.user_id, 'credit', v_pay.amount,
        'Wallet top-up via Paystack', p_reference, 'payment', 'completed'
    );

    RETURN jsonb_build_object(
        'status',      'completed',
        'user_id',     v_pay.user_id,
        'wallet_id',   v_wallet.id,
        'amount',      v_pay.amount,
        'new_balance', v_new_balance
    );
END;
$function$;

-- ── 4. Atomic charge reservation ──────────────────────────────────────────
-- Phone/network are stored in metadata so the per-number limit can count them.
CREATE INDEX IF NOT EXISTS idx_wallet_payments_momo_phone
    ON public.wallet_payments ((metadata ->> 'momo_phone'), created_at DESC)
    WHERE metadata ->> 'momo_phone' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_wallet_payment(
    p_user_id                 uuid,
    p_amount                  numeric,
    p_fee                     numeric,
    p_total                   numeric,
    p_reference               text,
    p_phone                   text,
    p_network                 text,
    p_max_pending             integer DEFAULT 5,
    p_pending_window_minutes  integer DEFAULT 15,
    p_max_daily               integer DEFAULT 20,
    p_max_numbers_per_day     integer DEFAULT 3,
    p_max_per_number_per_hour integer DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_pending    integer;
    v_daily      integer;
    v_numbers    integer;
    v_has_number boolean;
    v_per_number integer;
    v_wallet_id  uuid;
    v_payment_id uuid;
BEGIN
    -- Lock order is always user, then number, so two requests cannot deadlock.
    PERFORM pg_advisory_xact_lock(hashtextextended('wallet_pay:' || p_user_id::text, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('wallet_pay_phone:' || p_phone, 0));

    SELECT count(*) INTO v_pending
    FROM public.wallet_payments
    WHERE user_id = p_user_id
      AND status = 'pending'
      AND created_at >= now() - make_interval(mins => p_pending_window_minutes);
    IF v_pending >= p_max_pending THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'too_many_pending');
    END IF;

    SELECT count(*) INTO v_daily
    FROM public.wallet_payments
    WHERE user_id = p_user_id
      AND metadata ->> 'momo_phone' IS NOT NULL
      AND created_at >= now() - interval '24 hours';
    IF v_daily >= p_max_daily THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit');
    END IF;

    SELECT count(DISTINCT metadata ->> 'momo_phone'),
           COALESCE(bool_or(metadata ->> 'momo_phone' = p_phone), false)
      INTO v_numbers, v_has_number
    FROM public.wallet_payments
    WHERE user_id = p_user_id
      AND metadata ->> 'momo_phone' IS NOT NULL
      AND created_at >= now() - interval '24 hours';
    IF NOT v_has_number AND v_numbers >= p_max_numbers_per_day THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'too_many_numbers');
    END IF;

    -- Across ALL accounts: one number cannot be prompted over and over by many users.
    SELECT count(*) INTO v_per_number
    FROM public.wallet_payments
    WHERE metadata ->> 'momo_phone' = p_phone
      AND created_at >= now() - interval '1 hour';
    IF v_per_number >= p_max_per_number_per_hour THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'number_limited');
    END IF;

    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id;
    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id) VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id;
    END IF;
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'wallet_unavailable');
    END IF;

    INSERT INTO public.wallet_payments (
        user_id, wallet_id, amount, fee, total_amount, reference, provider, status, metadata
    ) VALUES (
        p_user_id, v_wallet_id, p_amount, p_fee, p_total, p_reference, 'paystack', 'pending',
        jsonb_build_object('momo_phone', p_phone, 'momo_network', p_network, 'flow', 'direct_charge')
    )
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'wallet_id', v_wallet_id);
END;
$function$;

-- ── 5. Throttles ──────────────────────────────────────────────────────────
ALTER TABLE public.wallet_payments ADD COLUMN IF NOT EXISTS last_checked_at timestamp with time zone;
ALTER TABLE public.wallet_payments ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0;

-- True (and stamps the row) only if the last Paystack status lookup for this payment
-- was at least p_min_seconds ago. The stamp is one atomic UPDATE, so it works across
-- serverless instances, unlike an in-memory counter.
CREATE OR REPLACE FUNCTION public.touch_wallet_payment_check(
    p_reference   text,
    p_user_id     uuid,
    p_min_seconds integer DEFAULT 4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.wallet_payments
    SET last_checked_at = now()
    WHERE reference = p_reference
      AND user_id = p_user_id
      AND (last_checked_at IS NULL OR last_checked_at < now() - make_interval(secs => p_min_seconds));
    RETURN FOUND;
END;
$function$;

-- True if an OTP submission is allowed (payment still pending, under the cap);
-- counts the attempt atomically.
CREATE OR REPLACE FUNCTION public.consume_wallet_payment_otp_attempt(
    p_reference text,
    p_user_id   uuid,
    p_max       integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.wallet_payments
    SET otp_attempts = otp_attempts + 1
    WHERE reference = p_reference
      AND user_id = p_user_id
      AND status = 'pending'
      AND otp_attempts < p_max;
    RETURN FOUND;
END;
$function$;

-- ── 6. claim_momo_transaction: agent expiry + clean description ───────────
CREATE OR REPLACE FUNCTION public.claim_momo_transaction(p_transaction_id text, p_user_id uuid, p_is_auto boolean DEFAULT false, p_ref_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_txn              RECORD;
    v_wallet           RECORD;
    v_fee_key          TEXT;
    v_min_claimable    NUMERIC;
    v_fee_percent      NUMERIC;
    v_fee_amount       NUMERIC;
    v_net_amount       NUMERIC;
    v_new_balance      NUMERIC;
    v_user_role        TEXT;
    v_agent_expires    TIMESTAMPTZ;
    v_description      TEXT;
BEGIN
    -- 1. Get user role (and agent expiry)
    SELECT role, agent_expires_at INTO v_user_role, v_agent_expires
    FROM public.users
    WHERE id = p_user_id;

    -- 2. Lock the transaction row (prevents concurrent claims)
    SELECT * INTO v_txn
    FROM public.momo_transactions
    WHERE transaction_id = p_transaction_id
    FOR UPDATE;

    -- 3. Validate it exists and is pending
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_txn.status = 'claimed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_claimed',
            'claimed_at', v_txn.claimed_at,
            'is_own_claim', (v_txn.claimed_by = p_user_id),
            'is_auto_claimed', v_txn.is_auto_claimed,
            'claimed_via_ref', v_txn.claimed_via_ref);
    END IF;

    IF v_txn.status = 'voided' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction has been voided by admin');
    END IF;

    IF v_txn.status = 'flagged' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This transaction requires admin review. Please contact support.');
    END IF;

    -- 4. Get minimum claimable amount from settings (handle JSONB safely)
    SELECT NULLIF(value#>>ARRAY[]::TEXT[], '')::NUMERIC INTO v_min_claimable
    FROM public.admin_settings
    WHERE key = 'momo_min_claimable';
    v_min_claimable := COALESCE(v_min_claimable, 1);

    -- 5. Agent fee applies only while the agent membership is active
    IF v_user_role = 'agent' AND (v_agent_expires IS NULL OR v_agent_expires > now()) THEN
        v_fee_key := 'momo_claim_fee_agent';
    ELSE
        v_fee_key := 'momo_claim_fee_customer';
    END IF;

    -- 6. Get fee percent from admin settings (handle JSONB safely)
    SELECT NULLIF(value#>>ARRAY[]::TEXT[], '')::NUMERIC INTO v_fee_percent
    FROM public.admin_settings
    WHERE key = v_fee_key;
    v_fee_percent := COALESCE(v_fee_percent, 0);

    -- 7. Compute fee and net amount entirely server-side
    v_fee_amount := ROUND((v_txn.amount * v_fee_percent / 100), 2);
    v_net_amount := v_txn.amount - v_fee_amount;

    -- 8. Enforce minimum claimable (belt-and-suspenders server check)
    IF v_net_amount < v_min_claimable THEN
        RETURN jsonb_build_object('success', false, 'error', 'below_minimum',
            'min_claimable', v_min_claimable,
            'net_amount', v_net_amount);
    END IF;

    -- 9. Get user's wallet (lock it too)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- 10. Build the description based on how it was claimed
    IF p_is_auto AND p_ref_code IS NOT NULL THEN
        v_description := 'Auto-Claim via Ref ' || p_ref_code || ' - ' || v_txn.sender_network || ' - TXN: ' || p_transaction_id;
    ELSE
        v_description := 'MoMo Claim - ' || v_txn.sender_network || ' - TXN: ' || p_transaction_id;
    END IF;

    -- 11. Update momo_transactions to claimed (with auto-claim metadata)
    UPDATE public.momo_transactions
    SET status            = 'claimed',
        claimed_by        = p_user_id,
        claimed_at        = NOW(),
        claim_fee_percent = v_fee_percent,
        claim_fee_amount  = v_fee_amount,
        net_amount        = v_net_amount,
        is_auto_claimed   = p_is_auto,
        claimed_via_ref   = p_ref_code
    WHERE id = v_txn.id;

    -- 12. Credit the user's wallet
    v_new_balance := v_wallet.balance + v_net_amount;

    UPDATE public.wallets
    SET balance        = v_new_balance,
        total_credited = total_credited + v_net_amount,
        updated_at     = NOW()
    WHERE id = v_wallet.id;

    -- 13. Log a wallet transaction for history
    INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount,
        description, reference, source, status
    ) VALUES (
        v_wallet.id,
        p_user_id,
        'credit',
        v_net_amount,
        v_description,
        'MOMO-' || p_transaction_id,
        'payment',
        'completed'
    );

    -- 14. Return full breakdown for notification dispatch
    RETURN jsonb_build_object(
        'success',        true,
        'amount',         v_txn.amount,
        'sender_name',    v_txn.sender_name,
        'sender_network', v_txn.sender_network,
        'fee_percent',    v_fee_percent,
        'fee_amount',     v_fee_amount,
        'net_amount',     v_net_amount,
        'new_balance',    v_new_balance,
        'transaction_id', p_transaction_id,
        'is_auto_claimed', p_is_auto,
        'claimed_via_ref', p_ref_code
    );
END;
$function$;

-- Repair descriptions written by the old function ("a€”" mojibake for an em dash).
UPDATE public.wallet_transactions
SET description = replace(description, E'â€”', '-')
WHERE description LIKE E'%â€”%';

-- ── Function access: server-side (service_role) only ──────────────────────
REVOKE ALL ON FUNCTION public.reserve_momo_claim_attempt(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_momo_claim_attempt(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.complete_wallet_topup(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wallet_topup(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_wallet_payment(uuid, numeric, numeric, numeric, text, text, text, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_wallet_payment(uuid, numeric, numeric, numeric, text, text, text, integer, integer, integer, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.touch_wallet_payment_check(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_wallet_payment_check(text, uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.consume_wallet_payment_otp_attempt(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_wallet_payment_otp_attempt(text, uuid, integer) TO service_role;

-- claim_momo_transaction was replaced in place; re-assert its (already restrictive) grants.
REVOKE ALL ON FUNCTION public.claim_momo_transaction(text, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_momo_transaction(text, uuid, boolean, text) TO service_role;

-- ── 7. Table privileges ───────────────────────────────────────────────────
-- Supabase's default grants hand every role TRUNCATE/TRIGGER/REFERENCES. RLS does not
-- cover TRUNCATE, and none of these tables need client-side DDL-ish privileges. The
-- three money tables only ever have SELECT policies, so client writes go too.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
    public.wallets, public.wallet_transactions, public.wallet_payments,
    public.momo_claim_attempts, public.momo_transactions, public.user_payment_references
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
    public.wallets, public.wallet_transactions, public.wallet_payments
FROM anon, authenticated;
