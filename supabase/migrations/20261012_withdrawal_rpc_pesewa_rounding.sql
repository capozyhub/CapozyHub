-- process_shop_withdrawal: enforce whole-pesewa amounts and round the fee.
--
-- shop_wallets.balance and shop_wallet_transactions.amount/fee/net_amount are
-- numeric(12,2), but the function did unrounded arithmetic. A request for 10.005
-- debited the balance to 2 dp (rounding the balance, not the amount) while the
-- stored amount/net rounded the other way, so a payout could exceed the debit by
-- 1 pesewa, and fee + net could differ from amount by 1 pesewa (2026-10-12 audit).
--
-- Changes vs 20261003_remove_subagent_withdrawal_parent_approval.sql (everything
-- else is reproduced unchanged):
--   * reject p_amount with more than 2 decimal places
--   * v_fee := GREATEST(round(p_fee, 2), round(computed fee, 2))  — rounded, still
--     never below the server-computed fee
--   * v_net := p_amount - v_fee (both now exact 2 dp, so fee + net = amount)
CREATE OR REPLACE FUNCTION public.process_shop_withdrawal(p_wallet_id uuid, p_amount numeric, p_fee numeric, p_net_amount numeric, p_account_name text, p_momo_number text, p_account_number text, p_network text, p_payment_type text, p_bank_id text, p_bank_name text, p_branch text, p_description text, p_owner_id uuid DEFAULT NULL::uuid, p_name_verified boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_wallet_owner_id UUID; v_caller UUID; v_current_balance NUMERIC; v_new_balance NUMERIC;
    v_tx_id UUID; v_owner_role TEXT; v_pct NUMERIC; v_flat NUMERIC; v_computed_fee NUMERIC;
    v_fee NUMERIC; v_net NUMERIC;
BEGIN
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Withdrawal amount must be greater than zero'; END IF;
    IF p_amount <> round(p_amount, 2) THEN RAISE EXCEPTION 'Withdrawal amount must be greater than zero'; END IF;
    SELECT owner_id, balance INTO v_wallet_owner_id, v_current_balance
    FROM shop_wallets WHERE id = p_wallet_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    v_caller := COALESCE(auth.uid(), p_owner_id);
    IF v_caller IS NULL OR v_caller <> v_wallet_owner_id THEN
        RAISE EXCEPTION 'Unauthorized: caller does not own this wallet'; END IF;
    IF v_current_balance < p_amount THEN RAISE EXCEPTION 'Insufficient shop wallet balance'; END IF;
    SELECT role INTO v_owner_role FROM users WHERE id = v_wallet_owner_id;
    v_owner_role := COALESCE(v_owner_role, 'customer');
    SELECT withdrawal_fee_percent, withdrawal_fee_flat INTO v_pct, v_flat
    FROM shop_profiles WHERE owner_id = v_wallet_owner_id;
    IF v_pct IS NULL THEN
        SELECT NULLIF(trim(both '"' from value::text), '')::numeric INTO v_pct
        FROM shop_global_settings WHERE key = 'withdrawal_fee_percent_' || v_owner_role; END IF;
    IF v_pct IS NULL AND v_owner_role = 'subagent' THEN
        SELECT NULLIF(trim(both '"' from value::text), '')::numeric INTO v_pct
        FROM shop_global_settings WHERE key = 'withdrawal_fee_percent_customer'; END IF;
    IF v_pct IS NULL THEN
        SELECT NULLIF(trim(both '"' from value::text), '')::numeric INTO v_pct
        FROM shop_global_settings WHERE key = 'withdrawal_fee_percent'; END IF;
    IF v_pct IS NULL THEN v_pct := 2; END IF;
    IF v_flat IS NULL THEN
        SELECT NULLIF(trim(both '"' from value::text), '')::numeric INTO v_flat
        FROM shop_global_settings WHERE key = 'withdrawal_fee_flat_' || v_owner_role; END IF;
    IF v_flat IS NULL AND v_owner_role = 'subagent' THEN
        SELECT NULLIF(trim(both '"' from value::text), '')::numeric INTO v_flat
        FROM shop_global_settings WHERE key = 'withdrawal_fee_flat_customer'; END IF;
    IF v_flat IS NULL THEN
        SELECT NULLIF(trim(both '"' from value::text), '')::numeric INTO v_flat
        FROM shop_global_settings WHERE key = 'withdrawal_fee_flat'; END IF;
    IF v_flat IS NULL THEN v_flat := 0; END IF;
    v_computed_fee := round((p_amount * v_pct / 100.0) + v_flat, 2);
    v_fee := GREATEST(round(COALESCE(p_fee, 0), 2), v_computed_fee);
    v_net := p_amount - v_fee;
    IF v_net <= 0 THEN RAISE EXCEPTION 'Withdrawal amount too low to cover the processing fee'; END IF;

    v_new_balance := v_current_balance - p_amount;
    UPDATE shop_wallets
    SET balance = v_new_balance, total_withdrawn = COALESCE(total_withdrawn, 0) + p_amount, updated_at = NOW()
    WHERE id = p_wallet_id;
    INSERT INTO shop_wallet_transactions (
        shop_wallet_id, type, amount, fee, net_amount, account_name, momo_number,
        account_number, network, payment_type, bank_id, bank_name, branch,
        description, status, balance_snapshot, name_verified, sub_approval_status, escalate_after
    ) VALUES (
        p_wallet_id, 'withdrawal', p_amount, v_fee, v_net, p_account_name, p_momo_number,
        p_account_number, p_network, p_payment_type, p_bank_id, p_bank_name, p_branch,
        p_description, 'pending', v_new_balance, p_name_verified, 'not_required', NULL
    ) RETURNING id INTO v_tx_id;
    RETURN jsonb_build_object('success', true, 'newBalance', v_new_balance, 'fee', v_fee,
        'netAmount', v_net, 'transactionId', v_tx_id, 'subOwnerPending', false);
END;
$function$;
