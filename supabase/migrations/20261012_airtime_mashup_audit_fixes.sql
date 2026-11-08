-- Capozy Hub: airtime / Mashup audit fixes (2026-10-12)
--
-- 1. Seed the airtime + Mashup admin_settings rows. The Capozy project was created with none of
--    them, so Mashup was switched off for every customer (the server needs
--    dashboard_mashup_enabled = 'true') while the admin page showed it as on.
--    admin_settings.value is jsonb and the app stores JSON *strings* ("true", "5"), so every seed
--    goes through to_jsonb(text); a bare 'true' literal would be stored as a JSON boolean and fail
--    the app's `=== 'true'` checks.
-- 2. place_airtime_order: the duplicate-tap window now also keys on network and product type
--    (airtime then Mashup for the same number and amount is not a double tap), and a reference that
--    already exists for DIFFERENT details is refused instead of being replayed as a "success".
-- 3. refund_mashup_order: the legacy Mashup refund (flag order, credit wallet, reverse lead
--    margin, write ledger) as ONE transaction. It refuses completed orders and cannot pay twice.

-- ── 1. Settings ─────────────────────────────────────────────────────────────
INSERT INTO public.admin_settings (key, value)
SELECT s.k, to_jsonb(s.v)
FROM (VALUES
    ('dashboard_airtime_enabled',    'true'),
    ('dashboard_mashup_enabled',     'true'),

    ('airtime_enabled_mtn',          'true'),
    ('airtime_enabled_telecel',      'true'),
    ('airtime_enabled_at',           'true'),
    ('mashup_enabled_mtn',           'true'),
    ('mashup_enabled_telecel',       'true'),
    ('mashup_enabled_at',            'true'),

    ('airtime_fee_mtn_customer',     '5'),
    ('airtime_fee_mtn_agent',        '3'),
    ('airtime_fee_mtn_dealer',       '2'),
    ('airtime_fee_telecel_customer', '5'),
    ('airtime_fee_telecel_agent',    '3'),
    ('airtime_fee_telecel_dealer',   '2'),
    ('airtime_fee_at_customer',      '5'),
    ('airtime_fee_at_agent',         '3'),
    ('airtime_fee_at_dealer',        '2'),

    ('mashup_fee_mtn_customer',      '5'),
    ('mashup_fee_mtn_agent',         '3'),
    ('mashup_fee_mtn_dealer',        '2'),
    ('mashup_fee_telecel_customer',  '5'),
    ('mashup_fee_telecel_agent',     '3'),
    ('mashup_fee_telecel_dealer',    '2'),
    ('mashup_fee_at_customer',       '5'),
    ('mashup_fee_at_agent',          '3'),
    ('mashup_fee_at_dealer',         '2'),

    ('airtime_min_amount_customer',  '1'),
    ('airtime_min_amount_agent',     '1'),
    ('airtime_min_amount_dealer',    '1'),
    ('airtime_max_amount_customer',  '500'),
    ('airtime_max_amount_agent',     '1000'),
    ('airtime_max_amount_dealer',    '2000'),

    ('mashup_min_amount_customer',   '5'),
    ('mashup_min_amount_agent',      '5'),
    ('mashup_min_amount_dealer',     '5'),
    ('mashup_max_amount_customer',   '500'),
    ('mashup_max_amount_agent',      '1000'),
    ('mashup_max_amount_dealer',     '2000')
) AS s(k, v)
ON CONFLICT (key) DO NOTHING;

-- ── 2. place_airtime_order: tighter duplicate window, no silent mismatched replay ─────────────
CREATE OR REPLACE FUNCTION public.place_airtime_order(p_user_id uuid, p_order jsonb, p_dedupe_seconds integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_wallet    record;
  v_existing  record;
  v_order_id  uuid;
  v_total     numeric(12,2);
  v_airtime   numeric(12,2);
  v_ref       text;
  v_phone     text;
  v_network   text;
  v_type      text;
  v_source    text;
  v_new_bal   numeric;
BEGIN
  IF p_user_id IS NULL OR p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  v_ref     := p_order->>'reference_code';
  v_phone   := p_order->>'beneficiary_phone';
  v_network := p_order->>'network';
  v_type    := coalesce(nullif(p_order->>'type', ''), 'airtime');
  v_source  := coalesce(nullif(p_order->>'source', ''), 'web');
  v_total   := (p_order->>'total_paid')::numeric(12,2);
  v_airtime := (p_order->>'airtime_amount')::numeric(12,2);

  IF coalesce(v_ref, '') = '' OR coalesce(v_phone, '') = '' OR coalesce(v_network, '') = ''
     OR coalesce(v_total, 0) <= 0 OR coalesce(v_airtime, 0) <= 0
     OR v_type NOT IN ('airtime', 'mashup') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  -- Lock the member's wallet row. Everything below runs one request at a time per member.
  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  -- Replay by the same member: hand back the order that already exists, charge nothing. Only a
  -- genuine retry (same number, network, product and amount) is a replay; the same reference
  -- reused for something else is refused, so a client never shows "placed" for an order it did
  -- not ask for.
  SELECT id, reference_code, status, network, beneficiary_phone, airtime_amount, total_paid, type
    INTO v_existing
    FROM public.airtime_orders
   WHERE user_id = p_user_id AND reference_code = v_ref;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.beneficiary_phone IS DISTINCT FROM v_phone
       OR v_existing.network IS DISTINCT FROM v_network
       OR v_existing.type IS DISTINCT FROM v_type
       OR v_existing.total_paid IS DISTINCT FROM v_total THEN
      RAISE EXCEPTION 'REFERENCE_MISMATCH';
    END IF;
    RETURN jsonb_build_object(
      'duplicate', true,
      'order', jsonb_build_object(
        'id', v_existing.id,
        'reference_code', v_existing.reference_code,
        'status', v_existing.status,
        'network', v_existing.network,
        'beneficiary_phone', v_existing.beneficiary_phone,
        'airtime_amount', v_existing.airtime_amount,
        'total_paid', v_existing.total_paid
      )
    );
  END IF;

  -- Same number, network, product and amount, moments ago: almost certainly a double tap.
  IF p_dedupe_seconds > 0 AND EXISTS (
    SELECT 1 FROM public.airtime_orders
     WHERE user_id = p_user_id
       AND beneficiary_phone = v_phone
       AND network = v_network
       AND type = v_type
       AND total_paid = v_total
       AND created_at >= now() - make_interval(secs => p_dedupe_seconds)
  ) THEN
    RAISE EXCEPTION 'RECENT_DUPLICATE';
  END IF;

  UPDATE public.wallets
     SET balance     = balance - v_total,
         total_spent = coalesce(total_spent, 0) + v_total,
         updated_at  = now()
   WHERE id = v_wallet.id
     AND balance >= v_total
  RETURNING balance INTO v_new_bal;

  IF v_new_bal IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  INSERT INTO public.airtime_orders (
    user_id, user_role, beneficiary_phone, network, airtime_amount, fee_rate, fee_amount,
    admin_fee_amount, shop_fee_amount, total_paid, use_exact_amount, status, source,
    reference_code, type, bundle_preference, api_key_id
  ) VALUES (
    p_user_id,
    coalesce(nullif(p_order->>'user_role', ''), 'customer'),
    v_phone,
    v_network,
    v_airtime,
    coalesce((p_order->>'fee_rate')::numeric, 0),
    coalesce((p_order->>'fee_amount')::numeric, 0),
    coalesce((p_order->>'fee_amount')::numeric, 0),
    0,
    v_total,
    coalesce((p_order->>'use_exact_amount')::boolean, false),
    'pending',
    v_source,
    v_ref,
    v_type,
    nullif(p_order->>'bundle_preference', ''),
    nullif(p_order->>'api_key_id', '')::uuid
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, source, status
  ) VALUES (
    v_wallet.id,
    p_user_id,
    'debit',
    v_total,
    CASE WHEN v_type = 'mashup'
         THEN 'Mashup: GHS ' || to_char(v_airtime, 'FM999999990.00') || ' bundle for ' || v_phone || ' (' || v_network || ')'
         ELSE 'Airtime: GHS ' || to_char(v_airtime, 'FM999999990.00') || ' for ' || v_phone || ' (' || v_network || ')'
    END,
    v_ref,
    'airtime',
    'completed'
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'wallet_id', v_wallet.id,
    'new_balance', v_new_bal,
    'order', jsonb_build_object(
      'id', v_order_id,
      'reference_code', v_ref,
      'status', 'pending',
      'network', v_network,
      'beneficiary_phone', v_phone,
      'airtime_amount', v_airtime,
      'total_paid', v_total
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.place_airtime_order(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_airtime_order(uuid, jsonb, integer) TO service_role;

-- ── 3. refund_mashup_order: the legacy Mashup refund as one transaction ───────────────────────
-- Locks the order row first, so two admins (or a double click) can never both refund it. A
-- COMPLETED order is never refundable. The wallet credit, the ledger row and the order flag are
-- written together or not at all. The upline lead-margin reversal runs in a sub-block: if it
-- fails the buyer is still refunded and the error is returned so the caller can page an admin.
CREATE OR REPLACE FUNCTION public.refund_mashup_order(
  p_order_id uuid, p_actor_id uuid, p_note text DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
DECLARE
  v_o            public.orders%ROWTYPE;
  v_ref          text;
  v_wallet_id    uuid;
  v_new_balance  numeric;
  v_reversal_err text;
BEGIN
  SELECT * INTO v_o FROM public.orders
   WHERE id = p_order_id AND category = 'mtn_mashup'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_o.payment_status = 'refunded' THEN
    -- Already refunded: only re-stamp the note, never credit again.
    IF p_note IS NOT NULL THEN
      UPDATE public.orders SET fulfillment_note = p_note, updated_at = now() WHERE id = p_order_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_refunded', true);
  END IF;

  IF v_o.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_refundable', 'status', v_o.status);
  END IF;
  IF v_o.payment_status IS DISTINCT FROM 'paid' OR v_o.user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_refundable', 'payment_status', v_o.payment_status);
  END IF;

  v_ref := 'REFUND-MASHUP-' || p_order_id::text;

  INSERT INTO public.wallets (user_id, balance) VALUES (v_o.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_o.user_id FOR UPDATE;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
  VALUES (v_wallet_id, v_o.user_id, 'credit', v_o.price,
          'Refund: Special MTN Mashup order ' || v_o.reference_code, v_ref, 'refund', 'completed');

  UPDATE public.wallets
     SET balance     = coalesce(balance, 0) + v_o.price,
         total_spent = GREATEST(0, coalesce(total_spent, 0) - v_o.price),
         updated_at  = now()
   WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.orders
     SET status = 'failed', payment_status = 'refunded', fulfillment_note = p_note,
         refunded_by = p_actor_id, refunded_at = now(),
         refund_reason = left(coalesce(p_note, 'admin mashup refund'), 500),
         updated_at = now()
   WHERE id = p_order_id;

  -- A sub-agent's wallet-mode purchase credited the upline Lead at buy time; reverse it. Idempotent
  -- and a no-op for every other order.
  BEGIN
    PERFORM public.reverse_lead_margin(p_order_reference := v_o.reference_code);
  EXCEPTION WHEN OTHERS THEN
    v_reversal_err := SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true, 'refunded', true, 'amount', v_o.price, 'new_balance', v_new_balance,
    'user_id', v_o.user_id, 'reference_code', v_o.reference_code,
    'lead_reversal_error', v_reversal_err
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', true, 'already_refunded', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_mashup_order(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_mashup_order(uuid, uuid, text) TO service_role;
