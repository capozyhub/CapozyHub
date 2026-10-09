-- Capozy Hub: atomic airtime / mashup purchase
--
-- Apply after 00000000000002_place_data_orders.sql.
--
-- Airtime used to be four separate calls from the server: deduct the wallet, insert the order,
-- insert the ledger row (fire-and-forget), and a compensating credit when something failed.
-- A crash between them left a member charged with no order. place_airtime_order does it all in
-- ONE transaction:
--
--   * the wallet row is locked first, so two requests from the same member run one after the other,
--   * a reference the member already used comes back as a replay of that order, never a second charge,
--   * the same number + amount inside the duplicate window is refused (RECENT_DUPLICATE),
--   * the wallet is debited only if the balance covers the total,
--   * the order row and its wallet_transactions row are written together or not at all.
--
-- Fees, limits and role are decided by the server (lib/airtime-pricing.ts) before calling this.
-- It is callable only by the service role.

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

  -- Replay by the same member: hand back the order that already exists, charge nothing.
  SELECT id, reference_code, status, network, beneficiary_phone, airtime_amount, total_paid
    INTO v_existing
    FROM public.airtime_orders
   WHERE user_id = p_user_id AND reference_code = v_ref;
  IF v_existing.id IS NOT NULL THEN
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

  -- Same number, same amount, moments ago: almost certainly a double tap.
  IF p_dedupe_seconds > 0 AND EXISTS (
    SELECT 1 FROM public.airtime_orders
     WHERE user_id = p_user_id
       AND beneficiary_phone = v_phone
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
