-- Removes every data-bundle supplier's DB footprint. Capozy runs with no inherited
-- supplier (see docs/stage-1-5-scope-down.md, "Suppliers") -- all the app code that
-- wrote these columns/rows/functions was removed in the same pass as this migration.
-- Rexamart (the new supplier) uses the generic orders.supplier_reference column
-- added here and fulfillment_method = 'rexamart'.
--
-- Dependents found on the live project before applying (a bare DROP COLUMN would
-- have broken both):
--   * public.claim_order_retry() NULLed several of these columns on every retry --
--     plpgsql only fails at call time, so dropping the columns alone would have
--     silently broken retries. Rewritten below without them.
--   * public.shop_orders_effective selected three of them -- recreated without.
--   * orders_fulfillment_method_check only allowed the old supplier names, so it
--     would have rejected 'rexamart' on every dispatch -- replaced below.
--
-- Deliberately NOT touched:
--   - orders.fulfillment_method, orders.dispatch_claimed_at, orders.fulfillment_note,
--     orders.error_message, shop_orders.fulfillment_reference,
--     order_retry_attempts.supplier / supplier_reference -- generic plumbing.
--   - airtime_orders.fulfilled_by (uuid, FK to users) -- which admin fulfilled an
--     airtime order by hand; unrelated despite the similar name.
--   - public.fulfillment_logs -- an empty pre-Capozy relic table with a codecraft
--     column; left for a separate cleanup.

-- Generic supplier reference (cleared by claim_order_retry below).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_reference text;

-- ---- view that selects some of the columns being dropped ----
DROP VIEW IF EXISTS public.shop_orders_effective;

-- ---- orders: per-supplier reference/identifier columns ----
ALTER TABLE public.orders
    DROP COLUMN IF EXISTS codecraft_reference,
    DROP COLUMN IF EXISTS dakazina_reference,
    DROP COLUMN IF EXISTS dakazina_order_code,
    DROP COLUMN IF EXISTS ghdata_order_id,
    DROP COLUMN IF EXISTS bundleportal_reference,
    DROP COLUMN IF EXISTS hendylinks_order_id,
    DROP COLUMN IF EXISTS atishare_console_reference,
    DROP COLUMN IF EXISTS atishare_console_transaction_id,
    DROP COLUMN IF EXISTS spfastit_reference;

-- ---- shop_orders: same, plus the supplier-name stamp ----
ALTER TABLE public.shop_orders
    DROP COLUMN IF EXISTS codecraft_reference_id,
    DROP COLUMN IF EXISTS dakazina_reference,
    DROP COLUMN IF EXISTS fulfilled_by;

-- ---- fulfillment_method: only the generic markers + the one real supplier ----
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_method_check
    CHECK (fulfillment_method IN ('auto', 'manual', 'rexamart'));

-- ---- recreate the view without the dropped columns (security_invoker preserved) ----
CREATE VIEW public.shop_orders_effective
WITH (security_invoker = true) AS
SELECT so.id,
    so.shop_id,
    so.package_id,
    so.guest_phone,
    so.network,
    so.package_size,
    so.selling_price,
    so.cost_price,
    so.profit,
    so.paystack_reference,
    so.status,
    so.fulfillment_reference,
    so.error_message,
    so.created_at,
    so.updated_at,
    so.admin_cost_at_time,
    so.owner_role_at_time,
    so.source,
    so.refunded_by,
    so.refunded_at,
    so.refund_reason,
    so.refund_method,
    so.parent_shop_id,
    so.parent_profit,
    so.payer_momo_number,
    so.payer_momo_name,
    so.payer_momo_network,
    so.payer_momo_resolved_at,
    COALESCE(retry.status, mirror.status, so.status) AS effective_status,
    COALESCE(retry.id, mirror.id) AS current_order_id,
    COALESCE(retry.refunded_at, mirror.refunded_at) AS current_refunded_at,
    COALESCE(retry.retry_count, mirror.retry_count) AS current_retry_count,
    COALESCE(retry.retry_from_status, mirror.retry_from_status) AS current_retry_from_status,
    COALESCE(retry.retry_of_order_id, mirror.retry_of_order_id) AS current_retry_of_order_id,
    COALESCE(retry.retried_by_role, mirror.retried_by_role) AS current_retried_by_role,
    COALESCE(retry.self_completed_at, mirror.self_completed_at) AS current_self_completed_at,
    COALESCE(retry.self_completed_by_role, mirror.self_completed_by_role) AS current_self_completed_by_role,
    mirror.id AS mirror_order_id,
    mirror.refunded_at AS mirror_refunded_at,
    mirror.retry_count,
    mirror.retry_from_status,
    mirror.retry_of_order_id,
    mirror.retried_by_role
FROM shop_orders so
    LEFT JOIN orders mirror ON mirror.shop_order_id = so.id
    LEFT JOIN LATERAL (
        SELECT o2.id,
            o2.status,
            o2.refunded_at,
            o2.retry_count,
            o2.retry_from_status,
            o2.retry_of_order_id,
            o2.retried_by_role,
            o2.self_completed_at,
            o2.self_completed_by_role
        FROM orders o2
        WHERE o2.retry_of_order_id = mirror.id
        ORDER BY o2.created_at DESC
        LIMIT 1
    ) retry ON mirror.id IS NOT NULL;

-- The app only ever SELECTs from this view (it is a join, so not writable anyway).
REVOKE ALL ON public.shop_orders_effective FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shop_orders_effective TO authenticated, service_role;

-- ---- claim_order_retry: identical to the live definition except the dropped
-- supplier columns are no longer cleared, and supplier_reference is. CREATE OR
-- REPLACE keeps the existing EXECUTE grants. ----
CREATE OR REPLACE FUNCTION public.claim_order_retry(p_order_id uuid, p_actor_id uuid, p_actor_role text, p_charge_amount numeric DEFAULT 0, p_reference_code text DEFAULT NULL::text, p_cost_price numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_o public.orders%ROWTYPE;
  v_attempt_no int;
  v_funding_user uuid;
  v_wallet_id uuid;
  v_balance numeric;
  v_new_order_id uuid;
  v_ref text;
BEGIN
  SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF p_actor_role NOT IN ('admin', 'user') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_actor_role');
  END IF;

  IF v_o.status = 'failed' AND p_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;

  IF v_o.status = 'refunded' AND p_actor_role = 'user' AND v_o.user_id IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  IF v_o.status NOT IN ('failed', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_retryable', 'status', v_o.status);
  END IF;

  IF v_o.last_retry_at IS NOT NULL AND v_o.last_retry_at + interval '60 seconds' > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'retry_too_soon',
      'retry_after', v_o.last_retry_at + interval '60 seconds');
  END IF;

  IF v_o.retry_count >= 3 THEN
    IF v_o.last_retry_at + interval '24 hours' > now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'retry_locked',
        'until', v_o.last_retry_at + interval '24 hours');
    END IF;
    v_o.retry_count := 0;
  END IF;

  v_attempt_no := v_o.retry_count + 1;

  IF v_o.status = 'failed' THEN
    UPDATE public.orders SET
      status = 'pending',
      supplier_reference = NULL,
      fulfillment_method = NULL,
      error_message = NULL,
      download_batch_id = NULL,
      retry_count = v_attempt_no,
      last_retry_at = now(),
      retry_from_status = 'failed',
      retried_by = p_actor_id,
      retried_by_role = p_actor_role,
      updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_retry_attempts
      (source_order_id, attempt_no, mode, actor_id, actor_role, charged_amount, status)
    VALUES
      (p_order_id, v_attempt_no, 'in_place', p_actor_id, p_actor_role, 0, 'claimed');

    RETURN jsonb_build_object('ok', true, 'mode', 'in_place',
      'target_order_id', p_order_id, 'attempt_no', v_attempt_no, 'charged_amount', 0,
      'reference_code', NULL);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE retry_of_order_id = p_order_id AND status IN ('processing', 'completed')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'retry_already_in_progress');
  END IF;

  IF v_o.shop_order_id IS NOT NULL THEN
    DECLARE v_so public.shop_orders%ROWTYPE;
    BEGIN
      SELECT * INTO v_so FROM public.shop_orders WHERE id = v_o.shop_order_id;
      IF v_so.refund_method = 'paystack' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'paystack_refund_no_wallet');
      END IF;
      SELECT owner_id INTO v_funding_user FROM public.shop_profiles WHERE id = v_so.shop_id;
      IF v_funding_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'owner_not_found');
      END IF;
    END;
  ELSE
    v_funding_user := v_o.user_id;
    IF v_funding_user IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'no_wallet_user');
    END IF;
  END IF;

  IF p_charge_amount IS NULL OR p_charge_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_charge_amount');
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (v_funding_user, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT id, balance INTO v_wallet_id, v_balance FROM public.wallets WHERE user_id = v_funding_user FOR UPDATE;

  IF v_balance < p_charge_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance',
      'required', p_charge_amount, 'available', v_balance);
  END IF;

  v_new_order_id := gen_random_uuid();
  v_ref := 'RETRY-' || p_order_id::text || '-' || v_attempt_no::text;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_funding_user, 'debit', p_charge_amount,
            'Retry of order ' || v_o.reference_code, v_ref, 'retry', 'completed');
  UPDATE public.wallets SET balance = balance - p_charge_amount WHERE id = v_wallet_id;

  INSERT INTO public.orders (
    id, user_id, phone_number, network, size, price, cost_price_at_time,
    status, payment_status, reference_code, category, role_at_time, source,
    shop_name, retry_of_order_id, retry_from_status, retried_by, retried_by_role,
    retry_count, last_retry_at
  ) VALUES (
    v_new_order_id, v_funding_user, v_o.phone_number, v_o.network, v_o.size,
    p_charge_amount, COALESCE(p_cost_price, v_o.cost_price_at_time),
    'pending', 'paid', COALESCE(p_reference_code, 'RTY-' || v_new_order_id::text),
    v_o.category, v_o.role_at_time, v_o.source,
    v_o.shop_name, p_order_id, 'refunded', p_actor_id, p_actor_role,
    0, NULL
  );

  UPDATE public.orders SET
    retry_count = v_attempt_no,
    last_retry_at = now(),
    retried_by = p_actor_id,
    retried_by_role = p_actor_role
  WHERE id = p_order_id;

  INSERT INTO public.order_retry_attempts
    (source_order_id, attempt_no, new_order_id, mode, actor_id, actor_role,
     charged_amount, funding_wallet_user_id, status)
  VALUES
    (p_order_id, v_attempt_no, v_new_order_id, 'new_order', p_actor_id, p_actor_role,
     p_charge_amount, v_funding_user, 'claimed');

  RETURN jsonb_build_object('ok', true, 'mode', 'new_order',
    'target_order_id', v_new_order_id, 'attempt_no', v_attempt_no,
    'charged_amount', p_charge_amount,
    'reference_code', (SELECT reference_code FROM public.orders WHERE id = v_new_order_id));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'duplicate_attempt');
END;
$function$;

-- ---- AT-iShare Console manual-send ledger (supplier-specific table, empty) ----
DROP TABLE IF EXISTS public.atishare_console_manual_sends;

-- ---- Supplier connect/disconnect RPC -- the old multi-supplier toggle ----
DROP FUNCTION IF EXISTS public.toggle_fulfillment_supplier_network(text, text, boolean);

-- ---- dead admin_settings rows from the old supplier setup. fulfillment_settings is
-- KEPT: Rexamart stores its per-network config under that key. ----
DELETE FROM public.admin_settings WHERE key IN (
    'mtn_codecraft_fallback',
    'mtn_agentportal_fallback',
    'mtn_bundleportal_fallback',
    'mtn_hendylinks_fallback',
    'mtn_express_delivery_enabled'
);
