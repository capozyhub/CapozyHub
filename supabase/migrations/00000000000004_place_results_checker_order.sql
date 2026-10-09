-- Capozy Hub: atomic results-checker wallet purchase
--
-- Apply after 00000000000003_place_airtime_order.sql.
--
-- Buying vouchers with the wallet used to be six separate calls from the server: debit the wallet,
-- insert the order, assign the vouchers, finalise the sale, mark the order completed, write the
-- ledger row, with compensating credits (whose errors were ignored) when a step failed. A crash
-- between them could leave a member charged with no vouchers, or vouchers sold with no ledger row.
-- place_results_checker_order does all of it in ONE transaction:
--
--   * the wallet row is locked first, so two requests from the same member run one after the other,
--   * a reference the member already used comes back as a replay of that order (vouchers included),
--   * an optional duplicate window refuses the same type + quantity repeated moments later,
--   * the wallet is debited only if the balance covers the total,
--   * vouchers are assigned in the same transaction, so "sold out" rolls the debit back too,
--   * the recruiter's earning row is written BEFORE the order flips to completed, which is the
--     order the sub-agent earnings trigger needs,
--   * order, vouchers, earning and ledger row are all written together or not at all.
--
-- Prices, role and sub-agent margins are decided by the server before calling this.
-- It is callable only by the service role.

CREATE OR REPLACE FUNCTION public.place_results_checker_order(p_user_id uuid, p_order jsonb, p_dedupe_seconds integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_wallet      record;
  v_existing    record;
  v_order_id    uuid;
  v_ref         text;
  v_type_id     uuid;
  v_qty         integer;
  v_total       numeric(12,2);
  v_type_name   text;
  v_new_bal     numeric;
  v_vouchers    jsonb;
  v_inv_ids     uuid[];
  v_rec_id      uuid;
  v_rec_amount  numeric;
  v_order       jsonb;
BEGIN
  IF p_user_id IS NULL OR p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  v_ref        := p_order->>'reference_code';
  v_type_id    := nullif(p_order->>'type_id', '')::uuid;
  v_qty        := (p_order->>'quantity')::integer;
  v_total      := (p_order->>'total_paid')::numeric(12,2);
  v_type_name  := p_order->>'type_name';
  v_rec_id     := nullif(p_order->>'recruiter_id', '')::uuid;
  v_rec_amount := coalesce((p_order->>'recruiter_amount')::numeric, 0);

  IF coalesce(v_ref, '') = '' OR v_type_id IS NULL OR coalesce(v_type_name, '') = ''
     OR coalesce(v_qty, 0) < 1 OR v_qty > 1000 OR coalesce(v_total, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  -- Lock the member's wallet row. Everything below runs one request at a time per member.
  SELECT id INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  -- Replay by the same member: hand back the order that already exists, charge nothing.
  SELECT * INTO v_existing FROM public.results_checker_orders WHERE user_id = p_user_id AND reference_code = v_ref;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'order', to_jsonb(v_existing),
      'vouchers', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', inv.id, 'pin', inv.pin, 'serial_number', inv.serial_number) ORDER BY inv.created_at)
          FROM public.results_checker_inventory inv
         WHERE inv.reserved_by_order = v_existing.id AND inv.status IN ('reserved', 'sold')
      ), '[]'::jsonb)
    );
  END IF;

  IF p_dedupe_seconds > 0 AND EXISTS (
    SELECT 1 FROM public.results_checker_orders
     WHERE user_id = p_user_id AND type_id = v_type_id AND quantity = v_qty
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

  INSERT INTO public.results_checker_orders (
    user_id, user_role, shop_id, type_id, type_name, quantity, unit_price, shop_markup,
    cost_price_at_time, total_paid, status, payment_status, payment_method, reference_code,
    source, api_key_id, customer_phone, customer_email, customer_name
  ) VALUES (
    p_user_id,
    coalesce(nullif(p_order->>'user_role', ''), 'customer'),
    nullif(p_order->>'shop_id', '')::uuid,
    v_type_id,
    v_type_name,
    v_qty,
    (p_order->>'unit_price')::numeric,
    coalesce((p_order->>'shop_markup')::numeric, 0),
    (p_order->>'cost_price_at_time')::numeric,
    v_total,
    'pending',
    'completed',
    'wallet',
    v_ref,
    coalesce(nullif(p_order->>'source', ''), 'website'),
    nullif(p_order->>'api_key_id', '')::uuid,
    nullif(p_order->>'customer_phone', ''),
    nullif(p_order->>'customer_email', ''),
    nullif(p_order->>'customer_name', '')
  )
  RETURNING id INTO v_order_id;

  -- Raises INSUFFICIENT_INVENTORY when stock ran out; that rolls the debit and the order back too.
  SELECT jsonb_agg(jsonb_build_object('id', a.id, 'pin', a.pin, 'serial_number', a.serial_number)),
         array_agg(a.id)
    INTO v_vouchers, v_inv_ids
    FROM public.assign_results_checker_vouchers(v_type_id, v_qty, v_order_id) a;

  IF v_vouchers IS NULL OR coalesce(array_length(v_inv_ids, 1), 0) <> v_qty THEN
    RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';
  END IF;

  PERFORM public.finalize_results_checker_sale(v_order_id, p_user_id);

  -- Must exist before the order turns completed: that UPDATE fires the trigger which credits it.
  IF v_rec_id IS NOT NULL AND v_rec_amount > 0 THEN
    INSERT INTO public.sub_agent_order_earnings (order_reference, order_table, recruiter_id, sub_user_id, amount, status)
    VALUES (v_ref, 'results_checker_orders', v_rec_id, p_user_id, v_rec_amount, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.results_checker_orders
     SET status = 'completed',
         payment_status = 'completed',
         inventory_ids = v_inv_ids,
         fulfilled_at = now(),
         updated_at = now()
   WHERE id = v_order_id;

  SELECT to_jsonb(o) INTO v_order FROM public.results_checker_orders o WHERE o.id = v_order_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, source, status
  ) VALUES (
    v_wallet.id, p_user_id, 'debit', v_total,
    'Results Checker: ' || v_qty || 'x ' || v_type_name,
    v_ref, 'results_checker', 'completed'
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'wallet_id', v_wallet.id,
    'new_balance', v_new_bal,
    'order', v_order,
    'vouchers', v_vouchers
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.place_results_checker_order(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_results_checker_order(uuid, jsonb, integer) TO service_role;
