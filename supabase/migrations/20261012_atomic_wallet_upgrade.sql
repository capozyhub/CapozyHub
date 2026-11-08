-- Atomic wallet-funded membership upgrade (agent / dealer).
--
-- WHY
-- lib/wallet-upgrade.ts used to do: read user -> debit wallet (RPC) -> insert ledger row
-- -> write an ABSOLUTE expiry, as four separate statements. That allowed:
--   * double charge: two concurrent requests (two tabs, retry after a timeout, cron +
--     manual) both debited, but both computed the same expiry from the same stale read,
--     so the user paid twice and got one extension;
--   * a lifetime agent buying a timed pass, which overwrote agent_expires_at = NULL with
--     now()+N days (they paid to lose lifetime status);
--   * a debit with no ledger row (insert result ignored) or no role grant (update failed
--     after the debit, no refund);
--   * no shop repricing on upgrade (the downgrade paths reprice, the upgrade path did
--     not), which inflates prices on the next downgrade.
--
-- WHAT
-- One SECURITY DEFINER function, one transaction:
--   lock users row -> idempotent replay -> status / eligibility / auto-renew re-check
--   -> lock wallet -> balance check -> debit + ledger -> role + expiry -> reprice -> audit.
-- Callable by service_role only. Prices are passed in by the server (resolved from
-- admin_settings); the function only validates them as positive.

CREATE TABLE IF NOT EXISTS public.membership_upgrades (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- No FK on purpose: this is a financial audit trail and must survive account deletion.
    user_id           uuid NOT NULL,
    upgrade_type      text NOT NULL CHECK (upgrade_type IN ('agent', 'dealer')),
    plan              text NOT NULL CHECK (plan IN ('3d', '14d', '30d', 'permanent', '1m', '3m', '6m')),
    price             numeric(12,2) NOT NULL CHECK (price > 0),
    is_auto           boolean NOT NULL DEFAULT false,
    idempotency_key   text,
    previous_role     text NOT NULL,
    new_role          text NOT NULL,
    previous_expiry   timestamptz,
    new_expiry        timestamptz,
    was_extension     boolean NOT NULL DEFAULT false,
    balance_after     numeric(12,2),
    reprice_failed    boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_upgrades_user_idem_key
    ON public.membership_upgrades (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS membership_upgrades_user_created_idx
    ON public.membership_upgrades (user_id, created_at DESC);

ALTER TABLE public.membership_upgrades ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) reads or writes this table.
REVOKE ALL ON public.membership_upgrades FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_wallet_upgrade(
    p_user_id          uuid,
    p_upgrade_type     text,
    p_plan             text,
    p_price            numeric,
    p_plan_label       text,
    p_idempotency_key  text        DEFAULT NULL,
    p_is_auto          boolean     DEFAULT false,
    p_due_before       timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user          public.users%ROWTYPE;
    v_existing      public.membership_upgrades%ROWTYPE;
    v_wallet_id     uuid;
    v_balance       numeric;
    v_new_balance   numeric;
    v_now           timestamptz := now();
    v_prev_expiry   timestamptz;
    v_new_expiry    timestamptz;
    v_new_role      text;
    v_was_extension boolean;
    v_due           boolean;
    v_reprice_ok    boolean := true;
    v_upgrade_id    uuid;
    v_reference     text;
BEGIN
    -- 1. Input validation -------------------------------------------------------
    IF p_upgrade_type NOT IN ('agent', 'dealer') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Unknown upgrade type');
    END IF;
    IF (p_upgrade_type = 'agent'  AND p_plan NOT IN ('3d', '14d', '30d', 'permanent'))
    OR (p_upgrade_type = 'dealer' AND p_plan NOT IN ('1m', '3m', '6m')) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Unknown plan for this upgrade type');
    END IF;
    IF p_price IS NULL OR p_price <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PRICE', 'message', 'Upgrade price is not valid');
    END IF;

    -- 2. Serialise everything for this user on the users row ---------------------
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found');
    END IF;

    -- 3. Idempotent replay (a retry of the same request must never charge twice) --
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.membership_upgrades
        WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            IF v_existing.upgrade_type <> p_upgrade_type OR v_existing.plan <> p_plan THEN
                RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_KEY_REUSED',
                    'message', 'This request key was already used for a different purchase');
            END IF;
            RETURN jsonb_build_object(
                'ok', true, 'already_processed', true, 'upgrade_id', v_existing.id,
                'previous_role', v_existing.previous_role, 'new_role', v_existing.new_role,
                'previous_expiry', v_existing.previous_expiry, 'new_expiry', v_existing.new_expiry,
                'was_extension', v_existing.was_extension, 'new_balance', v_existing.balance_after,
                'price', v_existing.price
            );
        END IF;
    END IF;

    -- 4. Account + auto-renew state, re-checked under the lock --------------------
    IF v_user.status IS DISTINCT FROM 'active' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Account is not active');
    END IF;

    IF p_is_auto AND (NOT v_user.auto_upgrade_enabled OR v_user.auto_upgrade_plan IS DISTINCT FROM p_plan) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'AUTO_DISABLED', 'message', 'Auto-upgrade is no longer enabled for this plan');
    END IF;

    -- 5. Eligibility ----------------------------------------------------------------
    IF p_upgrade_type = 'dealer' THEN
        IF NOT (v_user.role = 'dealer' OR (v_user.role = 'agent' AND v_user.agent_expires_at IS NULL)) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE',
                'message', 'Dealer membership requires a Lifetime Agent or current Dealer account');
        END IF;
    ELSE
        IF v_user.role NOT IN ('customer', 'agent') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE',
                'message', 'Agent membership is only available to customers and agents');
        END IF;
        -- A NULL expiry on an agent means lifetime. Buying a timed pass would overwrite
        -- it with a finite date, so refuse outright.
        IF v_user.role = 'agent' AND v_user.agent_expires_at IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_LIFETIME',
                'message', 'You already have lifetime Agent access');
        END IF;
    END IF;

    -- 6. Auto-renew only fires when actually due (guards cron overlap / stale reads) -
    IF p_due_before IS NOT NULL THEN
        v_due := CASE
            WHEN v_user.role = 'customer' THEN true
            WHEN p_upgrade_type = 'dealer' AND v_user.role = 'dealer'
                THEN v_user.dealer_expires_at IS NOT NULL AND v_user.dealer_expires_at <= p_due_before
            WHEN p_upgrade_type = 'dealer' AND v_user.role = 'agent' THEN true
            WHEN p_upgrade_type = 'agent'  AND v_user.role = 'agent'
                THEN v_user.agent_expires_at <= p_due_before
            ELSE false
        END;
        IF NOT v_due THEN
            RETURN jsonb_build_object('ok', false, 'code', 'NOT_DUE', 'message', 'Membership is not due for renewal');
        END IF;
    END IF;

    -- 7. Wallet ---------------------------------------------------------------------
    SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'WALLET_NOT_FOUND', 'message', 'Wallet not found');
    END IF;
    IF v_balance < p_price THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'message', 'Insufficient wallet balance',
            'balance', v_balance, 'required', p_price);
    END IF;

    -- 8. New role / expiry (extensions stack onto a still-future expiry) ---------------
    IF p_upgrade_type = 'agent' THEN
        v_new_role    := 'agent';
        v_prev_expiry := v_user.agent_expires_at;
        IF p_plan = 'permanent' THEN
            v_new_expiry := NULL;
        ELSE
            v_new_expiry := GREATEST(COALESCE(v_prev_expiry, v_now), v_now) + make_interval(days =>
                CASE p_plan WHEN '3d' THEN 3 WHEN '14d' THEN 14 ELSE 30 END);
        END IF;
        v_was_extension := v_user.role = 'agent' AND v_prev_expiry IS NOT NULL AND v_prev_expiry > v_now;
    ELSE
        v_new_role    := 'dealer';
        v_prev_expiry := v_user.dealer_expires_at;
        -- interval addition clamps to month end (Aug 31 + 1 month = Sep 30); JS setMonth overflowed.
        v_new_expiry := GREATEST(COALESCE(v_prev_expiry, v_now), v_now) + make_interval(months =>
            CASE p_plan WHEN '1m' THEN 1 WHEN '3m' THEN 3 ELSE 6 END);
        v_was_extension := v_user.role = 'dealer';
    END IF;

    -- 9. Debit + ledger (same transaction: neither can exist without the other) ----------
    UPDATE public.wallets
    SET balance = balance - p_price,
        total_spent = COALESCE(total_spent, 0) + p_price,
        updated_at = now()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    v_reference := 'upgrade_' || p_upgrade_type || '_' || gen_random_uuid()::text;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status, metadata)
    VALUES (
        v_wallet_id, p_user_id, 'debit', p_price,
        CASE WHEN p_is_auto THEN 'Auto-upgrade: ' ELSE 'Upgrade purchase: ' END || p_plan_label,
        v_reference, 'purchase', 'completed',
        jsonb_build_object('kind', 'membership_upgrade', 'upgrade_type', p_upgrade_type, 'plan', p_plan, 'is_auto', p_is_auto)
    );

    -- 10. Grant the role. auth.uid() is NULL for the service role, so the privilege-guard
    --     trigger lets this through (same as every other legitimate role change). -------
    IF p_upgrade_type = 'agent' THEN
        UPDATE public.users
        SET role = 'agent',
            agent_expires_at = v_new_expiry,
            -- Lifetime makes any timed agent auto-renew plan meaningless; switch it off.
            auto_upgrade_enabled = CASE WHEN p_plan = 'permanent' AND auto_upgrade_plan IN ('3d', '14d', '30d', 'permanent')
                                        THEN false ELSE auto_upgrade_enabled END,
            auto_upgrade_plan    = CASE WHEN p_plan = 'permanent' AND auto_upgrade_plan IN ('3d', '14d', '30d', 'permanent')
                                        THEN NULL ELSE auto_upgrade_plan END,
            updated_at = now()
        WHERE id = p_user_id;
    ELSE
        UPDATE public.users
        SET role = 'dealer',
            dealer_expires_at = v_new_expiry,
            updated_at = now()
        WHERE id = p_user_id;
    END IF;

    -- 11. Keep shop margins intact on a tier change, exactly as the downgrade paths and the
    --     admin role route already do. A failure must not undo a paid upgrade, so it is
    --     isolated in a sub-transaction and flagged for reconciliation instead. ----------
    IF v_user.role IS DISTINCT FROM v_new_role THEN
        BEGIN
            PERFORM public.adjust_shop_pricing_for_role_change(p_user_id, v_user.role, v_new_role);
            UPDATE public.shop_profiles
            SET paystack_fee_percent = NULL,
                withdrawal_fee_percent = NULL,
                withdrawal_fee_flat = NULL,
                min_withdrawal_amount = NULL,
                updated_at = now()
            WHERE owner_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN
            v_reprice_ok := false;
            RAISE WARNING 'process_wallet_upgrade: shop reprice failed for % (% -> %): %',
                p_user_id, v_user.role, v_new_role, SQLERRM;
        END;
    END IF;

    -- 12. Audit row (also the idempotency record) ---------------------------------------
    INSERT INTO public.membership_upgrades (
        user_id, upgrade_type, plan, price, is_auto, idempotency_key,
        previous_role, new_role, previous_expiry, new_expiry, was_extension, balance_after, reprice_failed
    ) VALUES (
        p_user_id, p_upgrade_type, p_plan, p_price, p_is_auto, p_idempotency_key,
        v_user.role, v_new_role, v_prev_expiry, v_new_expiry, v_was_extension, v_new_balance, NOT v_reprice_ok
    )
    RETURNING id INTO v_upgrade_id;

    RETURN jsonb_build_object(
        'ok', true, 'already_processed', false, 'upgrade_id', v_upgrade_id,
        'previous_role', v_user.role, 'new_role', v_new_role,
        'previous_expiry', v_prev_expiry, 'new_expiry', v_new_expiry,
        'was_extension', v_was_extension, 'new_balance', v_new_balance, 'price', p_price
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_wallet_upgrade(uuid, text, text, numeric, text, text, boolean, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_wallet_upgrade(uuid, text, text, numeric, text, text, boolean, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_upgrade(uuid, text, text, numeric, text, text, boolean, timestamptz) TO service_role;
