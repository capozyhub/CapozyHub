-- Dynamic Agent / Dealer membership plans.
--
-- WHY
-- Agent (3d/14d/30d/permanent) and Dealer (1m/3m/6m) plans used to be a closed set,
-- hardcoded as TypeScript unions, admin_settings keys, and a fixed CASE in
-- process_wallet_upgrade. An admin could only edit the 7 fixed prices — never add a
-- plan, change a plan's length, or remove one.
--
-- WHAT
-- One table, role_upgrade_plans, is now the single source of truth for every Agent and
-- Dealer plan: label, duration (days), price, old price (for the strikethrough), and
-- whether it is active. process_wallet_upgrade looks the plan up by (upgrade_type, slug)
-- instead of trusting a fixed list, so admin-created plans charge and expire correctly
-- with no further migration.
--
-- `slug` is the stable text identifier already used elsewhere (users.auto_upgrade_plan,
-- membership_upgrades.plan). The seven rows below keep their historical codes ('3d',
-- '1m', …) so existing auto-renew settings and audit rows keep meaning; a plan an admin
-- creates from now on gets its own id as its slug.
--
-- Deleting a plan here is a hard delete (by design — an owner decision, not a bug): any
-- user with auto_upgrade_plan pointing at a deleted slug simply gets INVALID_PLAN from
-- the RPC on their next renewal attempt, and the auto-upgrade cron already turns the flag
-- off and tells them when that happens (PERMANENT_FAILURE_CODES in app/api/cron/auto-upgrade).

CREATE TABLE IF NOT EXISTS public.role_upgrade_plans (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upgrade_type    text NOT NULL CHECK (upgrade_type IN ('agent', 'dealer')),
    slug            text NOT NULL,
    label           text NOT NULL,
    -- NULL only valid for an agent plan: it means lifetime (no expiry).
    duration_days   integer,
    price           numeric(12,2) NOT NULL CHECK (price > 0),
    old_price       numeric(12,2) CHECK (old_price IS NULL OR old_price >= 0),
    is_popular      boolean NOT NULL DEFAULT false,
    sort_order      integer NOT NULL DEFAULT 0,
    active          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT role_upgrade_plans_lifetime_agent_only_ck
        CHECK (duration_days IS NOT NULL OR upgrade_type = 'agent'),
    CONSTRAINT role_upgrade_plans_duration_positive_ck
        CHECK (duration_days IS NULL OR duration_days > 0),
    CONSTRAINT role_upgrade_plans_type_slug_uk UNIQUE (upgrade_type, slug)
);

CREATE INDEX IF NOT EXISTS role_upgrade_plans_active_idx
    ON public.role_upgrade_plans (upgrade_type, active, sort_order);

ALTER TABLE public.role_upgrade_plans ENABLE ROW LEVEL SECURITY;
-- No policies: admin API routes (validateAdminAccess) and the charge path both use the
-- service-role client, same as membership_upgrades.
REVOKE ALL ON public.role_upgrade_plans FROM PUBLIC, anon, authenticated;

-- Seed the plans that exist today, pulling current prices from admin_settings so an
-- admin's existing price edits are not silently reset by this migration.
INSERT INTO public.role_upgrade_plans (upgrade_type, slug, label, duration_days, price, old_price, is_popular, sort_order, active)
SELECT * FROM (VALUES
    ('agent'::text,  '3d'::text,        '3 Days Agent Pass'::text,    3::integer,   9.99::numeric,   NULL::numeric, false, 1, true),
    ('agent',        '14d',             '14 Days Agent Pass',         14,           49.99,           NULL,          true,  2, true),
    ('agent',        '30d',             '30 Days Agent Pass',         30,           99.99,           NULL,          false, 3, true),
    ('agent',        'permanent',       'Permanent Agent Pass',       NULL,         149.99,          NULL,          false, 4, true),
    ('dealer',       '1m',              '1 Month Dealer Pass',        30,           99.99,           NULL,          false, 1, true),
    ('dealer',       '3m',              '3 Months Dealer Pass',       90,           199.99,          NULL,          false, 2, true),
    ('dealer',       '6m',              '6 Months Dealer Pass',       180,          299.99,          NULL,          false, 3, true)
) AS defaults(upgrade_type, slug, label, duration_days, price, old_price, is_popular, sort_order, active)
WHERE NOT EXISTS (SELECT 1 FROM public.role_upgrade_plans);

-- Pull live admin_settings prices over the defaults above, if any were set.
UPDATE public.role_upgrade_plans p
SET price = s.value::numeric
FROM public.admin_settings s
WHERE p.slug = replace(replace(s.key, 'agent_upgrade_price_', ''), 'dealer_upgrade_price_', '')
  AND s.key IN (
      'agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d', 'agent_upgrade_price_permanent',
      'dealer_upgrade_price_1m', 'dealer_upgrade_price_3m', 'dealer_upgrade_price_6m'
  )
  AND s.value ~ '^[0-9]+(\.[0-9]+)?$'
  AND s.value::numeric > 0;

UPDATE public.role_upgrade_plans p
SET old_price = s.value::numeric
FROM public.admin_settings s
WHERE p.upgrade_type = 'agent'
  AND p.slug = replace(s.key, 'agent_upgrade_price_', '')
  AND s.key = 'agent_upgrade_price_' || p.slug || '_old'
  AND s.value ~ '^[0-9]+(\.[0-9]+)?$'
  AND s.value::numeric > 0;

-- The audit trail must survive a plan being renamed or deleted (it is a financial
-- record, same reasoning as the missing FK on user_id below). Drop the old fixed-list
-- CHECK so any slug — including one an admin created and later removed — can be recorded.
ALTER TABLE public.membership_upgrades DROP CONSTRAINT IF EXISTS membership_upgrades_plan_check;
COMMENT ON COLUMN public.membership_upgrades.plan IS
    'Snapshot of role_upgrade_plans.slug at purchase time. No FK: must survive the plan being edited or deleted.';

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
    v_plan          public.role_upgrade_plans%ROWTYPE;
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

    SELECT * INTO v_plan
    FROM public.role_upgrade_plans
    WHERE upgrade_type = p_upgrade_type AND slug = p_plan AND active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PLAN', 'message', 'Unknown or inactive plan');
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

    -- 8. New role / expiry (extensions stack onto a still-future expiry). Duration
    --    comes from the plan row now, not a fixed CASE, so an admin-edited or
    --    admin-created plan charges the right number of days with no code change. -----
    IF p_upgrade_type = 'agent' THEN
        v_new_role    := 'agent';
        v_prev_expiry := v_user.agent_expires_at;
    ELSE
        v_new_role    := 'dealer';
        v_prev_expiry := v_user.dealer_expires_at;
    END IF;

    IF v_plan.duration_days IS NULL THEN
        v_new_expiry := NULL; -- lifetime (agent only; enforced by the table CHECK)
    ELSE
        -- interval addition clamps to month end (Aug 31 + 1 month = Sep 30); JS setMonth overflowed.
        v_new_expiry := GREATEST(COALESCE(v_prev_expiry, v_now), v_now) + make_interval(days => v_plan.duration_days);
    END IF;

    v_was_extension := (v_user.role = v_new_role) AND v_prev_expiry IS NOT NULL AND v_prev_expiry > v_now;

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
            auto_upgrade_enabled = CASE WHEN v_plan.duration_days IS NULL THEN false ELSE auto_upgrade_enabled END,
            auto_upgrade_plan    = CASE WHEN v_plan.duration_days IS NULL THEN NULL ELSE auto_upgrade_plan END,
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
