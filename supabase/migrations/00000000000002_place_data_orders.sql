-- Capozy Hub: atomic data-bundle purchase
--
-- Apply after 00000000000001_auth_bootstrap.sql.
--
-- Before this, buying a bundle was three separate calls from the server: deduct the wallet,
-- insert the order, insert the ledger row. A crash or timeout between them left a member
-- charged with no order (or an order with no ledger entry), and every failure path needed a
-- compensating credit. place_data_orders does all of it in ONE transaction, so it either
-- happens completely or not at all:
--
--   * the wallet is debited only if the balance covers the whole batch,
--   * every order row and its wallet_transactions row are written together,
--   * a reused reference_code rolls the whole thing back, debit included, so nothing needs
--     refunding, and a replay by the same member comes back as a duplicate, not a second charge.
--
-- Prices are decided by the server before calling this (role, expiry and sub-agent pricing
-- all live in application code); this function only moves the money and records the rows.
-- It is callable only by the service role.

CREATE OR REPLACE FUNCTION public.place_data_orders(p_user_id uuid, p_orders jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count   integer;
  v_total   numeric(12,2);
  v_wallet  record;
  v_item    jsonb;
  v_id      uuid;
  v_created jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR p_orders IS NULL OR jsonb_typeof(p_orders) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  v_count := jsonb_array_length(p_orders);
  IF v_count < 1 OR v_count > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  -- Every row must carry what an order needs and a positive price.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_orders) o
    WHERE coalesce(o->>'reference_code', '') = ''
       OR coalesce(o->>'phone_number', '') = ''
       OR coalesce(o->>'network', '') = ''
       OR coalesce(o->>'size', '') = ''
       OR coalesce((o->>'price')::numeric, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  -- Replay by the same member: nothing to do, nothing to charge.
  IF EXISTS (
    SELECT 1 FROM public.orders ord
    WHERE ord.user_id = p_user_id
      AND ord.reference_code IN (SELECT o->>'reference_code' FROM jsonb_array_elements(p_orders) o)
  ) THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;

  SELECT coalesce(sum((o->>'price')::numeric), 0)::numeric(12,2)
    INTO v_total
    FROM jsonb_array_elements(p_orders) o;

  UPDATE public.wallets
     SET balance     = balance - v_total,
         total_spent = coalesce(total_spent, 0) + v_total,
         updated_at  = now()
   WHERE user_id = p_user_id
     AND balance >= v_total
  RETURNING id, balance INTO v_wallet;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_orders) LOOP
    INSERT INTO public.orders (
      user_id, phone_number, network, size, price, cost_price_at_time, role_at_time,
      status, payment_status, reference_code, fulfillment_method, category, source, api_key_id
    ) VALUES (
      p_user_id,
      v_item->>'phone_number',
      v_item->>'network',
      v_item->>'size',
      (v_item->>'price')::numeric,
      coalesce((v_item->>'cost_price')::numeric, 0),
      v_item->>'role_at_time',
      coalesce(nullif(v_item->>'status', ''), 'pending'),
      'paid',
      v_item->>'reference_code',
      coalesce(nullif(v_item->>'fulfillment_method', ''), 'auto'),
      coalesce(nullif(v_item->>'category', ''), 'data'),
      coalesce(nullif(v_item->>'source', ''), 'web'),
      nullif(v_item->>'api_key_id', '')::uuid
    )
    RETURNING id INTO v_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, description, reference, source, status
    ) VALUES (
      v_wallet.id,
      p_user_id,
      'debit',
      (v_item->>'price')::numeric,
      'Data purchase: ' || (v_item->>'size') || ' for ' || (v_item->>'phone_number'),
      v_item->>'reference_code',
      'purchase',
      'completed'
    );

    v_created := v_created || jsonb_build_object(
      'id', v_id,
      'reference_code', v_item->>'reference_code',
      'status', coalesce(nullif(v_item->>'status', ''), 'pending'),
      'network', v_item->>'network',
      'size', v_item->>'size',
      'phone_number', v_item->>'phone_number'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'duplicate', false,
    'wallet_id', v_wallet.id,
    'new_balance', v_wallet.balance,
    'total', v_total,
    'orders', v_created
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.place_data_orders(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_data_orders(uuid, jsonb) TO service_role;

-- New functions should start closed. Supabase's defaults hand EXECUTE to anon and
-- authenticated on everything created in public; a money function that forgot its own
-- REVOKE would be callable by anyone with the public key. Anything that must be callable
-- from the browser now gets an explicit GRANT.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
