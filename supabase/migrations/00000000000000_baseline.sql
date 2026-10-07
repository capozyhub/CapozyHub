-- Capozy Hub baseline schema
-- Extracted by introspection from source project ubvjtacdmwynqcxuposj (KiNG FLEXY GH) on 2026-10-07.
-- This is the CURRENT live schema, not a replay of the 283 historical migration files
-- (those can't be replayed cleanly - ambiguous ordering, files that modify tables they don't create).
-- Brand-specific identifiers (kf_*, KFT, kingflexygh.com) have NOT been renamed yet - Stage 2 work.

-- ============================================================
-- 00 EXTENSIONS
-- ============================================================
-- ===== extensions (installed on source project) =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA extensions;

-- ============================================================
-- 01 TABLES
-- ============================================================
-- ===== table admin_audit_log =====
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table admin_custom_list_users =====
CREATE TABLE IF NOT EXISTS public.admin_custom_list_users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  list_id uuid NOT NULL,
  user_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table admin_custom_lists =====
CREATE TABLE IF NOT EXISTS public.admin_custom_lists (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table admin_payment_actions =====
CREATE TABLE IF NOT EXISTS public.admin_payment_actions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  admin_id uuid,
  action text NOT NULL,
  reference text,
  source text,
  outcome text,
  detail jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table admin_presence =====
CREATE TABLE IF NOT EXISTS public.admin_presence (
  admin_id uuid NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table admin_profit_logs =====
CREATE TABLE IF NOT EXISTS public.admin_profit_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  transaction_type text NOT NULL,
  transaction_id uuid NOT NULL,
  channel text NOT NULL,
  role_at_time text,
  selling_price numeric(12,2),
  amount_paid_to_admin numeric(12,2),
  admin_cost numeric(12,2) NOT NULL,
  profit numeric(12,2) NOT NULL,
  is_loss boolean,
  calculation_note text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table admin_settings =====
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table admin_settings_audit =====
CREATE TABLE IF NOT EXISTS public.admin_settings_audit (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  source text
);

-- ===== table afa_orders =====
CREATE TABLE IF NOT EXISTS public.afa_orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  full_name text NOT NULL,
  phone text NOT NULL,
  ghana_card text NOT NULL,
  location text NOT NULL,
  region text NOT NULL,
  occupation text NOT NULL,
  status text DEFAULT 'pending'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  id_type text,
  id_number text,
  payment_amount numeric(12,2) DEFAULT 0.00,
  reference_code text NOT NULL,
  transaction_id uuid,
  date_of_birth date,
  source text DEFAULT 'web'::text NOT NULL,
  payment_method text DEFAULT 'momo'::text,
  api_key_id uuid,
  shop_id uuid,
  guest_phone text,
  cost_price numeric,
  selling_price numeric,
  profit numeric,
  parent_shop_id uuid,
  parent_profit numeric,
  refund_method text,
  refund_reason text,
  refunded_at timestamp with time zone,
  refunded_by uuid,
  paystack_reference text
);

-- ===== table airtime_fulfillment_batches =====
CREATE TABLE IF NOT EXISTS public.airtime_fulfillment_batches (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  created_by uuid,
  batch_name text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  order_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  order_count integer DEFAULT 0 NOT NULL,
  completed_count integer DEFAULT 0 NOT NULL,
  failed_count integer DEFAULT 0 NOT NULL,
  fulfillment_service text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table airtime_orders =====
CREATE TABLE IF NOT EXISTS public.airtime_orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  user_role text DEFAULT 'customer'::text NOT NULL,
  beneficiary_phone text NOT NULL,
  network text NOT NULL,
  airtime_amount numeric(12,2) NOT NULL,
  fee_rate numeric(5,2) DEFAULT 0 NOT NULL,
  fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
  total_paid numeric(12,2) NOT NULL,
  use_exact_amount boolean DEFAULT false,
  status text DEFAULT 'pending'::text,
  reference_code text NOT NULL,
  fulfillment_note text,
  fulfilled_by uuid,
  fulfilled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  shop_id uuid,
  shop_name text,
  type text DEFAULT 'airtime'::text NOT NULL,
  bundle_preference text,
  admin_fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
  shop_fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
  fulfillment_service text,
  fulfillment_request_id text,
  fulfillment_metadata jsonb,
  airtime_fulfillment_attempts integer DEFAULT 0 NOT NULL,
  refunded_by uuid,
  refunded_at timestamp with time zone,
  refund_reason text,
  source text DEFAULT 'web'::text,
  api_key_id uuid,
  commission_amount numeric,
  partner_commission_amount numeric,
  commission_credited_at timestamp with time zone
);

-- ===== table api_keys =====
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text DEFAULT 'My API Key'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  rate_limits jsonb,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  key_type text DEFAULT 'standard'::text NOT NULL,
  webhook_url text,
  webhook_secret text
);

-- ===== table api_logs =====
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  api_key_id uuid,
  user_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  ip_address text,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table archived_shop_financial_records =====
CREATE TABLE IF NOT EXISTS public.archived_shop_financial_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  shop_id uuid,
  wallet_id uuid,
  source_table text NOT NULL,
  record jsonb NOT NULL,
  archived_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table atishare_console_manual_sends =====
CREATE TABLE IF NOT EXISTS public.atishare_console_manual_sends (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  admin_id uuid NOT NULL,
  phone text NOT NULL,
  bundle_mb integer NOT NULL,
  client_reference text NOT NULL,
  transaction_id text,
  status text DEFAULT 'queued'::text NOT NULL,
  response jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table commission_wallet_transactions =====
CREATE TABLE IF NOT EXISTS public.commission_wallet_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  commission_wallet_id uuid NOT NULL,
  utility_order_id uuid,
  type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  status text DEFAULT 'completed'::text NOT NULL,
  momo_number text,
  network text,
  account_name text,
  name_verified boolean,
  payout_provider text,
  paystack_transfer_reference text,
  paystack_transfer_code text,
  paystack_transfer_status text,
  paystack_recipient_code text,
  paystack_fee numeric,
  poll_attempts integer DEFAULT 0 NOT NULL,
  last_polled_at timestamp with time zone,
  failure_reason text,
  admin_note text,
  processed_by uuid,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  fee numeric,
  net_amount numeric,
  airtime_order_id uuid,
  order_reference text,
  order_table text
);

-- ===== table commission_wallets =====
CREATE TABLE IF NOT EXISTS public.commission_wallets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  balance numeric DEFAULT 0 NOT NULL,
  total_earned numeric DEFAULT 0 NOT NULL,
  total_withdrawn numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table complaints =====
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'pending'::text,
  priority text DEFAULT 'medium'::text,
  resolution_notes text,
  evidence jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table customer_purchases =====
CREATE TABLE IF NOT EXISTS public.customer_purchases (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  customer_phone text NOT NULL,
  total_purchases integer DEFAULT 0,
  total_spent numeric(12,2) DEFAULT 0.00,
  first_purchase_at timestamp with time zone DEFAULT now(),
  last_purchase_at timestamp with time zone DEFAULT now()
);

-- ===== table data_packages =====
CREATE TABLE IF NOT EXISTS public.data_packages (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  network text NOT NULL,
  size text NOT NULL,
  price numeric(12,2) NOT NULL,
  cost_price numeric(12,2) DEFAULT 0.00,
  description text,
  is_available boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  agent_price numeric DEFAULT 0,
  dealer_price numeric DEFAULT 0,
  ussd_price numeric(12,2),
  ussd_enabled boolean DEFAULT false NOT NULL,
  category text DEFAULT 'data'::text NOT NULL
);

-- ===== table download_batches =====
CREATE TABLE IF NOT EXISTS public.download_batches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  filename text NOT NULL,
  network text NOT NULL,
  order_count integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  idempotency_key text
);

-- ===== table fulfillment_logs =====
CREATE TABLE IF NOT EXISTS public.fulfillment_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  order_id uuid NOT NULL,
  status text DEFAULT 'pending'::text,
  api_response jsonb,
  codecraft_reference text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table guest_push_subscriptions =====
CREATE TABLE IF NOT EXISTS public.guest_push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  guest_phone text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table hubtel_receive_charges =====
CREATE TABLE IF NOT EXISTS public.hubtel_receive_charges (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reference_code text NOT NULL,
  service_type text NOT NULL,
  order_id uuid,
  shop_id uuid,
  amount numeric NOT NULL,
  channel text NOT NULL,
  provider_transaction_id text,
  charges numeric,
  amount_charged numeric,
  fees_on_customer boolean,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone
);

-- ===== table momo_claim_attempts =====
CREATE TABLE IF NOT EXISTS public.momo_claim_attempts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  transaction_id_input text NOT NULL,
  result text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table momo_transactions =====
CREATE TABLE IF NOT EXISTS public.momo_transactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  transaction_id text NOT NULL,
  amount numeric(12,2) NOT NULL,
  sender_name text NOT NULL,
  sender_network text NOT NULL,
  raw_sms text,
  status text DEFAULT 'pending'::text NOT NULL,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  claim_fee_percent numeric(5,2) DEFAULT 0,
  claim_fee_amount numeric(12,2) DEFAULT 0,
  net_amount numeric(12,2),
  created_at timestamp with time zone DEFAULT now(),
  is_auto_claimed boolean DEFAULT false NOT NULL,
  claimed_via_ref text
);

-- ===== table mtn_fulfillment_tracking =====
CREATE TABLE IF NOT EXISTS public.mtn_fulfillment_tracking (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  order_id uuid NOT NULL,
  status text DEFAULT 'pending'::text,
  api_response jsonb,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table mtn_whitelist_server_status =====
CREATE TABLE IF NOT EXISTS public.mtn_whitelist_server_status (
  phone_number text NOT NULL,
  server smallint NOT NULL,
  status text NOT NULL,
  checked_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table mtn_whitelist_status =====
CREATE TABLE IF NOT EXISTS public.mtn_whitelist_status (
  phone_number text NOT NULL,
  status text NOT NULL,
  checked_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table notifications =====
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table number_registration_batches =====
CREATE TABLE IF NOT EXISTS public.number_registration_batches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  filename text NOT NULL,
  network text DEFAULT 'MTN'::text NOT NULL,
  number_count integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'submitted'::text NOT NULL,
  idempotency_key text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamp with time zone
);

-- ===== table number_registrations =====
CREATE TABLE IF NOT EXISTS public.number_registrations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  phone_number text NOT NULL,
  network text DEFAULT 'MTN'::text NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  batch_id uuid,
  source text DEFAULT 'order'::text NOT NULL,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  submitted_at timestamp with time zone,
  registered_at timestamp with time zone
);

-- ===== table order_retry_attempts =====
CREATE TABLE IF NOT EXISTS public.order_retry_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_order_id uuid NOT NULL,
  attempt_no integer NOT NULL,
  new_order_id uuid,
  mode text NOT NULL,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  charged_amount numeric DEFAULT 0 NOT NULL,
  funding_wallet_user_id uuid,
  supplier text,
  supplier_reference text,
  status text NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table orders =====
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  phone_number text NOT NULL,
  network text NOT NULL,
  size text NOT NULL,
  price numeric(12,2) NOT NULL,
  cost_price_at_time numeric(12,2) DEFAULT 0.00,
  status text DEFAULT 'pending'::text,
  payment_status text DEFAULT 'paid'::text,
  reference_code text NOT NULL,
  fulfillment_method text DEFAULT 'auto'::text,
  codecraft_reference text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  download_batch_id uuid,
  shop_name text,
  shop_order_id uuid,
  role_at_time text,
  dakazina_reference text,
  source text DEFAULT 'web'::text NOT NULL,
  api_key_id uuid,
  payment_method text DEFAULT 'momo'::text,
  category text DEFAULT 'data'::text NOT NULL,
  fulfillment_note text,
  refunded_by uuid,
  refunded_at timestamp with time zone,
  refund_reason text,
  ghdata_order_id text,
  retry_of_order_id uuid,
  retry_count integer DEFAULT 0 NOT NULL,
  last_retry_at timestamp with time zone,
  retry_from_status text,
  retried_by uuid,
  retried_by_role text,
  bundleportal_reference text,
  hendylinks_order_id text,
  dakazina_order_code text,
  atishare_console_reference text,
  atishare_console_transaction_id text,
  self_completed_at timestamp with time zone,
  self_completed_by uuid,
  self_completed_by_role text,
  dispatch_claimed_at timestamp with time zone,
  spfastit_reference text
);

-- ===== table passkey_challenges =====
CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  challenge text NOT NULL,
  user_id uuid,
  flow text NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table passkey_credentials =====
CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  credential_id text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint DEFAULT 0 NOT NULL,
  device_type text,
  backed_up boolean DEFAULT false NOT NULL,
  transports text[],
  friendly_name text DEFAULT 'Passkey'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_used_at timestamp with time zone,
  email text
);

-- ===== table pending_settlements =====
CREATE TABLE IF NOT EXISTS public.pending_settlements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  wallet_transaction_id uuid,
  amount_owed numeric(10,2) NOT NULL,
  amount_settled numeric(10,2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  payment_method text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  settled_at timestamp with time zone
);

-- ===== table phone_blacklist =====
CREATE TABLE IF NOT EXISTS public.phone_blacklist (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  phone_number text NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table phone_otp_verifications =====
CREATE TABLE IF NOT EXISTS public.phone_otp_verifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  verify_reference text,
  pending_charge jsonb,
  charge_result jsonb
);

-- ===== table phone_recovery_attempts =====
CREATE TABLE IF NOT EXISTS public.phone_recovery_attempts (
  user_id uuid NOT NULL,
  attempt_count integer DEFAULT 0 NOT NULL,
  window_started_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_until timestamp with time zone,
  hard_locked boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table push_subscriptions =====
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table results_checker_complaints =====
CREATE TABLE IF NOT EXISTS public.results_checker_complaints (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  user_id uuid,
  shop_id uuid,
  description text NOT NULL,
  status text DEFAULT 'open'::text,
  admin_note text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table results_checker_inventory =====
CREATE TABLE IF NOT EXISTS public.results_checker_inventory (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  type_id uuid NOT NULL,
  pin text NOT NULL,
  serial_number text NOT NULL,
  status text DEFAULT 'available'::text,
  reserved_by_order uuid,
  reservation_expires_at timestamp with time zone,
  sold_to_user_id uuid,
  sold_at timestamp with time zone,
  batch_id text,
  expiry_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table results_checker_orders =====
CREATE TABLE IF NOT EXISTS public.results_checker_orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid,
  user_role text DEFAULT 'customer'::text,
  shop_id uuid,
  shop_name text,
  shop_markup numeric(12,2) DEFAULT 0,
  customer_name text,
  customer_email text,
  customer_phone text,
  type_id uuid,
  type_name text,
  quantity integer NOT NULL,
  unit_price numeric(12,2),
  cost_price_at_time numeric(12,2),
  fee_amount numeric(12,2) DEFAULT 0,
  total_paid numeric(12,2) NOT NULL,
  merchant_commission numeric(12,2) DEFAULT 0,
  inventory_ids uuid[],
  status text DEFAULT 'pending'::text,
  payment_status text DEFAULT 'pending'::text,
  reference_code text,
  delivered_via text[],
  fulfilled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  source text DEFAULT 'website'::text NOT NULL,
  payment_method text DEFAULT 'momo'::text,
  api_key_id uuid
);

-- ===== table results_checker_types =====
CREATE TABLE IF NOT EXISTS public.results_checker_types (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  customer_price numeric(12,2) NOT NULL,
  agent_price numeric(12,2) NOT NULL,
  cost_price numeric(12,2) NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  bulk_pricing jsonb DEFAULT '[]'::jsonb,
  ussd_price numeric(12,2),
  dealer_price numeric(12,2) DEFAULT 0 NOT NULL
);

-- ===== table security_events =====
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_type text NOT NULL,
  reference text,
  shop_id uuid,
  paid_amount numeric,
  expected_amount numeric,
  guest_phone text,
  network text,
  order_type text,
  detail jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_afa_pending_orders =====
CREATE TABLE IF NOT EXISTS public.shop_afa_pending_orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  paystack_reference text NOT NULL,
  shop_id uuid NOT NULL,
  guest_phone text NOT NULL,
  guest_email text,
  order_payload jsonb NOT NULL,
  cost_price numeric NOT NULL,
  selling_price numeric NOT NULL,
  profit numeric NOT NULL,
  status text DEFAULT 'awaiting_payment'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  fulfilled_at timestamp with time zone,
  paystack_fee numeric
);

-- ===== table shop_announcements =====
CREATE TABLE IF NOT EXISTS public.shop_announcements (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shop_id uuid NOT NULL,
  message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- ===== table shop_customers =====
CREATE TABLE IF NOT EXISTS public.shop_customers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  notes text,
  total_orders integer DEFAULT 0 NOT NULL,
  total_spent numeric(12,2) DEFAULT 0 NOT NULL,
  first_order_at timestamp with time zone,
  last_order_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_global_settings =====
CREATE TABLE IF NOT EXISTS public.shop_global_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table shop_invites =====
CREATE TABLE IF NOT EXISTS public.shop_invites (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shop_id uuid NOT NULL,
  code text NOT NULL,
  max_uses integer,
  used_count integer DEFAULT 0 NOT NULL,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_order_splits =====
CREATE TABLE IF NOT EXISTS public.shop_order_splits (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  order_id uuid NOT NULL,
  beneficiary_shop_id uuid NOT NULL,
  level smallint NOT NULL,
  profit numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_orders =====
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shop_id uuid NOT NULL,
  package_id uuid,
  guest_phone text NOT NULL,
  network text NOT NULL,
  package_size text NOT NULL,
  selling_price numeric(12,2) NOT NULL,
  cost_price numeric(12,2) NOT NULL,
  profit numeric(12,2) NOT NULL,
  paystack_reference text,
  status text DEFAULT 'pending'::text,
  fulfillment_reference text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  admin_cost_at_time numeric(12,2),
  owner_role_at_time text,
  codecraft_reference_id text,
  fulfilled_by text,
  dakazina_reference text,
  source text DEFAULT 'website'::text NOT NULL,
  refunded_by uuid,
  refunded_at timestamp with time zone,
  refund_reason text,
  refund_method text,
  parent_shop_id uuid,
  parent_profit numeric(12,2),
  payer_momo_number text,
  payer_momo_name text,
  payer_momo_network text,
  payer_momo_resolved_at timestamp with time zone
);

-- ===== table shop_payment_details =====
CREATE TABLE IF NOT EXISTS public.shop_payment_details (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_owner_id uuid NOT NULL,
  account_name text NOT NULL,
  momo_number text NOT NULL,
  network text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  payment_type text DEFAULT 'momo'::text,
  bank_id text,
  bank_name text,
  account_number text
);

-- ===== table shop_pricing =====
CREATE TABLE IF NOT EXISTS public.shop_pricing (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shop_id uuid NOT NULL,
  package_id uuid NOT NULL,
  selling_price numeric(12,2) NOT NULL,
  profit_margin numeric(12,2) DEFAULT 1 NOT NULL,
  last_auto_updated_at timestamp with time zone,
  sub_price numeric(12,2)
);

-- ===== table shop_pricing_logs =====
CREATE TABLE IF NOT EXISTS public.shop_pricing_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  package_id uuid NOT NULL,
  old_cost_price numeric(12,2),
  new_cost_price numeric(12,2),
  old_selling_price numeric(12,2),
  new_selling_price numeric(12,2),
  changed_at timestamp with time zone DEFAULT now()
);

-- ===== table shop_pricing_pending =====
CREATE TABLE IF NOT EXISTS public.shop_pricing_pending (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shop_id uuid NOT NULL,
  package_id uuid NOT NULL,
  selling_price numeric(12,2) NOT NULL,
  submitted_at timestamp with time zone DEFAULT now()
);

-- ===== table shop_profiles =====
CREATE TABLE IF NOT EXISTS public.shop_profiles (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  owner_id uuid NOT NULL,
  shop_name text NOT NULL,
  shop_slug text NOT NULL,
  description text,
  owner_phone text,
  owner_email text,
  whatsapp_number text,
  logo_url text,
  brand_color text DEFAULT '#2563eb'::text,
  brand_accent text DEFAULT '#1e40af'::text,
  approval_status text DEFAULT 'pending'::text,
  approval_note text,
  approved_by uuid,
  approved_at timestamp with time zone,
  fulfillment_mode text DEFAULT 'auto'::text,
  paystack_fee_percent numeric(5,2),
  withdrawal_fee_percent numeric(5,2),
  withdrawal_fee_flat numeric(12,2),
  min_withdrawal_amount numeric(12,2),
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pricing_status text DEFAULT 'not_submitted'::text,
  pricing_note text,
  pricing_submitted_at timestamp with time zone,
  pricing_approved_at timestamp with time zone,
  pricing_approved_by uuid,
  pricing_rejection_acknowledged boolean DEFAULT true,
  airtime_fee_mtn numeric DEFAULT 1,
  airtime_fee_telecel numeric DEFAULT 1,
  airtime_fee_at numeric DEFAULT 1,
  banner_url text,
  community_link text,
  divider_style text DEFAULT 'asymmetric-curve'::text,
  banner_pos_x integer DEFAULT 50,
  banner_pos_y integer DEFAULT 50,
  banner_zoom numeric DEFAULT 1,
  results_checker_markup_customer numeric(12,2) DEFAULT 1,
  results_checker_markup_agent numeric(12,2) DEFAULT 1,
  mashup_fee_percent numeric DEFAULT 1,
  results_checker_markup_dealer numeric(10,2) DEFAULT 0 NOT NULL,
  setup_progress jsonb DEFAULT '{}'::jsonb NOT NULL,
  setup_completed_at timestamp with time zone,
  ussd_code text,
  ussd_active boolean DEFAULT false NOT NULL,
  ussd_activated_at timestamp with time zone,
  sms_order_confirmation_enabled boolean DEFAULT true NOT NULL,
  oos_networks jsonb DEFAULT '[]'::jsonb NOT NULL,
  sms_sender_id text,
  sms_sender_status text,
  sms_sender_requested_at timestamp with time zone,
  sms_sender_reviewed_at timestamp with time zone,
  utilities_enabled boolean DEFAULT false NOT NULL,
  afa_selling_price numeric,
  afa_fee_percent numeric,
  utility_sms_confirmation_enabled boolean DEFAULT true NOT NULL
);

-- ===== table shop_rc_markups =====
CREATE TABLE IF NOT EXISTS public.shop_rc_markups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  exam_type_id uuid NOT NULL,
  markup numeric(10,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sender_ids =====
CREATE TABLE IF NOT EXISTS public.shop_sender_ids (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  sender_text text NOT NULL,
  status text DEFAULT 'under_review'::text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  reviewed_at timestamp with time zone,
  reason text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_activations =====
CREATE TABLE IF NOT EXISTS public.shop_sms_activations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  amount_paid numeric(10,2) NOT NULL,
  paid_from text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  bonus_claimed boolean DEFAULT false NOT NULL,
  bonus_claimed_at timestamp with time zone,
  sms_suspended boolean DEFAULT false NOT NULL
);

-- ===== table shop_sms_bundles =====
CREATE TABLE IF NOT EXISTS public.shop_sms_bundles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  credits integer NOT NULL,
  price numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_delivery_receipts =====
CREATE TABLE IF NOT EXISTS public.shop_sms_delivery_receipts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  log_id uuid NOT NULL,
  phone text NOT NULL,
  provider_message_id text,
  status text DEFAULT 'sent'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_group_members =====
CREATE TABLE IF NOT EXISTS public.shop_sms_group_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_groups =====
CREATE TABLE IF NOT EXISTS public.shop_sms_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_logs =====
CREATE TABLE IF NOT EXISTS public.shop_sms_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  message text NOT NULL,
  recipients_count integer NOT NULL,
  segments integer NOT NULL,
  credits_used integer NOT NULL,
  status text DEFAULT 'sent'::text NOT NULL,
  flagged boolean DEFAULT false NOT NULL,
  flag_reason text,
  provider text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  source text DEFAULT 'manual'::text NOT NULL,
  delivered_count integer DEFAULT 0 NOT NULL,
  undelivered_count integer DEFAULT 0 NOT NULL,
  pending_count integer DEFAULT 0 NOT NULL
);

-- ===== table shop_sms_purchases =====
CREATE TABLE IF NOT EXISTS public.shop_sms_purchases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  bundle_id uuid,
  credits integer NOT NULL,
  price numeric(10,2) NOT NULL,
  paid_from text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_refund_failures =====
CREATE TABLE IF NOT EXISTS public.shop_sms_refund_failures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  credits integer NOT NULL,
  reason text,
  resolved boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_send_claims =====
CREATE TABLE IF NOT EXISTS public.shop_sms_send_claims (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_templates =====
CREATE TABLE IF NOT EXISTS public.shop_sms_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shop_id uuid NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_sms_wallets =====
CREATE TABLE IF NOT EXISTS public.shop_sms_wallets (
  shop_id uuid NOT NULL,
  credits integer DEFAULT 0 NOT NULL,
  total_purchased integer DEFAULT 0 NOT NULL,
  total_used integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table shop_wallet_transactions =====
CREATE TABLE IF NOT EXISTS public.shop_wallet_transactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shop_wallet_id uuid NOT NULL,
  shop_order_id uuid,
  type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  fee numeric(12,2) DEFAULT 0.00,
  net_amount numeric(12,2),
  description text NOT NULL,
  momo_number text,
  status text DEFAULT 'completed'::text,
  admin_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  account_name text,
  network text,
  balance_snapshot numeric(12,2),
  moolre_transaction_id text,
  moolre_external_ref text,
  moolre_status integer,
  payment_type text DEFAULT 'momo'::text,
  bank_id text,
  processed_at timestamp with time zone,
  account_number text,
  bank_name text,
  branch text,
  ussd_ref text,
  payout_provider text,
  paystack_recipient_code text,
  paystack_transfer_code text,
  paystack_transfer_reference text,
  paystack_transfer_status text,
  paystack_fee numeric(12,2),
  processed_by uuid,
  failure_reason text,
  last_polled_at timestamp with time zone,
  poll_attempts integer DEFAULT 0 NOT NULL,
  created_by uuid,
  credit_source text,
  name_verified boolean,
  sub_approval_status text DEFAULT 'not_required'::text NOT NULL,
  sub_approved_by uuid,
  sub_approval_note text,
  escalate_after timestamp with time zone,
  auto_escalated boolean DEFAULT false NOT NULL,
  order_reference text,
  utility_order_id uuid,
  afa_order_id uuid
);

-- ===== table shop_wallets =====
CREATE TABLE IF NOT EXISTS public.shop_wallets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  owner_id uuid NOT NULL,
  balance numeric(12,2) DEFAULT 0.00,
  total_earned numeric(12,2) DEFAULT 0.00,
  total_withdrawn numeric(12,2) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table sms_accounts =====
CREATE TABLE IF NOT EXISTS public.sms_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  mode text DEFAULT 'platform'::text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  suspended_reason text,
  default_sender text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  business_on_hold boolean DEFAULT false NOT NULL,
  use_own_sender_for_confirmations boolean DEFAULT false NOT NULL,
  webhook_url text,
  webhook_secret text,
  low_balance_threshold integer DEFAULT 50 NOT NULL,
  low_balance_notified_at timestamp with time zone
);

-- ===== table sms_bundles =====
CREATE TABLE IF NOT EXISTS public.sms_bundles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  credits integer NOT NULL,
  price numeric(10,2) NOT NULL,
  business_price numeric(10,2),
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  mode text DEFAULT 'platform'::text NOT NULL
);

-- ===== table sms_business_profiles =====
CREATE TABLE IF NOT EXISTS public.sms_business_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  business_name text NOT NULL,
  description text NOT NULL,
  domain_link text,
  ghana_card_number_masked text,
  status text DEFAULT 'draft'::text NOT NULL,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  whatsapp_verified boolean DEFAULT false NOT NULL,
  whatsapp_verification_note text,
  contact_whatsapp_number text
);

-- ===== table sms_campaigns =====
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  sender_used text,
  mode_at_send text NOT NULL,
  message text NOT NULL,
  recipients_count integer NOT NULL,
  segments integer NOT NULL,
  credits_charged integer DEFAULT 0 NOT NULL,
  status text NOT NULL,
  flagged boolean DEFAULT false NOT NULL,
  flag_reason text,
  flag_severity text,
  scheduled_at timestamp with time zone,
  claimed_at timestamp with time zone,
  settled_at timestamp with time zone,
  source text DEFAULT 'dashboard'::text NOT NULL,
  provider text DEFAULT 'hubtel'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_contact_groups =====
CREATE TABLE IF NOT EXISTS public.sms_contact_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_contacts =====
CREATE TABLE IF NOT EXISTS public.sms_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  first_name text,
  last_name text,
  phone_number text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_credit_ledger =====
CREATE TABLE IF NOT EXISTS public.sms_credit_ledger (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  delta integer NOT NULL,
  balance_after integer,
  kind text NOT NULL,
  idempotency_key text NOT NULL,
  reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_group_contacts =====
CREATE TABLE IF NOT EXISTS public.sms_group_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  phone_number text NOT NULL,
  first_name text,
  last_name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_groups =====
CREATE TABLE IF NOT EXISTS public.sms_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_messages =====
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL,
  account_id uuid NOT NULL,
  recipient text NOT NULL,
  chunk_no integer DEFAULT 0 NOT NULL,
  provider text DEFAULT 'hubtel'::text NOT NULL,
  provider_message_id text,
  status text DEFAULT 'queued'::text NOT NULL,
  status_detail text,
  network_id text,
  rate numeric(10,4),
  status_updated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_purchases =====
CREATE TABLE IF NOT EXISTS public.sms_purchases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  bundle_id uuid,
  credits integer NOT NULL,
  price numeric(10,2) NOT NULL,
  paid_from text NOT NULL,
  payment_reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_sender_ids =====
CREATE TABLE IF NOT EXISTS public.sms_sender_ids (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  sender_text text NOT NULL,
  status text DEFAULT 'under_review'::text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  hubtel_reference text,
  rejection_reason text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  approved_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_templates =====
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_user_templates =====
CREATE TABLE IF NOT EXISTS public.sms_user_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sms_wallets =====
CREATE TABLE IF NOT EXISTS public.sms_wallets (
  account_id uuid NOT NULL,
  credits integer DEFAULT 0 NOT NULL,
  total_purchased integer DEFAULT 0 NOT NULL,
  total_used integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sub_agent_default_pricing =====
CREATE TABLE IF NOT EXISTS public.sub_agent_default_pricing (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  recruiter_id uuid NOT NULL,
  product_type text NOT NULL,
  product_ref text NOT NULL,
  markup numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sub_agent_order_earnings =====
CREATE TABLE IF NOT EXISTS public.sub_agent_order_earnings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  order_reference text NOT NULL,
  order_table text NOT NULL,
  recruiter_id uuid NOT NULL,
  sub_user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  credited_at timestamp with time zone,
  reversed_at timestamp with time zone
);

-- ===== table sub_agent_pricing =====
CREATE TABLE IF NOT EXISTS public.sub_agent_pricing (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  recruiter_id uuid NOT NULL,
  sub_user_id uuid NOT NULL,
  product_type text NOT NULL,
  product_ref text NOT NULL,
  markup numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table sub_agents =====
CREATE TABLE IF NOT EXISTS public.sub_agents (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  upline_shop_id uuid,
  status text DEFAULT 'pending'::text NOT NULL,
  markup_ceiling numeric(12,2),
  approved_by uuid,
  approved_at timestamp with time zone,
  joined_via_invite uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  may_recruit boolean DEFAULT false NOT NULL,
  upline_user_id uuid,
  pending_key_hash text,
  pending_key_expires_at timestamp with time zone,
  must_change_password boolean DEFAULT true NOT NULL
);

-- ===== table support_messages =====
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  thread_id uuid NOT NULL,
  sender_role text NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  delivered_to_user_at timestamp with time zone,
  delivered_to_admin_at timestamp with time zone,
  read_by_user_at timestamp with time zone,
  read_by_admin_at timestamp with time zone
);

-- ===== table support_threads =====
CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid,
  subject text NOT NULL,
  category text DEFAULT 'other'::text NOT NULL,
  phone_number text NOT NULL,
  whatsapp_number text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  closed_at timestamp with time zone,
  closed_by uuid,
  last_message_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table system_announcements =====
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  visible_on text DEFAULT 'main_site'::text,
  cta_primary_label text,
  cta_primary_url text,
  cta_secondary_label text,
  cta_secondary_url text,
  status text DEFAULT 'published'::text NOT NULL,
  scheduled_at timestamp with time zone
);

-- ===== table terms_acceptances =====
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  version text NOT NULL,
  accepted_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text
);

-- ===== table terms_versions =====
CREATE TABLE IF NOT EXISTS public.terms_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  version text NOT NULL,
  effective_date date NOT NULL,
  sections jsonb DEFAULT '[]'::jsonb NOT NULL,
  changelog jsonb DEFAULT '[]'::jsonb NOT NULL,
  requires_reacceptance boolean DEFAULT true NOT NULL,
  is_current boolean DEFAULT false NOT NULL,
  created_by uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table user_payment_references =====
CREATE TABLE IF NOT EXISTS public.user_payment_references (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  reference_code text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table users =====
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone_number text,
  role text DEFAULT 'customer'::text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  agent_expires_at timestamp with time zone,
  pin_hash text,
  pin_reminder text,
  pin_attempts integer DEFAULT 0,
  pin_locked_until timestamp with time zone,
  dealer_expires_at timestamp with time zone,
  signup_promo_shown boolean DEFAULT false NOT NULL,
  pin_salt text,
  auto_upgrade_enabled boolean DEFAULT false NOT NULL,
  auto_upgrade_plan text,
  phone_verified boolean DEFAULT false,
  order_success_sms_enabled boolean DEFAULT true NOT NULL,
  notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
  terms_accepted_version text,
  terms_accepted_at timestamp with time zone,
  suspended_until timestamp with time zone,
  suspension_reason text,
  suspended_at timestamp with time zone,
  suspended_by uuid
);

-- ===== table ussd_callback_retry_queue =====
CREATE TABLE IF NOT EXISTS public.ussd_callback_retry_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  hubtel_order_id text NOT NULL,
  service_status text NOT NULL,
  metadata jsonb,
  attempts integer DEFAULT 0 NOT NULL,
  first_failed_at timestamp with time zone DEFAULT now() NOT NULL,
  last_attempt_at timestamp with time zone,
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamp with time zone,
  escalated boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  claimed_at timestamp with time zone
);

-- ===== table ussd_customers =====
CREATE TABLE IF NOT EXISTS public.ussd_customers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  mobile text NOT NULL,
  operator text,
  first_seen timestamp with time zone DEFAULT now() NOT NULL,
  last_seen timestamp with time zone DEFAULT now() NOT NULL,
  total_orders integer DEFAULT 0 NOT NULL,
  total_spent numeric(12,2) DEFAULT 0 NOT NULL,
  last_service text
);

-- ===== table ussd_pending_orders =====
CREATE TABLE IF NOT EXISTS public.ussd_pending_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  mobile text NOT NULL,
  service_type text NOT NULL,
  order_payload jsonb NOT NULL,
  user_id uuid,
  price numeric(12,2) NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  hubtel_order_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  fulfilled_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + '02:00:00'::interval) NOT NULL,
  shop_id uuid,
  operator text,
  claimed_at timestamp with time zone
);

-- ===== table ussd_refund_queue =====
CREATE TABLE IF NOT EXISTS public.ussd_refund_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  order_id uuid,
  user_id uuid,
  mobile text NOT NULL,
  service_type text NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  hubtel_order_id text,
  wallet_debit_reference text,
  reason text,
  status text DEFAULT 'pending'::text NOT NULL,
  refunded_by uuid,
  refunded_at timestamp with time zone,
  refund_reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table ussd_sessions =====
CREATE TABLE IF NOT EXISTS public.ussd_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  mobile text NOT NULL,
  operator text,
  platform text DEFAULT 'USSD'::text NOT NULL,
  steps integer DEFAULT 0 NOT NULL,
  service_used text,
  completed boolean DEFAULT false NOT NULL,
  interrupted_state jsonb,
  interrupted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table utility_orders =====
CREATE TABLE IF NOT EXISTS public.utility_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  shop_id uuid,
  api_key_id uuid,
  source text NOT NULL,
  biller text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  destination_phone text,
  customer_email text,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL,
  payment_reference text,
  payment_status text DEFAULT 'unpaid'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  reference_code text NOT NULL,
  fulfillment_attempts integer DEFAULT 0 NOT NULL,
  fulfillment_request_id text,
  commission_amount numeric(12,4),
  partner_commission_amount numeric(12,4),
  commission_credited_at timestamp with time zone,
  lookup_snapshot jsonb,
  fulfillment_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  paystack_fee numeric,
  refund_reason text,
  refunded_by uuid,
  refunded_at timestamp with time zone,
  payer_momo_number text,
  payer_momo_name text,
  payer_momo_network text,
  payer_momo_resolved_at timestamp with time zone
);

-- ===== table utility_refund_queue =====
CREATE TABLE IF NOT EXISTS public.utility_refund_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  utility_order_id uuid NOT NULL,
  source text NOT NULL,
  biller text NOT NULL,
  amount numeric NOT NULL,
  momo_number text,
  shop_id uuid,
  user_id uuid,
  reason text,
  status text DEFAULT 'pending'::text NOT NULL,
  refunded_by uuid,
  refunded_at timestamp with time zone,
  refund_reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table utility_saved_accounts =====
CREATE TABLE IF NOT EXISTS public.utility_saved_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  biller text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  destination_phone text,
  label text,
  last_paid_at timestamp with time zone,
  last_amount numeric(12,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== table verified_phone_numbers =====
CREATE TABLE IF NOT EXISTS public.verified_phone_numbers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  phone text NOT NULL,
  first_verified_at timestamp with time zone DEFAULT now() NOT NULL,
  verified_via text DEFAULT 'sms_otp'::text NOT NULL
);

-- ===== table wallet_payments =====
CREATE TABLE IF NOT EXISTS public.wallet_payments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  fee numeric(12,2) DEFAULT 0.00,
  total_amount numeric(12,2) NOT NULL,
  reference text NOT NULL,
  provider text DEFAULT 'paystack'::text,
  status text DEFAULT 'pending'::text,
  provider_reference text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table wallet_transactions =====
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  wallet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text NOT NULL,
  reference text,
  source text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb
);

-- ===== table wallets =====
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  balance numeric(12,2) DEFAULT 0.00,
  total_credited numeric(12,2) DEFAULT 0.00,
  total_spent numeric(12,2) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===== table website_requests =====
CREATE TABLE IF NOT EXISTS public.website_requests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  request_type text DEFAULT 'full_request'::text NOT NULL,
  category text,
  budget_ghs numeric,
  features jsonb,
  description text NOT NULL,
  reference_sites text,
  timeline text,
  contact_phone text NOT NULL,
  contact_whatsapp text,
  status text DEFAULT 'new'::text NOT NULL,
  closed_outcome text,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  contacted_at timestamp with time zone,
  closed_at timestamp with time zone
);




-- ============================================================
-- 02 PRIMARY KEYS, UNIQUE, CHECK (from constraints.sql: PK+UQ+CHECK sections)
-- ============================================================
-- ===== PRIMARY KEYS =====
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_custom_list_users ADD CONSTRAINT admin_custom_list_users_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_custom_lists ADD CONSTRAINT admin_custom_lists_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_payment_actions ADD CONSTRAINT admin_payment_actions_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_presence ADD CONSTRAINT admin_presence_pkey PRIMARY KEY (admin_id);
ALTER TABLE public.admin_profit_logs ADD CONSTRAINT admin_profit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_settings ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.admin_settings_audit ADD CONSTRAINT admin_settings_audit_pkey PRIMARY KEY (id);
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.airtime_fulfillment_batches ADD CONSTRAINT airtime_fulfillment_batches_pkey PRIMARY KEY (id);
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);
ALTER TABLE public.api_logs ADD CONSTRAINT api_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.archived_shop_financial_records ADD CONSTRAINT archived_shop_financial_records_pkey PRIMARY KEY (id);
ALTER TABLE public.atishare_console_manual_sends ADD CONSTRAINT atishare_console_manual_sends_pkey PRIMARY KEY (id);
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.commission_wallets ADD CONSTRAINT commission_wallets_pkey PRIMARY KEY (id);
ALTER TABLE public.complaints ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);
ALTER TABLE public.customer_purchases ADD CONSTRAINT customer_purchases_pkey PRIMARY KEY (id);
ALTER TABLE public.data_packages ADD CONSTRAINT data_packages_pkey PRIMARY KEY (id);
ALTER TABLE public.download_batches ADD CONSTRAINT download_batches_pkey PRIMARY KEY (id);
ALTER TABLE public.fulfillment_logs ADD CONSTRAINT fulfillment_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.guest_push_subscriptions ADD CONSTRAINT guest_push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.hubtel_receive_charges ADD CONSTRAINT hubtel_receive_charges_pkey PRIMARY KEY (id);
ALTER TABLE public.momo_claim_attempts ADD CONSTRAINT momo_claim_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.momo_transactions ADD CONSTRAINT momo_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.mtn_fulfillment_tracking ADD CONSTRAINT mtn_fulfillment_tracking_pkey PRIMARY KEY (id);
ALTER TABLE public.mtn_whitelist_server_status ADD CONSTRAINT mtn_whitelist_server_status_pkey PRIMARY KEY (phone_number,server);
ALTER TABLE public.mtn_whitelist_status ADD CONSTRAINT mtn_whitelist_status_pkey PRIMARY KEY (phone_number);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.number_registration_batches ADD CONSTRAINT number_registration_batches_pkey PRIMARY KEY (id);
ALTER TABLE public.number_registrations ADD CONSTRAINT number_registrations_pkey PRIMARY KEY (id);
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.passkey_challenges ADD CONSTRAINT passkey_challenges_pkey PRIMARY KEY (id);
ALTER TABLE public.passkey_credentials ADD CONSTRAINT passkey_credentials_pkey PRIMARY KEY (id);
ALTER TABLE public.pending_settlements ADD CONSTRAINT pending_settlements_pkey PRIMARY KEY (id);
ALTER TABLE public.phone_blacklist ADD CONSTRAINT phone_blacklist_pkey PRIMARY KEY (id);
ALTER TABLE public.phone_otp_verifications ADD CONSTRAINT phone_otp_verifications_pkey PRIMARY KEY (id);
ALTER TABLE public.phone_recovery_attempts ADD CONSTRAINT phone_recovery_attempts_pkey PRIMARY KEY (user_id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.results_checker_complaints ADD CONSTRAINT results_checker_complaints_pkey PRIMARY KEY (id);
ALTER TABLE public.results_checker_inventory ADD CONSTRAINT results_checker_inventory_pkey PRIMARY KEY (id);
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.results_checker_types ADD CONSTRAINT results_checker_types_pkey PRIMARY KEY (id);
ALTER TABLE public.security_events ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_afa_pending_orders ADD CONSTRAINT shop_afa_pending_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_announcements ADD CONSTRAINT shop_announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_customers ADD CONSTRAINT shop_customers_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_global_settings ADD CONSTRAINT shop_global_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.shop_invites ADD CONSTRAINT shop_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_order_splits ADD CONSTRAINT shop_order_splits_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_payment_details ADD CONSTRAINT shop_payment_details_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_pricing ADD CONSTRAINT shop_pricing_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_pricing_logs ADD CONSTRAINT shop_pricing_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_pricing_pending ADD CONSTRAINT shop_pricing_pending_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_rc_markups ADD CONSTRAINT shop_rc_markups_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sender_ids ADD CONSTRAINT shop_sender_ids_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_activations ADD CONSTRAINT shop_sms_activations_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_bundles ADD CONSTRAINT shop_sms_bundles_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_delivery_receipts ADD CONSTRAINT shop_sms_delivery_receipts_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_group_members ADD CONSTRAINT shop_sms_group_members_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_groups ADD CONSTRAINT shop_sms_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_refund_failures ADD CONSTRAINT shop_sms_refund_failures_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_send_claims ADD CONSTRAINT shop_sms_send_claims_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_templates ADD CONSTRAINT shop_sms_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_sms_wallets ADD CONSTRAINT shop_sms_wallets_pkey PRIMARY KEY (shop_id);
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.shop_wallets ADD CONSTRAINT shop_wallets_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_accounts ADD CONSTRAINT sms_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_bundles ADD CONSTRAINT sms_bundles_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_contact_groups ADD CONSTRAINT sms_contact_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_contacts ADD CONSTRAINT sms_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_credit_ledger ADD CONSTRAINT sms_credit_ledger_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_group_contacts ADD CONSTRAINT sms_group_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_groups ADD CONSTRAINT sms_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_sender_ids ADD CONSTRAINT sms_sender_ids_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_templates ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_user_templates ADD CONSTRAINT sms_user_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.sms_wallets ADD CONSTRAINT sms_wallets_pkey PRIMARY KEY (account_id);
ALTER TABLE public.sub_agent_default_pricing ADD CONSTRAINT sub_agent_default_pricing_pkey PRIMARY KEY (id);
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_pkey PRIMARY KEY (id);
ALTER TABLE public.sub_agent_pricing ADD CONSTRAINT sub_agent_pricing_pkey PRIMARY KEY (id);
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_pkey PRIMARY KEY (id);
ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_pkey PRIMARY KEY (id);
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.terms_acceptances ADD CONSTRAINT terms_acceptances_pkey PRIMARY KEY (id);
ALTER TABLE public.terms_versions ADD CONSTRAINT terms_versions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_payment_references ADD CONSTRAINT user_payment_references_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.ussd_callback_retry_queue ADD CONSTRAINT ussd_callback_retry_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.ussd_customers ADD CONSTRAINT ussd_customers_pkey PRIMARY KEY (id);
ALTER TABLE public.ussd_pending_orders ADD CONSTRAINT ussd_pending_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.ussd_refund_queue ADD CONSTRAINT ussd_refund_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.ussd_sessions ADD CONSTRAINT ussd_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.utility_refund_queue ADD CONSTRAINT utility_refund_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.utility_saved_accounts ADD CONSTRAINT utility_saved_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.verified_phone_numbers ADD CONSTRAINT verified_phone_numbers_pkey PRIMARY KEY (id);
ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_pkey PRIMARY KEY (id);

-- ===== UNIQUE =====
ALTER TABLE public.admin_custom_list_users ADD CONSTRAINT admin_custom_list_users_list_id_user_id_key UNIQUE (list_id,user_id);
ALTER TABLE public.admin_profit_logs ADD CONSTRAINT uniq_admin_profit_log UNIQUE (transaction_type,transaction_id);
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_reference_code_unique UNIQUE (reference_code);
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_user_type_unique UNIQUE (user_id,key_type);
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_prefix_unique UNIQUE (key_prefix);
ALTER TABLE public.atishare_console_manual_sends ADD CONSTRAINT atishare_console_manual_sends_client_reference_key UNIQUE (client_reference);
ALTER TABLE public.commission_wallets ADD CONSTRAINT commission_wallets_owner_id_key UNIQUE (owner_id);
ALTER TABLE public.customer_purchases ADD CONSTRAINT customer_purchases_user_id_customer_phone_key UNIQUE (user_id,customer_phone);
ALTER TABLE public.download_batches ADD CONSTRAINT download_batches_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE public.guest_push_subscriptions ADD CONSTRAINT guest_push_subscriptions_shop_id_endpoint_key UNIQUE (shop_id,endpoint);
ALTER TABLE public.hubtel_receive_charges ADD CONSTRAINT hubtel_receive_charges_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.momo_transactions ADD CONSTRAINT momo_transactions_transaction_id_key UNIQUE (transaction_id);
ALTER TABLE public.number_registration_batches ADD CONSTRAINT number_registration_batches_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE public.number_registrations ADD CONSTRAINT number_registrations_phone_number_key UNIQUE (phone_number);
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_source_order_id_attempt_no_key UNIQUE (source_order_id,attempt_no);
ALTER TABLE public.orders ADD CONSTRAINT orders_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.passkey_challenges ADD CONSTRAINT passkey_challenges_challenge_key UNIQUE (challenge);
ALTER TABLE public.passkey_credentials ADD CONSTRAINT passkey_credentials_credential_id_key UNIQUE (credential_id);
ALTER TABLE public.phone_blacklist ADD CONSTRAINT phone_blacklist_phone_number_key UNIQUE (phone_number);
ALTER TABLE public.phone_otp_verifications ADD CONSTRAINT phone_otp_verifications_phone_key UNIQUE (phone);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id,endpoint);
ALTER TABLE public.results_checker_inventory ADD CONSTRAINT results_checker_inventory_type_id_pin_key UNIQUE (type_id,pin);
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.results_checker_types ADD CONSTRAINT results_checker_types_name_key UNIQUE (name);
ALTER TABLE public.shop_afa_pending_orders ADD CONSTRAINT shop_afa_pending_orders_paystack_reference_key UNIQUE (paystack_reference);
ALTER TABLE public.shop_customers ADD CONSTRAINT shop_customers_shop_id_phone_key UNIQUE (shop_id,phone);
ALTER TABLE public.shop_invites ADD CONSTRAINT shop_invites_code_key UNIQUE (code);
ALTER TABLE public.shop_order_splits ADD CONSTRAINT shop_order_splits_order_id_beneficiary_shop_id_key UNIQUE (order_id,beneficiary_shop_id);
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_paystack_reference_key UNIQUE (paystack_reference);
ALTER TABLE public.shop_pricing ADD CONSTRAINT shop_pricing_shop_id_package_id_key UNIQUE (shop_id,package_id);
ALTER TABLE public.shop_pricing_pending ADD CONSTRAINT shop_pricing_pending_shop_id_package_id_key UNIQUE (shop_id,package_id);
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_ussd_code_key UNIQUE (ussd_code);
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_shop_slug_key UNIQUE (shop_slug);
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_owner_id_key UNIQUE (owner_id);
ALTER TABLE public.shop_rc_markups ADD CONSTRAINT shop_rc_markups_shop_id_exam_type_id_key UNIQUE (shop_id,exam_type_id);
ALTER TABLE public.shop_sms_activations ADD CONSTRAINT shop_sms_activations_shop_id_key UNIQUE (shop_id);
ALTER TABLE public.shop_sms_group_members ADD CONSTRAINT shop_sms_group_members_group_id_phone_key UNIQUE (group_id,phone);
ALTER TABLE public.shop_sms_groups ADD CONSTRAINT shop_sms_groups_shop_id_name_key UNIQUE (shop_id,name);
ALTER TABLE public.shop_sms_send_claims ADD CONSTRAINT shop_sms_send_claims_shop_id_idempotency_key_key UNIQUE (shop_id,idempotency_key);
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_ussd_ref_key UNIQUE (ussd_ref);
ALTER TABLE public.shop_wallets ADD CONSTRAINT shop_wallets_owner_id_key UNIQUE (owner_id);
ALTER TABLE public.sms_accounts ADD CONSTRAINT sms_accounts_user_id_key UNIQUE (user_id);
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_account_id_key UNIQUE (account_id);
ALTER TABLE public.sms_credit_ledger ADD CONSTRAINT sms_credit_ledger_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE public.sms_group_contacts ADD CONSTRAINT sms_group_contacts_group_id_phone_number_key UNIQUE (group_id,phone_number);
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_payment_reference_key UNIQUE (payment_reference);
ALTER TABLE public.sub_agent_default_pricing ADD CONSTRAINT sub_agent_default_pricing_recruiter_id_product_type_product_key UNIQUE (recruiter_id,product_type,product_ref);
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_order_table_order_reference_key UNIQUE (order_table,order_reference);
ALTER TABLE public.sub_agent_pricing ADD CONSTRAINT sub_agent_pricing_sub_user_id_product_type_product_ref_key UNIQUE (sub_user_id,product_type,product_ref);
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_user_id_key UNIQUE (user_id);
ALTER TABLE public.terms_versions ADD CONSTRAINT terms_versions_version_key UNIQUE (version);
ALTER TABLE public.user_payment_references ADD CONSTRAINT user_payment_references_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_payment_references ADD CONSTRAINT user_payment_references_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.users ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.ussd_customers ADD CONSTRAINT ussd_customers_mobile_key UNIQUE (mobile);
ALTER TABLE public.ussd_pending_orders ADD CONSTRAINT ussd_pending_orders_session_id_key UNIQUE (session_id);
ALTER TABLE public.ussd_sessions ADD CONSTRAINT ussd_sessions_session_id_key UNIQUE (session_id);
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_reference_code_key UNIQUE (reference_code);
ALTER TABLE public.utility_saved_accounts ADD CONSTRAINT utility_saved_accounts_user_id_biller_account_number_key UNIQUE (user_id,biller,account_number);
ALTER TABLE public.verified_phone_numbers ADD CONSTRAINT verified_phone_numbers_phone_key UNIQUE (phone);
ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_reference_key UNIQUE (reference);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);

-- ===== FOREIGN KEYS =====
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.admin_custom_list_users ADD CONSTRAINT admin_custom_list_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.admin_custom_list_users ADD CONSTRAINT admin_custom_list_users_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.admin_custom_lists (id) ON DELETE CASCADE;
ALTER TABLE public.admin_payment_actions ADD CONSTRAINT admin_payment_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users (id);
ALTER TABLE public.admin_presence ADD CONSTRAINT admin_presence_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.admin_settings_audit ADD CONSTRAINT admin_settings_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users (id);
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.wallet_transactions (id);
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys (id);
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_parent_shop_id_fkey FOREIGN KEY (parent_shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.airtime_fulfillment_batches ADD CONSTRAINT airtime_fulfillment_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id);
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys (id);
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_fulfilled_by_fkey FOREIGN KEY (fulfilled_by) REFERENCES public.users (id);
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.api_logs ADD CONSTRAINT api_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE SET NULL;
ALTER TABLE public.api_logs ADD CONSTRAINT api_logs_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys (id) ON DELETE SET NULL;
ALTER TABLE public.atishare_console_manual_sends ADD CONSTRAINT atishare_console_manual_sends_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users (id);
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users (id);
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_utility_order_id_fkey FOREIGN KEY (utility_order_id) REFERENCES public.utility_orders (id) ON DELETE SET NULL;
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_airtime_order_id_fkey FOREIGN KEY (airtime_order_id) REFERENCES public.airtime_orders (id) ON DELETE SET NULL;
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_commission_wallet_id_fkey FOREIGN KEY (commission_wallet_id) REFERENCES public.commission_wallets (id) ON DELETE CASCADE;
ALTER TABLE public.commission_wallets ADD CONSTRAINT commission_wallets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE CASCADE;
ALTER TABLE public.customer_purchases ADD CONSTRAINT customer_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.fulfillment_logs ADD CONSTRAINT fulfillment_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE CASCADE;
ALTER TABLE public.guest_push_subscriptions ADD CONSTRAINT guest_push_subscriptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.momo_claim_attempts ADD CONSTRAINT momo_claim_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.momo_transactions ADD CONSTRAINT momo_transactions_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.users (id) ON DELETE SET NULL;
ALTER TABLE public.mtn_fulfillment_tracking ADD CONSTRAINT mtn_fulfillment_tracking_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.number_registrations ADD CONSTRAINT number_registrations_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.number_registration_batches (id) ON DELETE SET NULL;
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_new_order_id_fkey FOREIGN KEY (new_order_id) REFERENCES public.orders (id);
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_source_order_id_fkey FOREIGN KEY (source_order_id) REFERENCES public.orders (id) ON DELETE CASCADE;
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users (id);
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_funding_wallet_user_id_fkey FOREIGN KEY (funding_wallet_user_id) REFERENCES public.users (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_self_completed_by_fkey FOREIGN KEY (self_completed_by) REFERENCES public.users (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_shop_order_id_fkey FOREIGN KEY (shop_order_id) REFERENCES public.shop_orders (id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD CONSTRAINT orders_retry_of_order_id_fkey FOREIGN KEY (retry_of_order_id) REFERENCES public.orders (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys (id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_download_batch_id_fkey FOREIGN KEY (download_batch_id) REFERENCES public.download_batches (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_retried_by_fkey FOREIGN KEY (retried_by) REFERENCES public.users (id);
ALTER TABLE public.pending_settlements ADD CONSTRAINT pending_settlements_wallet_transaction_id_fkey FOREIGN KEY (wallet_transaction_id) REFERENCES public.wallet_transactions (id) ON DELETE SET NULL;
ALTER TABLE public.pending_settlements ADD CONSTRAINT pending_settlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.phone_recovery_attempts ADD CONSTRAINT phone_recovery_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.results_checker_complaints ADD CONSTRAINT results_checker_complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
ALTER TABLE public.results_checker_complaints ADD CONSTRAINT results_checker_complaints_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.results_checker_complaints ADD CONSTRAINT results_checker_complaints_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.results_checker_orders (id);
ALTER TABLE public.results_checker_inventory ADD CONSTRAINT results_checker_inventory_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.results_checker_types (id);
ALTER TABLE public.results_checker_inventory ADD CONSTRAINT results_checker_inventory_sold_to_user_id_fkey FOREIGN KEY (sold_to_user_id) REFERENCES public.users (id);
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.results_checker_types (id);
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys (id);
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.security_events ADD CONSTRAINT security_events_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.shop_afa_pending_orders ADD CONSTRAINT shop_afa_pending_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.shop_announcements ADD CONSTRAINT shop_announcements_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_customers ADD CONSTRAINT shop_customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_invites ADD CONSTRAINT shop_invites_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_order_splits ADD CONSTRAINT shop_order_splits_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders (id) ON DELETE CASCADE;
ALTER TABLE public.shop_order_splits ADD CONSTRAINT shop_order_splits_beneficiary_shop_id_fkey FOREIGN KEY (beneficiary_shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_parent_shop_id_fkey FOREIGN KEY (parent_shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.data_packages (id);
ALTER TABLE public.shop_payment_details ADD CONSTRAINT shop_payment_details_shop_owner_id_fkey FOREIGN KEY (shop_owner_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.shop_pricing ADD CONSTRAINT shop_pricing_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_pricing ADD CONSTRAINT shop_pricing_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.data_packages (id) ON DELETE CASCADE;
ALTER TABLE public.shop_pricing_logs ADD CONSTRAINT shop_pricing_logs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_pricing_logs ADD CONSTRAINT shop_pricing_logs_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.data_packages (id) ON DELETE CASCADE;
ALTER TABLE public.shop_pricing_pending ADD CONSTRAINT shop_pricing_pending_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_pricing_pending ADD CONSTRAINT shop_pricing_pending_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.data_packages (id) ON DELETE CASCADE;
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_pricing_approved_by_fkey FOREIGN KEY (pricing_approved_by) REFERENCES public.users (id);
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users (id);
ALTER TABLE public.shop_rc_markups ADD CONSTRAINT shop_rc_markups_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_rc_markups ADD CONSTRAINT shop_rc_markups_exam_type_id_fkey FOREIGN KEY (exam_type_id) REFERENCES public.results_checker_types (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sender_ids ADD CONSTRAINT shop_sender_ids_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_activations ADD CONSTRAINT shop_sms_activations_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_activations ADD CONSTRAINT shop_sms_activations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (id);
ALTER TABLE public.shop_sms_delivery_receipts ADD CONSTRAINT shop_sms_delivery_receipts_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.shop_sms_logs (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_group_members ADD CONSTRAINT shop_sms_group_members_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_group_members ADD CONSTRAINT shop_sms_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.shop_sms_groups (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_groups ADD CONSTRAINT shop_sms_groups_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (id);
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.shop_sms_bundles (id);
ALTER TABLE public.shop_sms_refund_failures ADD CONSTRAINT shop_sms_refund_failures_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_send_claims ADD CONSTRAINT shop_sms_send_claims_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_templates ADD CONSTRAINT shop_sms_templates_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_sms_wallets ADD CONSTRAINT shop_sms_wallets_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_shop_wallet_id_fkey FOREIGN KEY (shop_wallet_id) REFERENCES public.shop_wallets (id) ON DELETE CASCADE;
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_sub_approved_by_fkey FOREIGN KEY (sub_approved_by) REFERENCES public.users (id);
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_shop_order_id_fkey FOREIGN KEY (shop_order_id) REFERENCES public.shop_orders (id) ON DELETE SET NULL;
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_afa_order_id_fkey FOREIGN KEY (afa_order_id) REFERENCES public.afa_orders (id);
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users (id);
ALTER TABLE public.shop_wallets ADD CONSTRAINT shop_wallets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.sms_accounts ADD CONSTRAINT sms_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users (id);
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_contact_groups ADD CONSTRAINT sms_contact_groups_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_contacts ADD CONSTRAINT sms_contacts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.sms_groups (id) ON DELETE CASCADE;
ALTER TABLE public.sms_credit_ledger ADD CONSTRAINT sms_credit_ledger_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_group_contacts ADD CONSTRAINT sms_group_contacts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.sms_contact_groups (id) ON DELETE CASCADE;
ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.sms_campaigns (id) ON DELETE CASCADE;
ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.sms_bundles (id);
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_sender_ids ADD CONSTRAINT sms_sender_ids_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_user_templates ADD CONSTRAINT sms_user_templates_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sms_wallets ADD CONSTRAINT sms_wallets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.sms_accounts (id) ON DELETE CASCADE;
ALTER TABLE public.sub_agent_default_pricing ADD CONSTRAINT sub_agent_default_pricing_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.users (id);
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_sub_user_id_fkey FOREIGN KEY (sub_user_id) REFERENCES public.users (id);
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.users (id);
ALTER TABLE public.sub_agent_pricing ADD CONSTRAINT sub_agent_pricing_sub_user_id_fkey FOREIGN KEY (sub_user_id) REFERENCES public.users (id);
ALTER TABLE public.sub_agent_pricing ADD CONSTRAINT sub_agent_pricing_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.users (id);
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_upline_user_id_fkey FOREIGN KEY (upline_user_id) REFERENCES public.users (id);
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_upline_shop_id_fkey FOREIGN KEY (upline_shop_id) REFERENCES public.shop_profiles (id) ON DELETE RESTRICT;
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users (id);
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_joined_via_invite_fkey FOREIGN KEY (joined_via_invite) REFERENCES public.shop_invites (id);
ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.support_threads (id) ON DELETE CASCADE;
ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE SET NULL;
ALTER TABLE public.terms_acceptances ADD CONSTRAINT terms_acceptances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.terms_versions ADD CONSTRAINT terms_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id) ON DELETE SET NULL;
ALTER TABLE public.user_payment_references ADD CONSTRAINT user_payment_references_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.ussd_pending_orders ADD CONSTRAINT ussd_pending_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.ussd_refund_queue ADD CONSTRAINT ussd_refund_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
ALTER TABLE public.ussd_refund_queue ADD CONSTRAINT ussd_refund_queue_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.users (id);
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.users (id);
ALTER TABLE public.utility_refund_queue ADD CONSTRAINT utility_refund_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);
ALTER TABLE public.utility_refund_queue ADD CONSTRAINT utility_refund_queue_utility_order_id_fkey FOREIGN KEY (utility_order_id) REFERENCES public.utility_orders (id);
ALTER TABLE public.utility_refund_queue ADD CONSTRAINT utility_refund_queue_refunded_by_fkey FOREIGN KEY (refunded_by) REFERENCES public.users (id);
ALTER TABLE public.utility_refund_queue ADD CONSTRAINT utility_refund_queue_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_profiles (id);
ALTER TABLE public.utility_saved_accounts ADD CONSTRAINT utility_saved_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets (id) ON DELETE CASCADE;
ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets (id) ON DELETE CASCADE;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;

-- ===== CHECK =====
ALTER TABLE public.admin_profit_logs ADD CONSTRAINT admin_profit_logs_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['main'::text, 'shop'::text, 'results_checker'::text])));
ALTER TABLE public.admin_profit_logs ADD CONSTRAINT admin_profit_logs_channel_check CHECK ((channel = ANY (ARRAY['main'::text, 'shop'::text, 'results_checker'::text])));
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text])));
ALTER TABLE public.afa_orders ADD CONSTRAINT afa_orders_source_check CHECK ((source = ANY (ARRAY['web'::text, 'ussd'::text, 'api'::text, 'shop'::text, 'ussd_shop'::text])));
ALTER TABLE public.airtime_fulfillment_batches ADD CONSTRAINT airtime_fulfillment_batches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'partial'::text, 'failed'::text])));
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_airtime_amount_check CHECK ((airtime_amount > (0)::numeric));
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_bundle_preference_check CHECK (((bundle_preference = ANY (ARRAY['balanced'::text, 'data'::text, 'voice'::text])) OR (bundle_preference IS NULL)));
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_total_paid_check CHECK ((total_paid > (0)::numeric));
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_type_check CHECK ((type = ANY (ARRAY['airtime'::text, 'mashup'::text])));
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_network_check CHECK ((network = ANY (ARRAY['MTN'::text, 'Telecel'::text, 'AT'::text])));
ALTER TABLE public.airtime_orders ADD CONSTRAINT airtime_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'revoked'::text])));
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_key_type_check CHECK ((key_type = ANY (ARRAY['standard'::text, 'commission'::text, 'sms'::text])));
ALTER TABLE public.atishare_console_manual_sends ADD CONSTRAINT atishare_console_manual_sends_bundle_mb_check CHECK ((bundle_mb > 0));
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_type_check CHECK ((type = ANY (ARRAY['commission'::text, 'transfer_out_main'::text, 'transfer_out_shop'::text, 'withdrawal'::text, 'withdrawal_reversal'::text, 'sub_agent_margin'::text, 'sub_agent_margin_reversal'::text])));
ALTER TABLE public.commission_wallet_transactions ADD CONSTRAINT commission_wallet_transactions_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.complaints ADD CONSTRAINT complaints_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'resolved'::text, 'rejected'::text])));
ALTER TABLE public.data_packages ADD CONSTRAINT data_packages_network_check CHECK ((network = ANY (ARRAY['MTN'::text, 'Telecel'::text, 'AT-iShare'::text, 'AT-BigTime'::text])));
ALTER TABLE public.fulfillment_logs ADD CONSTRAINT fulfillment_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.hubtel_receive_charges ADD CONSTRAINT hubtel_receive_charges_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'refunded'::text])));
ALTER TABLE public.hubtel_receive_charges ADD CONSTRAINT hubtel_receive_charges_service_type_check CHECK ((service_type = ANY (ARRAY['utility'::text, 'airtime'::text, 'rc'::text])));
ALTER TABLE public.momo_claim_attempts ADD CONSTRAINT momo_claim_attempts_result_check CHECK ((result = ANY (ARRAY['found'::text, 'not_found'::text, 'already_claimed'::text, 'rate_limited'::text, 'below_minimum'::text, 'flagged'::text, 'invalid_format'::text])));
ALTER TABLE public.momo_transactions ADD CONSTRAINT momo_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'voided'::text, 'flagged'::text])));
ALTER TABLE public.momo_transactions ADD CONSTRAINT momo_transactions_sender_network_check CHECK ((sender_network = ANY (ARRAY['MTN'::text, 'Telecel'::text, 'AirtelTigo'::text, 'Unknown'::text])));
ALTER TABLE public.mtn_fulfillment_tracking ADD CONSTRAINT mtn_fulfillment_tracking_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.mtn_whitelist_server_status ADD CONSTRAINT mtn_whitelist_server_status_server_check CHECK ((server = ANY (ARRAY[1, 2])));
ALTER TABLE public.mtn_whitelist_server_status ADD CONSTRAINT mtn_whitelist_server_status_status_check CHECK ((status = 'allowed'::text));
ALTER TABLE public.mtn_whitelist_status ADD CONSTRAINT mtn_whitelist_status_status_check CHECK ((status = ANY (ARRAY['allowed'::text, 'blocked'::text])));
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['order_update'::text, 'complaint_resolved'::text, 'payment_success'::text, 'balance_updated'::text, 'system'::text, 'role_upgrade'::text, 'welcome'::text, 'announcement'::text, 'support_reply'::text])));
ALTER TABLE public.number_registration_batches ADD CONSTRAINT number_registration_batches_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'confirmed'::text])));
ALTER TABLE public.number_registrations ADD CONSTRAINT number_registrations_status_check CHECK ((status = ANY (ARRAY['new'::text, 'submitted'::text, 'registered'::text])));
ALTER TABLE public.number_registrations ADD CONSTRAINT number_registrations_source_check CHECK ((source = ANY (ARRAY['backfill'::text, 'order'::text, 'admin'::text])));
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_status_check CHECK ((status = ANY (ARRAY['claimed'::text, 'dispatched'::text, 'failed'::text])));
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_mode_check CHECK ((mode = ANY (ARRAY['in_place'::text, 'new_order'::text])));
ALTER TABLE public.order_retry_attempts ADD CONSTRAINT order_retry_attempts_actor_role_check CHECK ((actor_role = ANY (ARRAY['admin'::text, 'user'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'refunded'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_method_check CHECK ((fulfillment_method = ANY (ARRAY['auto'::text, 'manual'::text, 'codecraft'::text, 'datakazina'::text, 'xpress'::text, 'ghdata'::text, 'agentportal'::text, 'datagod'::text, 'bundleportal'::text, 'hendylinks'::text, 'atishare_console'::text, 'spfastit'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_retried_by_role_check CHECK (((retried_by_role IS NULL) OR (retried_by_role = ANY (ARRAY['admin'::text, 'user'::text]))));
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_self_completed_by_role_check CHECK (((self_completed_by_role IS NULL) OR (self_completed_by_role = ANY (ARRAY['customer'::text, 'shop_owner'::text]))));
ALTER TABLE public.orders ADD CONSTRAINT orders_retry_from_status_check CHECK (((retry_from_status IS NULL) OR (retry_from_status = ANY (ARRAY['failed'::text, 'refunded'::text]))));
ALTER TABLE public.passkey_challenges ADD CONSTRAINT passkey_challenges_flow_check CHECK ((flow = ANY (ARRAY['registration'::text, 'authentication'::text])));
ALTER TABLE public.passkey_credentials ADD CONSTRAINT passkey_credentials_device_type_check CHECK ((device_type = ANY (ARRAY['singleDevice'::text, 'multiDevice'::text])));
ALTER TABLE public.pending_settlements ADD CONSTRAINT pending_settlements_amount_owed_check CHECK ((amount_owed > (0)::numeric));
ALTER TABLE public.pending_settlements ADD CONSTRAINT pending_settlements_amount_settled_check CHECK ((amount_settled >= (0)::numeric));
ALTER TABLE public.pending_settlements ADD CONSTRAINT settled_cannot_exceed_owed CHECK ((amount_settled <= amount_owed));
ALTER TABLE public.pending_settlements ADD CONSTRAINT pending_settlements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partially_settled'::text, 'settled'::text])));
ALTER TABLE public.results_checker_complaints ADD CONSTRAINT results_checker_complaints_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])));
ALTER TABLE public.results_checker_inventory ADD CONSTRAINT results_checker_inventory_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'sold'::text])));
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'pending_payment'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_quantity_check CHECK ((quantity > 0));
ALTER TABLE public.results_checker_orders ADD CONSTRAINT results_checker_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE public.results_checker_types ADD CONSTRAINT rc_types_pricing_sanity CHECK (((COALESCE(customer_price, (0)::numeric) >= COALESCE(cost_price, (0)::numeric)) AND (COALESCE(agent_price, (0)::numeric) >= COALESCE(cost_price, (0)::numeric))));
ALTER TABLE public.shop_afa_pending_orders ADD CONSTRAINT shop_afa_pending_orders_status_check CHECK ((status = ANY (ARRAY['awaiting_payment'::text, 'fulfilled'::text, 'expired'::text])));
ALTER TABLE public.shop_order_splits ADD CONSTRAINT shop_order_splits_profit_check CHECK ((profit >= (0)::numeric));
ALTER TABLE public.shop_order_splits ADD CONSTRAINT shop_order_splits_level_check CHECK ((level = ANY (ARRAY[1, 2])));
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE public.shop_payment_details ADD CONSTRAINT shop_payment_details_network_check CHECK ((network = ANY (ARRAY['MTN MoMo'::text, 'Telecel Cash'::text, 'AirtelTigo Money'::text])));
ALTER TABLE public.shop_pricing ADD CONSTRAINT check_profit_margin_range CHECK ((profit_margin > (0)::numeric));
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])));
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_pricing_status_check CHECK ((pricing_status = ANY (ARRAY['not_submitted'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_sms_sender_status_check CHECK ((sms_sender_status = ANY (ARRAY['under_review'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])));
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_fulfillment_mode_check CHECK ((fulfillment_mode = ANY (ARRAY['auto'::text, 'manual'::text])));
ALTER TABLE public.shop_profiles ADD CONSTRAINT shop_profiles_owner_pricing_nonnegative CHECK (((COALESCE(airtime_fee_mtn, (0)::numeric) >= (0)::numeric) AND (COALESCE(airtime_fee_telecel, (0)::numeric) >= (0)::numeric) AND (COALESCE(airtime_fee_at, (0)::numeric) >= (0)::numeric) AND (COALESCE(mashup_fee_percent, (0)::numeric) >= (0)::numeric) AND (COALESCE(results_checker_markup_customer, (0)::numeric) >= (0)::numeric) AND (COALESCE(results_checker_markup_agent, (0)::numeric) >= (0)::numeric) AND (COALESCE(results_checker_markup_dealer, (0)::numeric) >= (0)::numeric) AND (COALESCE(afa_fee_percent, (0)::numeric) >= (0)::numeric) AND ((afa_selling_price IS NULL) OR (afa_selling_price > (0)::numeric))));
ALTER TABLE public.shop_rc_markups ADD CONSTRAINT shop_rc_markups_markup_check CHECK ((markup >= (0)::numeric));
ALTER TABLE public.shop_sender_ids ADD CONSTRAINT shop_sender_ids_status_check CHECK ((status = ANY (ARRAY['under_review'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])));
ALTER TABLE public.shop_sender_ids ADD CONSTRAINT shop_sender_ids_sender_text_check CHECK ((((length(TRIM(BOTH FROM sender_text)) >= 3) AND (length(TRIM(BOTH FROM sender_text)) <= 11)) AND (sender_text ~ '^[A-Za-z0-9 ]+$'::text)));
ALTER TABLE public.shop_sms_activations ADD CONSTRAINT shop_sms_activations_paid_from_check CHECK ((paid_from = ANY (ARRAY['wallet'::text, 'profit'::text])));
ALTER TABLE public.shop_sms_activations ADD CONSTRAINT shop_sms_activations_amount_paid_check CHECK ((amount_paid >= (0)::numeric));
ALTER TABLE public.shop_sms_bundles ADD CONSTRAINT shop_sms_bundles_price_check CHECK ((price > (0)::numeric));
ALTER TABLE public.shop_sms_bundles ADD CONSTRAINT shop_sms_bundles_credits_check CHECK ((credits > 0));
ALTER TABLE public.shop_sms_delivery_receipts ADD CONSTRAINT shop_sms_delivery_receipts_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'undelivered'::text, 'rejected'::text, 'expired'::text])));
ALTER TABLE public.shop_sms_group_members ADD CONSTRAINT shop_sms_group_members_name_len CHECK (((name IS NULL) OR (char_length(name) <= 100)));
ALTER TABLE public.shop_sms_groups ADD CONSTRAINT shop_sms_groups_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 60)));
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_credits_used_check CHECK ((credits_used >= 0));
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'auto_confirmation'::text, 'reconciliation'::text])));
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'partial'::text, 'failed'::text, 'blocked'::text])));
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_recipients_count_check CHECK ((recipients_count > 0));
ALTER TABLE public.shop_sms_logs ADD CONSTRAINT shop_sms_logs_segments_check CHECK ((segments > 0));
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_credits_check CHECK ((credits > 0));
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_price_check CHECK ((price > (0)::numeric));
ALTER TABLE public.shop_sms_purchases ADD CONSTRAINT shop_sms_purchases_paid_from_check CHECK ((paid_from = ANY (ARRAY['wallet'::text, 'profit'::text])));
ALTER TABLE public.shop_sms_refund_failures ADD CONSTRAINT shop_sms_refund_failures_credits_check CHECK ((credits > 0));
ALTER TABLE public.shop_sms_templates ADD CONSTRAINT shop_sms_templates_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 60)));
ALTER TABLE public.shop_sms_templates ADD CONSTRAINT shop_sms_templates_body_check CHECK (((char_length(TRIM(BOTH FROM body)) >= 3) AND (char_length(TRIM(BOTH FROM body)) <= 1000)));
ALTER TABLE public.shop_sms_wallets ADD CONSTRAINT shop_sms_wallets_credits_check CHECK ((credits >= 0));
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_payout_provider_check CHECK (((payout_provider IS NULL) OR (payout_provider = ANY (ARRAY['moolre'::text, 'paystack'::text, 'manual'::text]))));
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_type_check CHECK ((type = ANY (ARRAY['profit'::text, 'withdrawal'::text, 'profit_reversal'::text, 'utility_commission'::text, 'commission_transfer_in'::text])));
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_sub_approval_status_check CHECK ((sub_approval_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.shop_wallet_transactions ADD CONSTRAINT shop_wallet_transactions_status_check CHECK ((status = ANY (ARRAY['shop_owner_pending'::text, 'pending'::text, 'moolre_pending'::text, 'paystack_pending'::text, 'completed'::text, 'failed'::text, 'reversed'::text])));
ALTER TABLE public.sms_accounts ADD CONSTRAINT sms_accounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])));
ALTER TABLE public.sms_accounts ADD CONSTRAINT sms_accounts_mode_check CHECK ((mode = ANY (ARRAY['platform'::text, 'business'::text])));
ALTER TABLE public.sms_bundles ADD CONSTRAINT sms_bundles_business_price_check CHECK (((business_price IS NULL) OR (business_price > (0)::numeric)));
ALTER TABLE public.sms_bundles ADD CONSTRAINT sms_bundles_price_check CHECK ((price > (0)::numeric));
ALTER TABLE public.sms_bundles ADD CONSTRAINT sms_bundles_mode_check CHECK ((mode = ANY (ARRAY['platform'::text, 'business'::text, 'both'::text])));
ALTER TABLE public.sms_bundles ADD CONSTRAINT sms_bundles_credits_check CHECK ((credits > 0));
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_business_name_check CHECK (((length(business_name) >= 2) AND (length(business_name) <= 120)));
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])));
ALTER TABLE public.sms_business_profiles ADD CONSTRAINT sms_business_profiles_description_check CHECK (((length(description) >= 10) AND (length(description) <= 2000)));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_credits_charged_check CHECK ((credits_charged >= 0));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_flag_severity_check CHECK ((flag_severity = ANY (ARRAY['fraud'::text, 'info'::text])));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_mode_at_send_check CHECK ((mode_at_send = ANY (ARRAY['platform'::text, 'business'::text])));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_source_check CHECK ((source = ANY (ARRAY['dashboard'::text, 'api'::text])));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'partial'::text, 'failed'::text, 'blocked'::text, 'cancelled'::text])));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_recipients_count_check CHECK ((recipients_count >= 0));
ALTER TABLE public.sms_campaigns ADD CONSTRAINT sms_campaigns_segments_check CHECK ((segments >= 0));
ALTER TABLE public.sms_contact_groups ADD CONSTRAINT sms_contact_groups_name_check CHECK (((length(name) >= 1) AND (length(name) <= 80)));
ALTER TABLE public.sms_credit_ledger ADD CONSTRAINT sms_credit_ledger_kind_check CHECK ((kind = ANY (ARRAY['purchase'::text, 'debit'::text, 'refund'::text, 'bonus'::text, 'admin_adjust'::text])));
ALTER TABLE public.sms_messages ADD CONSTRAINT sms_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'undelivered'::text, 'failed'::text, 'expired'::text, 'rejected'::text])));
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_credits_check CHECK ((credits > 0));
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_price_check CHECK ((price > (0)::numeric));
ALTER TABLE public.sms_purchases ADD CONSTRAINT sms_purchases_paid_from_check CHECK ((paid_from = ANY (ARRAY['wallet'::text, 'momo'::text])));
ALTER TABLE public.sms_sender_ids ADD CONSTRAINT sms_sender_ids_status_check CHECK ((status = ANY (ARRAY['under_review'::text, 'submitted_to_hubtel'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])));
ALTER TABLE public.sms_sender_ids ADD CONSTRAINT sms_sender_ids_sender_text_check CHECK ((((length(TRIM(BOTH FROM sender_text)) >= 3) AND (length(TRIM(BOTH FROM sender_text)) <= 11)) AND (sender_text ~ '^[A-Za-z0-9 ]+$'::text)));
ALTER TABLE public.sms_user_templates ADD CONSTRAINT sms_user_templates_name_check CHECK (((length(name) >= 1) AND (length(name) <= 60)));
ALTER TABLE public.sms_user_templates ADD CONSTRAINT sms_user_templates_body_check CHECK (((length(body) >= 3) AND (length(body) <= 1000)));
ALTER TABLE public.sms_wallets ADD CONSTRAINT sms_wallets_credits_check CHECK ((credits >= 0));
ALTER TABLE public.sub_agent_default_pricing ADD CONSTRAINT sub_agent_default_pricing_product_type_check CHECK ((product_type = ANY (ARRAY['data'::text, 'afa'::text, 'results_checker'::text])));
ALTER TABLE public.sub_agent_default_pricing ADD CONSTRAINT sub_agent_default_pricing_markup_check CHECK ((markup >= (0)::numeric));
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'credited'::text, 'reversed'::text])));
ALTER TABLE public.sub_agent_order_earnings ADD CONSTRAINT sub_agent_order_earnings_order_table_check CHECK ((order_table = ANY (ARRAY['orders'::text, 'afa_orders'::text, 'results_checker_orders'::text, 'shop_orders'::text])));
ALTER TABLE public.sub_agent_pricing ADD CONSTRAINT sub_agent_pricing_product_type_check CHECK ((product_type = ANY (ARRAY['data'::text, 'afa'::text, 'results_checker'::text])));
ALTER TABLE public.sub_agent_pricing ADD CONSTRAINT sub_agent_pricing_markup_check CHECK ((markup >= (0)::numeric));
ALTER TABLE public.sub_agents ADD CONSTRAINT sub_agents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text])));
ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['user'::text, 'admin'::text])));
ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_category_check CHECK ((category = ANY (ARRAY['order'::text, 'payment'::text, 'account'::text, 'other'::text])));
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_visible_on_check CHECK ((visible_on = ANY (ARRAY['main_site'::text, 'storefronts'::text, 'both'::text])));
ALTER TABLE public.system_announcements ADD CONSTRAINT system_announcements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text])));
ALTER TABLE public.user_payment_references ADD CONSTRAINT chk_reference_code_format CHECK ((reference_code ~ '^[A-Z0-9]{4,12}$'::text));
ALTER TABLE public.users ADD CONSTRAINT users_auto_upgrade_plan_check CHECK ((auto_upgrade_plan = ANY (ARRAY['3d'::text, '14d'::text, '30d'::text, 'permanent'::text, '1m'::text, '3m'::text, '6m'::text])));
ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'inactive'::text])));
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'agent'::text, 'dealer'::text, 'admin'::text, 'sub-admin'::text, 'subagent'::text])));
ALTER TABLE public.ussd_callback_retry_queue ADD CONSTRAINT ussd_callback_retry_queue_service_status_check CHECK ((service_status = ANY (ARRAY['success'::text, 'failed'::text])));
ALTER TABLE public.ussd_pending_orders ADD CONSTRAINT ussd_pending_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'fulfilled'::text, 'failed'::text, 'expired'::text])));
ALTER TABLE public.ussd_pending_orders ADD CONSTRAINT ussd_pending_orders_service_type_check CHECK ((service_type = ANY (ARRAY['data'::text, 'results_checker'::text, 'afa'::text, 'airtime'::text, 'utility'::text, 'mashup'::text])));
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_biller_check CHECK ((biller = ANY (ARRAY['ecg'::text, 'ghana_water'::text, 'dstv'::text, 'gotv'::text, 'startimes'::text])));
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_source_check CHECK ((source = ANY (ARRAY['dashboard'::text, 'storefront'::text, 'api'::text, 'ussd'::text, 'ussd_shop'::text])));
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['wallet'::text, 'hubtel_checkout'::text, 'hubtel_receive'::text, 'ussd_momo'::text, 'ussd_wallet'::text, 'paystack'::text])));
ALTER TABLE public.utility_orders ADD CONSTRAINT utility_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'refunded'::text])));
ALTER TABLE public.utility_saved_accounts ADD CONSTRAINT utility_saved_accounts_biller_check CHECK ((biller = ANY (ARRAY['ecg'::text, 'ghana_water'::text, 'dstv'::text, 'gotv'::text, 'startimes'::text])));
ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_source_check CHECK ((source = ANY (ARRAY['payment'::text, 'refund'::text, 'admin'::text, 'purchase'::text, 'ussd'::text, 'airtime'::text, 'utility'::text, 'retry'::text, 'commission'::text, 'results_checker'::text])));
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text])));
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_closed_outcome_check CHECK ((closed_outcome = ANY (ARRAY['won'::text, 'lost'::text, 'spam'::text])));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_category_check CHECK ((category = ANY (ARRAY['business_portfolio'::text, 'ecommerce'::text, 'booking_appointment'::text, 'school_church_org'::text, 'blog_news'::text, 'mobile_app'::text, 'custom_web_app'::text, 'other'::text])));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_budget_ghs_check CHECK (((budget_ghs IS NULL) OR ((budget_ghs >= (1000)::numeric) AND (budget_ghs <= (10000000)::numeric))));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_request_type_check CHECK ((request_type = ANY (ARRAY['full_request'::text, 'call_request'::text])));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_timeline_check CHECK ((timeline = ANY (ARRAY['asap'::text, '1_month'::text, '2_3_months'::text, 'flexible'::text])));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'closed'::text])));
ALTER TABLE public.website_requests ADD CONSTRAINT website_requests_shape_check CHECK ((((request_type = 'full_request'::text) AND (category IS NOT NULL) AND (budget_ghs IS NOT NULL) AND (timeline IS NOT NULL)) OR ((request_type = 'call_request'::text) AND (category IS NULL) AND (budget_ghs IS NULL) AND (timeline IS NULL))));



-- ============================================================
-- 03 FUNCTIONS
-- ============================================================
-- ===== _profit_daily_rows_v2 (p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_product_types text[], p_network text) =====
CREATE OR REPLACE FUNCTION public._profit_daily_rows_v2(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_product_types text[], p_network text)
 RETURNS TABLE(day date, revenue numeric, cost numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH flags AS (
    SELECT
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'data' = ANY(p_product_types)) AS inc_data,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'airtime' = ANY(p_product_types)) AS inc_airtime,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'utility' = ANY(p_product_types)) AS inc_utility,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'afa' = ANY(p_product_types)) AS inc_afa,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'results_checker' = ANY(p_product_types)) AS inc_rc,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'subscriptions' = ANY(p_product_types)) AS inc_sub,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'sms' = ANY(p_product_types)) AS inc_sms,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'ussd_activation' = ANY(p_product_types)) AS inc_ussd,
      (p_network IS NOT NULL AND p_network <> 'all') AS net_filter
  ),
  afa_setting AS (
    SELECT NULLIF(trim(both '"' from value::text), '')::numeric AS afa_cost
    FROM public.admin_settings WHERE key = 'afa_cost_price'
  ),
  sms_setting AS (
    SELECT COALESCE(
      (SELECT NULLIF(trim(both '"' from value::text), '')::numeric FROM public.admin_settings WHERE key = 'sms_cost_per_segment'),
      0.243
    ) AS sms_cost_per_segment
  ),
  ussd_setting AS (
    SELECT COALESCE(
      (SELECT NULLIF(trim(both '"' from value::text), '')::numeric FROM public.admin_settings WHERE key = 'ussd_shop_activation_fee'),
      50
    ) AS fee
  ),

  data_main AS (
    SELECT o.created_at::date AS day, o.price AS revenue, o.cost_price_at_time + COALESCE(sae.amount,0) AS cost
    FROM public.orders o
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'orders' AND sae.order_reference = o.reference_code AND sae.status IN ('pending','credited')
    WHERE f.inc_data AND o.status = 'completed' AND o.shop_order_id IS NULL AND o.cost_price_at_time > 0
      AND o.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND o.network IN ('AT-iShare', 'AT-BigTime'))
        OR (p_network <> 'AirtelTigo' AND o.network = p_network)
      )
  ),
  data_shop AS (
    SELECT so.created_at::date AS day, so.cost_price AS revenue, so.admin_cost_at_time + COALESCE(sae.amount,0) AS cost
    FROM public.shop_orders so
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'shop_orders' AND sae.order_reference = COALESCE(so.paystack_reference, so.id::text) AND sae.status IN ('pending','credited')
    WHERE f.inc_data AND so.status = 'completed' AND so.admin_cost_at_time IS NOT NULL AND so.admin_cost_at_time > 0
      AND so.package_id IS NOT NULL
      AND so.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND so.network IN ('AT-iShare', 'AT-BigTime'))
        OR (p_network <> 'AirtelTigo' AND so.network = p_network)
      )
  ),
  airtime_rows AS (
    SELECT ao.created_at::date AS day,
      ao.admin_fee_amount + COALESCE(ao.commission_amount,0) AS revenue,
      COALESCE(ao.partner_commission_amount,0) AS cost
    FROM public.airtime_orders ao
    CROSS JOIN flags f
    WHERE f.inc_airtime AND ao.status = 'completed'
      AND ao.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND ao.network = 'AT')
        OR (p_network <> 'AirtelTigo' AND ao.network = p_network)
      )
  ),
  utility_rows AS (
    SELECT uo.created_at::date AS day, COALESCE(uo.commission_amount,0) AS revenue, COALESCE(uo.partner_commission_amount,0) AS cost
    FROM public.utility_orders uo
    CROSS JOIN flags f
    WHERE f.inc_utility AND uo.status = 'completed'
      AND uo.created_at BETWEEN p_start_date AND p_end_date
  ),
  afa_rows AS (
    SELECT ao.created_at::date AS day,
      CASE WHEN ao.shop_id IS NOT NULL THEN ao.cost_price ELSE COALESCE(ao.payment_amount, ao.selling_price, 0) END AS revenue,
      s.afa_cost + COALESCE(sae.amount,0) AS cost
    FROM public.afa_orders ao
    CROSS JOIN flags f
    CROSS JOIN afa_setting s
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'afa_orders' AND sae.order_reference = ao.reference_code AND sae.status IN ('pending','credited')
    WHERE f.inc_afa AND s.afa_cost IS NOT NULL AND ao.status = 'completed'
      AND ao.created_at BETWEEN p_start_date AND p_end_date
  ),
  rc_rows AS (
    SELECT rco.created_at::date AS day,
      (rco.total_paid - COALESCE(rco.shop_markup, 0) * rco.quantity - COALESCE(rco.fee_amount, 0)) AS revenue,
      (rco.cost_price_at_time * rco.quantity) + COALESCE(sae.amount,0) AS cost
    FROM public.results_checker_orders rco
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'results_checker_orders' AND sae.order_reference = rco.reference_code AND sae.status IN ('pending','credited')
    WHERE f.inc_rc AND rco.status = 'completed' AND rco.cost_price_at_time IS NOT NULL AND rco.cost_price_at_time >= 0
      AND rco.created_at BETWEEN p_start_date AND p_end_date
  ),
  sub_rows AS (
    SELECT wt.created_at::date AS day, wt.amount AS revenue, 0::numeric AS cost
    FROM public.wallet_transactions wt
    CROSS JOIN flags f
    WHERE f.inc_sub AND wt.type = 'debit' AND wt.status = 'completed'
      AND wt.source = 'purchase' AND wt.reference LIKE 'upgrade\_%' ESCAPE '\'
      AND wt.created_at BETWEEN p_start_date AND p_end_date
  ),
  sms_bundle_rows AS (
    SELECT ssp.created_at::date AS day, ssp.price AS revenue, ssp.credits * sm.sms_cost_per_segment AS cost
    FROM public.shop_sms_purchases ssp
    CROSS JOIN flags f
    CROSS JOIN sms_setting sm
    WHERE f.inc_sms AND ssp.created_at BETWEEN p_start_date AND p_end_date
  ),
  sms_activation_rows AS (
    SELECT ssa.created_at::date AS day, ssa.amount_paid AS revenue, 0::numeric AS cost
    FROM public.shop_sms_activations ssa
    CROSS JOIN flags f
    WHERE f.inc_sms AND ssa.created_at BETWEEN p_start_date AND p_end_date
  ),
  ussd_rows AS (
    SELECT sp.ussd_activated_at::date AS day, COALESCE(wt.amount, us.fee) AS revenue, 0::numeric AS cost
    FROM public.shop_profiles sp
    CROSS JOIN flags f
    CROSS JOIN ussd_setting us
    LEFT JOIN public.wallet_transactions wt
      ON wt.type = 'debit' AND wt.status = 'completed' AND wt.reference = 'USSDACT-' || sp.id::text
    WHERE f.inc_ussd AND sp.ussd_activated_at IS NOT NULL
      AND sp.ussd_activated_at BETWEEN p_start_date AND p_end_date
  )

  SELECT day, revenue, cost FROM data_main
  UNION ALL SELECT day, revenue, cost FROM data_shop
  UNION ALL SELECT day, revenue, cost FROM airtime_rows
  UNION ALL SELECT day, revenue, cost FROM utility_rows
  UNION ALL SELECT day, revenue, cost FROM afa_rows
  UNION ALL SELECT day, revenue, cost FROM rc_rows
  UNION ALL SELECT day, revenue, cost FROM sub_rows
  UNION ALL SELECT day, revenue, cost FROM sms_bundle_rows
  UNION ALL SELECT day, revenue, cost FROM sms_activation_rows
  UNION ALL SELECT day, revenue, cost FROM ussd_rows
$function$
;

-- ===== _profit_totals_v2 (p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_product_types text[], p_network text) =====
CREATE OR REPLACE FUNCTION public._profit_totals_v2(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_product_types text[], p_network text)
 RETURNS TABLE(product text, revenue numeric, cost numeric, profit numeric, orders bigint, excluded bigint, recruiter_payout numeric, partner_payout numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH flags AS (
    SELECT
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'data' = ANY(p_product_types)) AS inc_data,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'airtime' = ANY(p_product_types)) AS inc_airtime,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'utility' = ANY(p_product_types)) AS inc_utility,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'afa' = ANY(p_product_types)) AS inc_afa,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'results_checker' = ANY(p_product_types)) AS inc_rc,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'subscriptions' = ANY(p_product_types)) AS inc_sub,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'sms' = ANY(p_product_types)) AS inc_sms,
      (p_product_types IS NULL OR array_length(p_product_types,1) IS NULL OR 'ussd_activation' = ANY(p_product_types)) AS inc_ussd,
      (p_network IS NOT NULL AND p_network <> 'all') AS net_filter
  ),
  afa_setting AS (
    SELECT NULLIF(trim(both '"' from value::text), '')::numeric AS afa_cost
    FROM public.admin_settings WHERE key = 'afa_cost_price'
  ),
  sms_setting AS (
    SELECT COALESCE(
      (SELECT NULLIF(trim(both '"' from value::text), '')::numeric FROM public.admin_settings WHERE key = 'sms_cost_per_segment'),
      0.243
    ) AS sms_cost_per_segment
  ),
  ussd_setting AS (
    SELECT COALESCE(
      (SELECT NULLIF(trim(both '"' from value::text), '')::numeric FROM public.admin_settings WHERE key = 'ussd_shop_activation_fee'),
      50
    ) AS fee
  ),

  data_main AS (
    SELECT o.price AS revenue, o.cost_price_at_time AS admin_cost, COALESCE(sae.amount,0) AS recruiter_amt
    FROM public.orders o
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'orders' AND sae.order_reference = o.reference_code AND sae.status IN ('pending','credited')
    WHERE f.inc_data AND o.status = 'completed' AND o.shop_order_id IS NULL AND o.cost_price_at_time > 0
      AND o.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND o.network IN ('AT-iShare', 'AT-BigTime'))
        OR (p_network <> 'AirtelTigo' AND o.network = p_network)
      )
  ),
  -- FIX (this migration): wrapped in IS NOT NULL, matching data_shop_excluded
  -- and rc_rows_excluded's already-correct pattern below.
  data_main_excluded AS (
    SELECT COUNT(*) AS n
    FROM public.orders o
    CROSS JOIN flags f
    WHERE f.inc_data AND o.status = 'completed' AND o.shop_order_id IS NULL
      AND NOT (o.cost_price_at_time IS NOT NULL AND o.cost_price_at_time > 0)
      AND o.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND o.network IN ('AT-iShare', 'AT-BigTime'))
        OR (p_network <> 'AirtelTigo' AND o.network = p_network)
      )
  ),
  data_shop AS (
    SELECT so.cost_price AS revenue, so.admin_cost_at_time AS admin_cost, COALESCE(sae.amount,0) AS recruiter_amt
    FROM public.shop_orders so
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'shop_orders' AND sae.order_reference = COALESCE(so.paystack_reference, so.id::text) AND sae.status IN ('pending','credited')
    WHERE f.inc_data AND so.status = 'completed' AND so.admin_cost_at_time IS NOT NULL AND so.admin_cost_at_time > 0
      AND so.package_id IS NOT NULL
      AND so.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND so.network IN ('AT-iShare', 'AT-BigTime'))
        OR (p_network <> 'AirtelTigo' AND so.network = p_network)
      )
  ),
  data_shop_excluded AS (
    SELECT COUNT(*) AS n
    FROM public.shop_orders so
    CROSS JOIN flags f
    WHERE f.inc_data AND so.status = 'completed'
      AND NOT (so.admin_cost_at_time IS NOT NULL AND so.admin_cost_at_time > 0)
      AND so.package_id IS NOT NULL
      AND so.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND so.network IN ('AT-iShare', 'AT-BigTime'))
        OR (p_network <> 'AirtelTigo' AND so.network = p_network)
      )
  ),
  data_agg AS (
    SELECT 'data'::text AS product,
      COALESCE(SUM(revenue),0) AS revenue,
      COALESCE(SUM(admin_cost + recruiter_amt),0) AS cost,
      COALESCE(SUM(revenue - admin_cost - recruiter_amt),0) AS profit,
      COUNT(*) AS orders,
      (SELECT n FROM data_main_excluded) + (SELECT n FROM data_shop_excluded) AS excluded,
      COALESCE(SUM(recruiter_amt),0) AS recruiter_payout,
      0::numeric AS partner_payout
    FROM (
      SELECT revenue, admin_cost, recruiter_amt FROM data_main
      UNION ALL
      SELECT revenue, admin_cost, recruiter_amt FROM data_shop
    ) u
  ),

  airtime_rows AS (
    SELECT ao.admin_fee_amount, ao.commission_amount, ao.partner_commission_amount
    FROM public.airtime_orders ao
    CROSS JOIN flags f
    WHERE f.inc_airtime AND ao.status = 'completed'
      AND ao.created_at BETWEEN p_start_date AND p_end_date
      AND (
        NOT f.net_filter
        OR (p_network = 'AirtelTigo' AND ao.network = 'AT')
        OR (p_network <> 'AirtelTigo' AND ao.network = p_network)
      )
  ),
  airtime_agg AS (
    SELECT 'airtime'::text AS product,
      COALESCE(SUM(admin_fee_amount),0) + COALESCE(SUM(commission_amount),0) AS revenue,
      COALESCE(SUM(partner_commission_amount),0) AS cost,
      COALESCE(SUM(admin_fee_amount),0) + COALESCE(SUM(commission_amount),0) - COALESCE(SUM(partner_commission_amount),0) AS profit,
      COUNT(*) AS orders,
      COUNT(*) FILTER (WHERE commission_amount IS NULL) AS excluded,
      0::numeric AS recruiter_payout,
      COALESCE(SUM(partner_commission_amount),0) AS partner_payout
    FROM airtime_rows
  ),

  utility_rows AS (
    SELECT uo.commission_amount, uo.partner_commission_amount
    FROM public.utility_orders uo
    CROSS JOIN flags f
    WHERE f.inc_utility AND uo.status = 'completed'
      AND uo.created_at BETWEEN p_start_date AND p_end_date
  ),
  utility_agg AS (
    SELECT 'utility'::text AS product,
      COALESCE(SUM(commission_amount),0) AS revenue,
      COALESCE(SUM(partner_commission_amount),0) AS cost,
      COALESCE(SUM(commission_amount),0) - COALESCE(SUM(partner_commission_amount),0) AS profit,
      COUNT(*) AS orders,
      COUNT(*) FILTER (WHERE commission_amount IS NULL) AS excluded,
      0::numeric AS recruiter_payout,
      COALESCE(SUM(partner_commission_amount),0) AS partner_payout
    FROM utility_rows
  ),

  afa_rows AS (
    SELECT CASE WHEN ao.shop_id IS NOT NULL THEN ao.cost_price ELSE COALESCE(ao.payment_amount, ao.selling_price, 0) END AS revenue,
      COALESCE(sae.amount,0) AS recruiter_amt
    FROM public.afa_orders ao
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'afa_orders' AND sae.order_reference = ao.reference_code AND sae.status IN ('pending','credited')
    WHERE f.inc_afa AND ao.status = 'completed'
      AND ao.created_at BETWEEN p_start_date AND p_end_date
  ),
  afa_agg AS (
    SELECT 'afa'::text AS product,
      CASE WHEN s.afa_cost IS NOT NULL THEN COALESCE((SELECT SUM(revenue) FROM afa_rows),0) ELSE 0 END AS revenue,
      CASE WHEN s.afa_cost IS NOT NULL THEN COALESCE((SELECT SUM(s.afa_cost + recruiter_amt) FROM afa_rows),0) ELSE 0 END AS cost,
      CASE WHEN s.afa_cost IS NOT NULL THEN COALESCE((SELECT SUM(revenue - s.afa_cost - recruiter_amt) FROM afa_rows),0) ELSE 0 END AS profit,
      CASE WHEN s.afa_cost IS NOT NULL THEN (SELECT COUNT(*) FROM afa_rows) ELSE 0 END AS orders,
      CASE WHEN s.afa_cost IS NOT NULL THEN 0 ELSE (SELECT COUNT(*) FROM afa_rows) END AS excluded,
      CASE WHEN s.afa_cost IS NOT NULL THEN COALESCE((SELECT SUM(recruiter_amt) FROM afa_rows),0) ELSE 0 END AS recruiter_payout,
      0::numeric AS partner_payout
    FROM afa_setting s
  ),

  rc_rows AS (
    SELECT
      (rco.total_paid - COALESCE(rco.shop_markup, 0) * rco.quantity - COALESCE(rco.fee_amount, 0)) AS revenue,
      (rco.cost_price_at_time * rco.quantity) AS admin_cost,
      COALESCE(sae.amount,0) AS recruiter_amt
    FROM public.results_checker_orders rco
    CROSS JOIN flags f
    LEFT JOIN public.sub_agent_order_earnings sae
      ON sae.order_table = 'results_checker_orders' AND sae.order_reference = rco.reference_code AND sae.status IN ('pending','credited')
    WHERE f.inc_rc AND rco.status = 'completed' AND rco.cost_price_at_time IS NOT NULL AND rco.cost_price_at_time >= 0
      AND rco.created_at BETWEEN p_start_date AND p_end_date
  ),
  rc_rows_excluded AS (
    SELECT COUNT(*) AS n
    FROM public.results_checker_orders rco
    CROSS JOIN flags f
    WHERE f.inc_rc AND rco.status = 'completed'
      AND NOT (rco.cost_price_at_time IS NOT NULL AND rco.cost_price_at_time >= 0)
      AND rco.created_at BETWEEN p_start_date AND p_end_date
  ),
  rc_agg AS (
    SELECT 'results_checker'::text AS product,
      COALESCE(SUM(revenue),0) AS revenue,
      COALESCE(SUM(admin_cost + recruiter_amt),0) AS cost,
      COALESCE(SUM(revenue - admin_cost - recruiter_amt),0) AS profit,
      COUNT(*) AS orders,
      (SELECT n FROM rc_rows_excluded) AS excluded,
      COALESCE(SUM(recruiter_amt),0) AS recruiter_payout,
      0::numeric AS partner_payout
    FROM rc_rows
  ),

  sub_rows AS (
    SELECT wt.amount AS revenue
    FROM public.wallet_transactions wt
    CROSS JOIN flags f
    WHERE f.inc_sub AND wt.type = 'debit' AND wt.status = 'completed'
      AND wt.source = 'purchase' AND wt.reference LIKE 'upgrade\_%' ESCAPE '\'
      AND wt.created_at BETWEEN p_start_date AND p_end_date
  ),
  sub_agg AS (
    SELECT 'subscriptions'::text AS product,
      COALESCE(SUM(revenue),0) AS revenue, 0::numeric AS cost, COALESCE(SUM(revenue),0) AS profit,
      COUNT(*) AS orders, 0::bigint AS excluded, 0::numeric AS recruiter_payout, 0::numeric AS partner_payout
    FROM sub_rows
  ),

  sms_bundle_rows AS (
    SELECT ssp.price AS revenue, ssp.credits * sm.sms_cost_per_segment AS cost
    FROM public.shop_sms_purchases ssp
    CROSS JOIN flags f
    CROSS JOIN sms_setting sm
    WHERE f.inc_sms AND ssp.created_at BETWEEN p_start_date AND p_end_date
  ),
  sms_activation_rows AS (
    SELECT ssa.amount_paid AS revenue, 0::numeric AS cost
    FROM public.shop_sms_activations ssa
    CROSS JOIN flags f
    WHERE f.inc_sms AND ssa.created_at BETWEEN p_start_date AND p_end_date
  ),
  sms_agg AS (
    SELECT 'sms'::text AS product,
      COALESCE(SUM(revenue),0) AS revenue,
      COALESCE(SUM(cost),0) AS cost,
      COALESCE(SUM(revenue - cost),0) AS profit,
      COUNT(*) AS orders, 0::bigint AS excluded, 0::numeric AS recruiter_payout, 0::numeric AS partner_payout
    FROM (
      SELECT revenue, cost FROM sms_bundle_rows
      UNION ALL
      SELECT revenue, cost FROM sms_activation_rows
    ) u
  ),

  ussd_rows AS (
    SELECT COALESCE(wt.amount, us.fee) AS revenue
    FROM public.shop_profiles sp
    CROSS JOIN flags f
    CROSS JOIN ussd_setting us
    LEFT JOIN public.wallet_transactions wt
      ON wt.type = 'debit' AND wt.status = 'completed' AND wt.reference = 'USSDACT-' || sp.id::text
    WHERE f.inc_ussd AND sp.ussd_activated_at IS NOT NULL
      AND sp.ussd_activated_at BETWEEN p_start_date AND p_end_date
  ),
  ussd_agg AS (
    SELECT 'ussd_activation'::text AS product,
      COALESCE(SUM(revenue),0) AS revenue, 0::numeric AS cost, COALESCE(SUM(revenue),0) AS profit,
      COUNT(*) AS orders, 0::bigint AS excluded, 0::numeric AS recruiter_payout, 0::numeric AS partner_payout
    FROM ussd_rows
  )

  SELECT * FROM data_agg
  UNION ALL SELECT * FROM airtime_agg
  UNION ALL SELECT * FROM utility_agg
  UNION ALL SELECT * FROM afa_agg
  UNION ALL SELECT * FROM rc_agg
  UNION ALL SELECT * FROM sub_agg
  UNION ALL SELECT * FROM sms_agg
  UNION ALL SELECT * FROM ussd_agg
$function$
;

-- ===== activate_shop_sms (p_owner_id uuid, p_paid_from text) =====
CREATE OR REPLACE FUNCTION public.activate_shop_sms(p_owner_id uuid, p_paid_from text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_shop_id UUID;
    v_fee     NUMERIC;
    v_rows    INTEGER;
BEGIN
    IF p_paid_from NOT IN ('wallet', 'profit') THEN
        RAISE EXCEPTION 'INVALID_SOURCE';
    END IF;

    SELECT id INTO v_shop_id FROM shop_profiles WHERE owner_id = p_owner_id;
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'SHOP_NOT_FOUND';
    END IF;

    IF EXISTS (SELECT 1 FROM shop_sms_activations WHERE shop_id = v_shop_id) THEN
        RAISE EXCEPTION 'ALREADY_ACTIVATED';
    END IF;

    SELECT COALESCE(NULLIF(TRIM(BOTH '"' FROM value::text), '')::numeric, 0) INTO v_fee
    FROM shop_global_settings WHERE key = 'sms_activation_fee';
    IF v_fee IS NULL THEN v_fee := 0; END IF;

    IF v_fee > 0 THEN
        IF p_paid_from = 'wallet' THEN
            UPDATE wallets
            SET balance     = balance - v_fee,
                total_spent = COALESCE(total_spent, 0) + v_fee,
                updated_at  = now()
            WHERE user_id = p_owner_id AND balance >= v_fee;
        ELSE
            UPDATE shop_wallets
            SET balance    = balance - v_fee,
                updated_at = now()
            WHERE owner_id = p_owner_id AND balance >= v_fee;
        END IF;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
        END IF;

        IF p_paid_from = 'wallet' THEN
            INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
            SELECT id, p_owner_id, 'debit', v_fee, 'Shop SMS activation fee',
                   'SMSACT-' || v_shop_id::text, 'purchase', 'completed'
            FROM wallets WHERE user_id = p_owner_id;
        END IF;
    END IF;

    INSERT INTO shop_sms_activations (shop_id, owner_id, amount_paid, paid_from)
    VALUES (v_shop_id, p_owner_id, v_fee, p_paid_from);

    INSERT INTO shop_sms_wallets (shop_id, credits)
    VALUES (v_shop_id, 0)
    ON CONFLICT (shop_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'amount_paid', v_fee);
END;
$function$
;

-- ===== activate_shop_ussd (p_owner_id uuid, p_paid_from text, p_code text) =====
CREATE OR REPLACE FUNCTION public.activate_shop_ussd(p_owner_id uuid, p_paid_from text, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_shop       shop_profiles%ROWTYPE;
    v_fee        NUMERIC;
    v_rows       INTEGER;
    v_constraint TEXT;
BEGIN
    IF p_paid_from NOT IN ('wallet', 'profit') THEN
        RAISE EXCEPTION 'INVALID_SOURCE';
    END IF;

    -- Lock the shop row so concurrent activations serialise on it (F15).
    SELECT * INTO v_shop FROM shop_profiles WHERE owner_id = p_owner_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHOP_NOT_FOUND';
    END IF;

    IF v_shop.approval_status <> 'approved' OR COALESCE(v_shop.is_active, false) = false THEN
        RAISE EXCEPTION 'SHOP_NOT_APPROVED';
    END IF;

    -- Idempotent: if a code was EVER assigned, treat the shop as already
    -- activated and charge nothing â€” even if ussd_active was later toggled off.
    IF v_shop.ussd_code IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',        true,
            'code',           v_shop.ussd_code,
            'already_active', true,
            'amount_paid',    0
        );
    END IF;

    -- Fee from admin config only. admin_settings.value is JSONB stored as a
    -- quoted string e.g. "50.00" â€” strip the surrounding quotes before casting.
    SELECT COALESCE(NULLIF(trim(both '"' from value::text), '')::numeric, 50)
      INTO v_fee
      FROM admin_settings
     WHERE key = 'ussd_shop_activation_fee';
    IF v_fee IS NULL THEN
        v_fee := 50;
    END IF;
    IF v_fee < 0 THEN
        RAISE EXCEPTION 'INVALID_FEE';
    END IF;

    -- Atomic debit from the chosen balance (skipped when the fee is 0).
    IF v_fee > 0 THEN
        IF p_paid_from = 'wallet' THEN
            UPDATE wallets
               SET balance     = balance - v_fee,
                   total_spent = COALESCE(total_spent, 0) + v_fee,
                   updated_at  = now()
             WHERE user_id = p_owner_id AND balance >= v_fee;
        ELSE
            UPDATE shop_wallets
               SET balance    = balance - v_fee,
                   updated_at = now()
             WHERE owner_id = p_owner_id AND balance >= v_fee;
        END IF;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
        END IF;

        -- History row in the same transaction (rolled back with the debit if the
        -- activation below fails, e.g. CODE_TAKEN).
        IF p_paid_from = 'wallet' THEN
            INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
            SELECT id, p_owner_id, 'debit', v_fee, 'Shop USSD activation fee',
                   'USSDACT-' || v_shop.id::text, 'purchase', 'completed'
            FROM wallets WHERE user_id = p_owner_id;
        END IF;
    END IF;

    -- Activate. Scope the unique handler to the ussd_code constraint â€” any OTHER
    -- future unique violation must surface (not be retried, re-running the debit).
    BEGIN
        UPDATE shop_profiles
           SET ussd_code         = p_code,
               ussd_active       = true,
               ussd_activated_at = now(),
               updated_at        = now()
         WHERE id = v_shop.id;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint ILIKE '%ussd_code%' THEN
            RAISE EXCEPTION 'CODE_TAKEN';
        ELSE
            RAISE;
        END IF;
    END;

    RETURN jsonb_build_object(
        'success',        true,
        'code',           p_code,
        'already_active', false,
        'amount_paid',    v_fee
    );
END;
$function$
;

-- ===== adjust_shop_pricing_for_role_change (p_user_id uuid, p_old_role text, p_new_role text) =====
CREATE OR REPLACE FUNCTION public.adjust_shop_pricing_for_role_change(p_user_id uuid, p_old_role text, p_new_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_shop_id UUID; v_is_sub BOOLEAN; v_updated_count INTEGER := 0; rec RECORD;
    v_old_cost DECIMAL(12,2); v_new_cost DECIMAL(12,2); v_profit DECIMAL(12,2);
    v_new_price DECIMAL(12,2); v_new_sub DECIMAL(12,2);
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.sub_agents WHERE user_id = p_user_id) INTO v_is_sub;
    IF v_is_sub THEN
        RETURN jsonb_build_object('success', true, 'updated', 0, 'message', 'Sub-agent shop â€” priced off upline wholesale, not repriced on role change');
    END IF;
    SELECT id INTO v_shop_id FROM public.shop_profiles WHERE owner_id = p_user_id LIMIT 1;
    IF v_shop_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'updated', 0, 'message', 'No shop found for this user â€” nothing to adjust');
    END IF;
    FOR rec IN
        SELECT sp.id AS pricing_id, sp.selling_price, sp.sub_price,
               dp.price AS customer_price, dp.agent_price, dp.dealer_price
        FROM public.shop_pricing sp JOIN public.data_packages dp ON dp.id = sp.package_id
        WHERE sp.shop_id = v_shop_id
    LOOP
        v_old_cost := public.effective_owner_cost(rec.customer_price, rec.agent_price, rec.dealer_price, p_old_role);
        v_new_cost := public.effective_owner_cost(rec.customer_price, rec.agent_price, rec.dealer_price, p_new_role);
        IF v_old_cost = v_new_cost THEN CONTINUE; END IF;
        v_profit := rec.selling_price - v_old_cost;
        v_new_price := v_new_cost + v_profit;
        IF v_new_price <= v_new_cost THEN v_new_price := v_new_cost + 0.01; END IF;
        v_new_price := ROUND(v_new_price, 2);
        v_new_sub := rec.sub_price;
        IF v_new_sub IS NOT NULL AND v_new_sub < v_new_cost + 0.01 THEN v_new_sub := ROUND(v_new_cost + 0.01, 2); END IF;
        UPDATE public.shop_pricing SET selling_price = v_new_price, sub_price = v_new_sub WHERE id = rec.pricing_id;
        v_updated_count := v_updated_count + 1;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'updated', v_updated_count,
        'message', format('Adjusted %s pricing rows from %s to %s cost tier', v_updated_count, p_old_role, p_new_role));
END;
$function$
;

-- ===== admin_adjust_wallet (p_user_id uuid, p_delta numeric, p_description text) =====
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user_id uuid, p_delta numeric, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_wallet public.wallets%ROWTYPE;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  END IF;

  IF p_delta < 0 AND v_wallet.balance + p_delta < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE public.wallets
     SET balance        = balance + p_delta,
         total_credited = CASE WHEN p_delta > 0 THEN COALESCE(total_credited, 0) + p_delta ELSE total_credited END,
         total_spent    = CASE WHEN p_delta < 0 THEN COALESCE(total_spent, 0) - p_delta ELSE total_spent END,
         updated_at     = now()
   WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, source, status)
  VALUES (v_wallet.id, p_user_id,
          CASE WHEN p_delta > 0 THEN 'credit' ELSE 'debit' END,
          abs(p_delta),
          COALESCE(p_description, 'Admin manual adjustment'), 'admin', 'completed');

  RETURN jsonb_build_object('ok', true, 'new_balance', v_wallet.balance + p_delta, 'old_balance', v_wallet.balance);
END; $function$
;

-- ===== admin_airtime_stats (p_network text, p_type text, p_start timestamp with time zone, p_end timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.admin_airtime_stats(p_network text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(gross_sales numeric, admin_markup numeric, hubtel_commission numeric, shop_profit numeric, total_volume numeric, pending_value numeric, total_count bigint, airtime_count bigint, mashup_count bigint, pending_count bigint, completed_count bigint, hubtel_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT
        COALESCE(SUM(total_paid)     FILTER (WHERE status = 'completed'), 0) AS gross_sales,
        COALESCE(SUM(
            CASE WHEN admin_fee_amount > 0 THEN admin_fee_amount
                 WHEN shop_id IS NOT NULL  THEN GREATEST(0, fee_amount - shop_fee_amount)
                 ELSE fee_amount END
        ) FILTER (WHERE status = 'completed'), 0) AS admin_markup,
        COALESCE(SUM(NULLIF(fulfillment_metadata->>'commission', '')::numeric)
                 FILTER (WHERE status = 'completed'), 0) AS hubtel_commission,
        COALESCE(SUM(shop_fee_amount) FILTER (WHERE status = 'completed' AND shop_id IS NOT NULL), 0) AS shop_profit,
        COALESCE(SUM(airtime_amount)  FILTER (WHERE status = 'completed'), 0) AS total_volume,
        COALESCE(SUM(total_paid)      FILTER (WHERE status = 'pending'), 0) AS pending_value,
        COUNT(*)                                                          AS total_count,
        COUNT(*) FILTER (WHERE type <> 'mashup')                          AS airtime_count,
        COUNT(*) FILTER (WHERE type = 'mashup')                           AS mashup_count,
        COUNT(*) FILTER (WHERE status = 'pending')                        AS pending_count,
        COUNT(*) FILTER (WHERE status = 'completed')                      AS completed_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND fulfillment_service = 'hubtel-commission') AS hubtel_count
    FROM public.airtime_orders
    WHERE (p_network IS NULL OR network    = p_network)
      AND (p_type    IS NULL OR type       = p_type)
      AND (p_start   IS NULL OR created_at >= p_start)
      AND (p_end     IS NULL OR created_at <= p_end);
$function$
;

-- ===== admin_credit_wallet (p_user_id uuid, p_amount numeric) =====
CREATE OR REPLACE FUNCTION public.admin_credit_wallet(p_user_id uuid, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Credit amount must be greater than zero';
    END IF;

    UPDATE wallets
    SET balance        = balance + p_amount,
        total_credited = COALESCE(total_credited, 0) + p_amount,
        updated_at     = now()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$function$
;

-- ===== admin_payment_stats (from_ts timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.admin_payment_stats(from_ts timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'main', jsonb_build_object(
      'completed_count',  (SELECT count(*)                       FROM wallet_payments WHERE status='completed' AND created_at >= from_ts),
      'completed_amount', (SELECT coalesce(sum(total_amount),0)  FROM wallet_payments WHERE status='completed' AND created_at >= from_ts),
      'pending_count',    (SELECT count(*)                       FROM wallet_payments WHERE status='pending'   AND created_at >= from_ts),
      'pending_amount',   (SELECT coalesce(sum(total_amount),0)  FROM wallet_payments WHERE status='pending'   AND created_at >= from_ts),
      'failed_count',     (SELECT count(*)                       FROM wallet_payments WHERE status='failed'    AND created_at >= from_ts)
    ),
    'shop', jsonb_build_object(
      'completed_count',  (SELECT count(*)                       FROM shop_orders WHERE status IN ('pending','processing','completed') AND created_at >= from_ts),
      'completed_amount', (SELECT coalesce(sum(selling_price),0) FROM shop_orders WHERE status IN ('pending','processing','completed') AND created_at >= from_ts),
      'pending_count',    (SELECT count(*)                       FROM shop_orders WHERE status IN ('pending','processing')             AND created_at >= from_ts),
      'pending_amount',   (SELECT coalesce(sum(selling_price),0) FROM shop_orders WHERE status IN ('pending','processing')             AND created_at >= from_ts),
      'failed_count',     (SELECT count(*)                       FROM shop_orders WHERE status IN ('failed','refunded')                AND created_at >= from_ts)
    ),
    'results_checker', jsonb_build_object(
      'completed_count',  (SELECT count(*)                       FROM results_checker_orders WHERE payment_status='completed'                       AND created_at >= from_ts),
      'completed_amount', (SELECT coalesce(sum(total_paid),0)    FROM results_checker_orders WHERE payment_status='completed'                       AND created_at >= from_ts),
      'pending_count',    (SELECT count(*)                       FROM results_checker_orders WHERE status='pending' AND payment_status='completed'  AND created_at >= from_ts),
      'pending_amount',   (SELECT coalesce(sum(total_paid),0)    FROM results_checker_orders WHERE status='pending' AND payment_status='completed'  AND created_at >= from_ts),
      'failed_count',     (SELECT count(*)                       FROM results_checker_orders WHERE status IN ('failed','refunded')                  AND created_at >= from_ts)
    )
  );
$function$
;

-- ===== admin_search_users (p_term text, p_role text, p_status text, p_limit integer, p_offset integer, p_phone_verified text) =====
CREATE OR REPLACE FUNCTION public.admin_search_users(p_term text DEFAULT NULL::text, p_role text DEFAULT 'all'::text, p_status text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_phone_verified text DEFAULT 'all'::text)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, phone_number text, role text, status text, agent_expires_at timestamp with time zone, dealer_expires_at timestamp with time zone, suspended_until timestamp with time zone, suspension_reason text, phone_verified boolean, created_at timestamp with time zone, updated_at timestamp with time zone, wallet_balance numeric, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select u.*, coalesce(w.balance, 0) as wbal
    from public.users u
    left join public.wallets w on w.user_id = u.id
    where
      ( p_role = 'all'
        or (p_role = 'staff' and u.role in ('admin','sub-admin'))
        or u.role = p_role )
      and ( p_status = 'all'
        or (p_status = 'active'    and u.status = 'active')
        or (p_status = 'suspended' and u.status = 'suspended')
        or (p_status = 'expired'   and (
              (u.role = 'agent'  and u.agent_expires_at  is not null and u.agent_expires_at  <= now())
           or (u.role = 'dealer' and u.dealer_expires_at is not null and u.dealer_expires_at <= now()) )) )
      and ( p_phone_verified = 'all'
        or (p_phone_verified = 'verified'   and u.phone_verified is true)
        or (p_phone_verified = 'unverified' and u.phone_verified is not true) )
      and ( p_term is null or btrim(p_term) = ''
        or ( length(regexp_replace(p_term,'\D','','g')) >= 3 and (
               regexp_replace(coalesce(u.phone_number,''),'\D','','g') ilike '%'||regexp_replace(p_term,'\D','','g')||'%'
               or right(regexp_replace(coalesce(u.phone_number,''),'\D','','g'),9)
                  = right(regexp_replace(p_term,'\D','','g'),9) ) )
        or not exists (
             select 1 from unnest(string_to_array(lower(btrim(p_term)),' ')) as tok
             where tok <> ''
               and lower(coalesce(u.first_name,'')) not like '%'||tok||'%'
               and lower(coalesce(u.last_name,''))  not like '%'||tok||'%'
               and lower(coalesce(u.email,''))      not like '%'||tok||'%' ) )
  )
  select id, email, first_name, last_name, phone_number, role, status,
         agent_expires_at, dealer_expires_at, suspended_until, suspension_reason,
         phone_verified, created_at, updated_at, wbal as wallet_balance,
         count(*) over() as total_count
  from base
  order by created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0)
$function$
;

-- ===== admin_search_users (p_term text, p_role text, p_status text, p_limit integer, p_offset integer) =====
CREATE OR REPLACE FUNCTION public.admin_search_users(p_term text DEFAULT NULL::text, p_role text DEFAULT 'all'::text, p_status text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, phone_number text, role text, status text, agent_expires_at timestamp with time zone, dealer_expires_at timestamp with time zone, suspended_until timestamp with time zone, suspension_reason text, phone_verified boolean, created_at timestamp with time zone, updated_at timestamp with time zone, wallet_balance numeric, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT u.*, COALESCE(w.balance, 0) AS wbal
    FROM public.users u
    LEFT JOIN public.wallets w ON w.user_id = u.id
    WHERE
      ( p_role = 'all'
        OR (p_role = 'staff' AND u.role IN ('admin','sub-admin'))
        OR u.role = p_role )
      AND ( p_status = 'all'
        OR (p_status = 'active'    AND u.status = 'active')
        OR (p_status = 'suspended' AND u.status = 'suspended')
        OR (p_status = 'expired'   AND (
              (u.role = 'agent'  AND u.agent_expires_at  IS NOT NULL AND u.agent_expires_at  <= now())
           OR (u.role = 'dealer' AND u.dealer_expires_at IS NOT NULL AND u.dealer_expires_at <= now()) )) )
      AND ( p_term IS NULL OR btrim(p_term) = ''
        OR ( length(regexp_replace(p_term,'\D','','g')) >= 3 AND (
               regexp_replace(COALESCE(u.phone_number,''),'\D','','g') ILIKE '%'||regexp_replace(p_term,'\D','','g')||'%'
               OR right(regexp_replace(COALESCE(u.phone_number,''),'\D','','g'),9)
                  = right(regexp_replace(p_term,'\D','','g'),9) ) )
        OR NOT EXISTS (
             SELECT 1 FROM unnest(string_to_array(lower(btrim(p_term)),' ')) AS tok
             WHERE tok <> ''
               AND lower(COALESCE(u.first_name,'')) NOT LIKE '%'||tok||'%'
               AND lower(COALESCE(u.last_name,''))  NOT LIKE '%'||tok||'%'
               AND lower(COALESCE(u.email,''))      NOT LIKE '%'||tok||'%' ) )
  )
  SELECT id, email, first_name, last_name, phone_number, role, status,
         agent_expires_at, dealer_expires_at, suspended_until, suspension_reason,
         phone_verified, created_at, updated_at, wbal AS wallet_balance,
         count(*) OVER() AS total_count
  FROM base
  ORDER BY created_at DESC
  LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
$function$
;

-- ===== admin_update_subagent_contact (p_user_id uuid, p_new_email text, p_new_phone text) =====
CREATE OR REPLACE FUNCTION public.admin_update_subagent_contact(p_user_id uuid, p_new_email text, p_new_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.subagent_contact_override', 'true', true);
  UPDATE public.users
  SET email = COALESCE(p_new_email, email),
      phone_number = COALESCE(p_new_phone, phone_number)
  WHERE id = p_user_id;
END;
$function$
;

-- ===== admin_user_stats () =====
CREATE OR REPLACE FUNCTION public.admin_user_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'total',           count(*),
    'customers',       count(*) filter (where role = 'customer'),
    'agents',          count(*) filter (where role = 'agent'),
    'active_agents',   count(*) filter (where role = 'agent'  and (agent_expires_at  is null or agent_expires_at  > now())),
    'expired_agents',  count(*) filter (where role = 'agent'  and agent_expires_at  is not null and agent_expires_at  <= now()),
    'dealers',         count(*) filter (where role = 'dealer'),
    'active_dealers',  count(*) filter (where role = 'dealer' and (dealer_expires_at is null or dealer_expires_at > now())),
    'expired_dealers', count(*) filter (where role = 'dealer' and dealer_expires_at is not null and dealer_expires_at <= now()),
    'staff',           count(*) filter (where role in ('admin','sub-admin')),
    'subagents',       count(*) filter (where role = 'subagent'),
    'suspended',       count(*) filter (where status = 'suspended'),
    'expired',         count(*) filter (where
                          (role = 'agent'  and agent_expires_at  is not null and agent_expires_at  <= now())
                       or (role = 'dealer' and dealer_expires_at is not null and dealer_expires_at <= now())),
    'verified',        count(*) filter (where phone_verified is true),
    'unverified',      count(*) filter (where phone_verified is not true)
  ) from public.users
$function$
;

-- ===== apply_shop_sms_delivery_report (p_provider_message_id text, p_status text, p_detail text) =====
CREATE OR REPLACE FUNCTION public.apply_shop_sms_delivery_report(p_provider_message_id text, p_status text, p_detail text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt shop_sms_delivery_receipts;
BEGIN
  UPDATE shop_sms_delivery_receipts
  SET status = p_status, updated_at = now()
  WHERE provider_message_id = p_provider_message_id
    AND status = 'sent'
  RETURNING * INTO v_receipt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('updated', false);
  END IF;

  UPDATE shop_sms_logs
  SET pending_count = GREATEST(pending_count - 1, 0),
      delivered_count = delivered_count
        + CASE WHEN p_status = 'delivered' THEN 1 ELSE 0 END,
      undelivered_count = undelivered_count
        + CASE WHEN p_status IN ('undelivered','rejected','expired') THEN 1 ELSE 0 END
  WHERE id = v_receipt.log_id;

  RETURN jsonb_build_object('updated', true);
END;
$function$
;

-- ===== apply_sms_delivery_report (p_provider_message_id text, p_status text, p_detail text) =====
CREATE OR REPLACE FUNCTION public.apply_sms_delivery_report(p_provider_message_id text, p_status text, p_detail text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_row RECORD;
BEGIN
    -- SECURITY (audit H-1): 'failed' is a SEND-TIME provider rejection written
    -- only by bulk_update_sms_message_status, and settle_sms_campaign refunds
    -- exactly the 'failed' rows. A DLR callback must NEVER be able to mint a
    -- 'failed' row (that would refund an already-sent message), so it is
    -- excluded here regardless of what the caller maps â€” the DB contract holds
    -- even if an app-layer mapping regresses.
    IF p_status NOT IN ('delivered', 'undelivered', 'expired', 'rejected') THEN
        RAISE EXCEPTION 'INVALID_STATUS';
    END IF;

    UPDATE sms_messages
    SET status = p_status,
        status_detail = COALESCE(p_detail, status_detail),
        status_updated_at = now()
    WHERE provider_message_id = p_provider_message_id
      AND status IN ('queued', 'sent')
    RETURNING id, campaign_id, account_id INTO v_row;

    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('updated', false);
    END IF;

    RETURN jsonb_build_object('updated', true,
        'message_id', v_row.id, 'campaign_id', v_row.campaign_id,
        'account_id', v_row.account_id);
END;
$function$
;

-- ===== apply_sub_agent_earning_sync (p_order_reference text, p_new_status text, p_order_table text) =====
CREATE OR REPLACE FUNCTION public.apply_sub_agent_earning_sync(p_order_reference text, p_new_status text, p_order_table text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_earning public.sub_agent_order_earnings%ROWTYPE;
  v_wallet_id UUID;
  v_tx_id UUID;
BEGIN
  IF p_order_reference IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_earning FROM public.sub_agent_order_earnings
    WHERE order_reference = p_order_reference AND order_table = p_order_table FOR UPDATE;

  IF NOT FOUND THEN
    -- No pending earning for this order (not a sub's order, or a zero-markup
    -- product per spec C9) â€” nothing to do.
    RETURN;
  END IF;

  IF p_new_status = 'completed' AND v_earning.status = 'pending' THEN
    -- Single race-free upsert: under concurrent first-ever credits for the
    -- same recruiter, a separate INSERT...ON CONFLICT DO NOTHING followed by
    -- a SELECT can race (a concurrent uncommitted insert makes the INSERT a
    -- no-op while also being invisible to the SELECT, yielding NULL and a
    -- NOT NULL violation downstream). DO UPDATE forces this statement to
    -- return the row's id either way.
    INSERT INTO public.commission_wallets (owner_id, balance, total_earned)
      VALUES (v_earning.recruiter_id, 0, 0)
      ON CONFLICT (owner_id) DO UPDATE SET owner_id = EXCLUDED.owner_id
      RETURNING id INTO v_wallet_id;

    INSERT INTO public.commission_wallet_transactions
      (commission_wallet_id, type, amount, description, status, order_reference, order_table)
    VALUES
      (v_wallet_id, 'sub_agent_margin', v_earning.amount,
       'Sub-agent order completed', 'completed', v_earning.order_reference, v_earning.order_table)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NULL THEN
      -- Already recorded by a concurrent/replayed call â€” balance already
      -- reflects it. Do not move the balance again; do not update the
      -- ledger status again (it was already moved by whichever call
      -- actually inserted the row).
      RETURN;
    END IF;

    UPDATE public.commission_wallets
      SET balance = balance + v_earning.amount, total_earned = total_earned + v_earning.amount, updated_at = NOW()
      WHERE id = v_wallet_id;

    UPDATE public.sub_agent_order_earnings
      SET status = 'credited', credited_at = NOW()
      WHERE id = v_earning.id;

  -- DELIBERATE: this branch only fires when v_earning.status = 'credited'.
  -- A row that reverses here becomes 'reversed', not 'pending' â€” so if the
  -- order's status later flips back to 'completed' again, the credit branch
  -- above (which requires v_earning.status = 'pending') will NOT re-fire and
  -- the earning will NOT auto re-credit. This is intentional: re-crediting
  -- after a reversal needs a human decision, not an automatic bounce-back.
  -- Do not "fix" this into a bounce-back without a deliberate product call.
  ELSIF p_new_status <> 'completed' AND v_earning.status = 'credited' THEN
    SELECT id INTO v_wallet_id FROM public.commission_wallets
      WHERE owner_id = v_earning.recruiter_id FOR UPDATE;

    -- Defensive only: a 'credited' earning implies the wallet already exists
    -- (created by the credit branch above), so this should be unreachable
    -- in practice. Guards against an AFTER UPDATE trigger raising on the
    -- NOT NULL commission_wallet_id below and aborting the order's own
    -- status change (e.g. blocking an admin's refund with an opaque error).
    IF v_wallet_id IS NULL THEN
      RETURN;
    END IF;

    INSERT INTO public.commission_wallet_transactions
      (commission_wallet_id, type, amount, description, status, order_reference, order_table)
    VALUES
      (v_wallet_id, 'sub_agent_margin_reversal', v_earning.amount,
       'Sub-agent order status changed after completion', 'completed', v_earning.order_reference, v_earning.order_table)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NULL THEN
      -- Already recorded by a concurrent/replayed call â€” balance already
      -- reflects it. Do not move the balance again; do not update the
      -- ledger status again (it was already moved by whichever call
      -- actually inserted the row).
      RETURN;
    END IF;

    -- DELIBERATE ASYMMETRY: only `balance` moves here, not `total_earned`
    -- (contrast the credit branch above, which updates both). `total_earned`
    -- is lifetime gross earnings and must not be reduced by a later reversal;
    -- only the current spendable `balance` does. Do not add total_earned
    -- here to "mirror" the credit branch â€” that would misrepresent history.
    UPDATE public.commission_wallets
      SET balance = balance - v_earning.amount, updated_at = NOW()
      WHERE id = v_wallet_id;

    UPDATE public.sub_agent_order_earnings
      SET status = 'reversed', reversed_at = NOW()
      WHERE id = v_earning.id;
  END IF;
END;
$function$
;

-- ===== assign_results_checker_vouchers (p_type_id uuid, p_quantity integer, p_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.assign_results_checker_vouchers(p_type_id uuid, p_quantity integer, p_order_id uuid)
 RETURNS TABLE(id uuid, pin text, serial_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_timeout_minutes INTEGER := 10;
  v_timeout_setting TEXT;
  v_reserved_count  INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  IF EXISTS (
    SELECT 1 FROM public.results_checker_inventory
    WHERE reserved_by_order = p_order_id AND status IN ('reserved', 'sold')
  ) THEN
    RETURN QUERY
    SELECT inv.id, inv.pin, inv.serial_number
    FROM public.results_checker_inventory inv
    WHERE inv.reserved_by_order = p_order_id
      AND inv.status IN ('reserved', 'sold')
    ORDER BY inv.created_at ASC;
    RETURN;
  END IF;

  SELECT value INTO v_timeout_setting
  FROM public.admin_settings
  WHERE key = 'results_checker_reservation_timeout';
  IF v_timeout_setting IS NOT NULL THEN
    v_timeout_minutes := v_timeout_setting::INTEGER;
  END IF;

  UPDATE public.results_checker_inventory inv
  SET
    status                 = 'reserved',
    reserved_by_order      = p_order_id,
    reservation_expires_at = NOW() + (v_timeout_minutes || ' minutes')::INTERVAL,
    updated_at             = NOW()
  WHERE inv.id IN (
    SELECT sub.id
    FROM public.results_checker_inventory sub
    WHERE sub.type_id = p_type_id
      AND sub.status  = 'available'
    ORDER BY sub.created_at ASC
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  );
  GET DIAGNOSTICS v_reserved_count = ROW_COUNT;

  IF v_reserved_count < p_quantity THEN
    UPDATE public.results_checker_inventory
    SET status = 'available', reserved_by_order = NULL, reservation_expires_at = NULL, updated_at = NOW()
    WHERE reserved_by_order = p_order_id;
    RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';
  END IF;

  RETURN QUERY
  SELECT inv.id, inv.pin, inv.serial_number
  FROM public.results_checker_inventory inv
  WHERE inv.reserved_by_order = p_order_id
    AND inv.type_id           = p_type_id
    AND inv.status            = 'reserved';
END;
$function$
;

-- ===== auto_update_shop_pricing_on_platform_cost () =====
CREATE OR REPLACE FUNCTION public.auto_update_shop_pricing_on_platform_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NEW.price <= 0 THEN RAISE EXCEPTION 'Invalid platform price detected'; END IF;
    IF NEW.price IS NOT DISTINCT FROM OLD.price
       AND NEW.agent_price IS NOT DISTINCT FROM OLD.agent_price
       AND NEW.dealer_price IS NOT DISTINCT FROM OLD.dealer_price THEN
        RETURN NEW;
    END IF;
    BEGIN
        PERFORM set_config('app.system_pricing_update', 'true', true);
        WITH updated_pricing AS (
            SELECT sp.id, sp.shop_id, sp.package_id,
                public.effective_owner_cost(OLD.price, OLD.agent_price, OLD.dealer_price, u.role) AS old_cost,
                sp.selling_price AS old_selling,
                public.effective_owner_cost(NEW.price, NEW.agent_price, NEW.dealer_price, u.role) AS new_cost,
                public.effective_owner_cost(NEW.price, NEW.agent_price, NEW.dealer_price, u.role) + GREATEST(sp.profit_margin, 0.01) AS new_selling,
                sp.sub_price AS old_sub_price
            FROM public.shop_pricing sp
            JOIN public.shop_profiles spf ON sp.shop_id = spf.id
            JOIN public.users u ON u.id = spf.owner_id
            WHERE sp.package_id = NEW.id
              AND NOT EXISTS (SELECT 1 FROM public.sub_agents sa WHERE sa.user_id = spf.owner_id)
        ),
        applied_update AS (
            UPDATE public.shop_pricing sp
            SET selling_price = up.new_selling,
                sub_price = CASE WHEN up.old_sub_price IS NULL THEN NULL
                    ELSE ROUND(GREATEST(up.new_cost + (up.old_sub_price - up.old_cost), up.new_cost + 0.01), 2) END,
                last_auto_updated_at = NOW()
            FROM updated_pricing up WHERE sp.id = up.id
            RETURNING up.*
        )
        INSERT INTO public.shop_pricing_logs (shop_id, package_id, old_cost_price, new_cost_price, old_selling_price, new_selling_price, changed_at)
        SELECT shop_id, package_id, old_cost, new_cost, old_selling, new_selling, NOW() FROM applied_update;
        PERFORM set_config('app.system_pricing_update', 'false', true);
        RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('app.system_pricing_update', 'false', true);
        RAISE;
    END;
END;
$function$
;

-- ===== block_client_money_writes () =====
CREATE OR REPLACE FUNCTION public.block_client_money_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'SECURITY: % can only be written by the server', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(NEW, OLD);
END $function$
;

-- ===== bulk_update_sms_message_status (p_updates jsonb) =====
CREATE OR REPLACE FUNCTION public.bulk_update_sms_message_status(p_updates jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD';
    END IF;

    UPDATE sms_messages m
    SET status              = u.status,
        provider_message_id = COALESCE(u.provider_message_id, m.provider_message_id),
        network_id          = COALESCE(u.network_id, m.network_id),
        rate                = COALESCE(u.rate, m.rate),
        status_detail       = COALESCE(u.detail, m.status_detail),
        status_updated_at   = now()
    FROM jsonb_to_recordset(p_updates) AS u(
        id UUID, status TEXT, provider_message_id TEXT,
        network_id TEXT, rate NUMERIC, detail TEXT
    )
    WHERE m.id = u.id
      AND u.status IN ('sent', 'failed')
      AND m.status = 'queued';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$
;

-- ===== bump_otp_attempts (p_id uuid) =====
CREATE OR REPLACE FUNCTION public.bump_otp_attempts(p_id uuid)
 RETURNS TABLE(attempts integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.phone_otp_verifications
     SET attempts = COALESCE(phone_otp_verifications.attempts, 0) + 1
   WHERE id = p_id AND used = false
   RETURNING phone_otp_verifications.attempts;
$function$
;

-- ===== bump_support_thread_last_message () =====
CREATE OR REPLACE FUNCTION public.bump_support_thread_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.support_threads
  SET last_message_at = NEW.created_at,
      updated_at      = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$function$
;

-- ===== cancel_sms_campaign (p_campaign_id uuid, p_account_id uuid) =====
CREATE OR REPLACE FUNCTION public.cancel_sms_campaign(p_campaign_id uuid, p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_camp   RECORD;
    v_credit JSONB;
BEGIN
    UPDATE sms_campaigns
    SET status = 'cancelled', settled_at = now()
    WHERE id = p_campaign_id AND account_id = p_account_id AND status = 'queued'
    RETURNING * INTO v_camp;

    IF v_camp.id IS NULL THEN
        RETURN jsonb_build_object('cancelled', false, 'reason', 'NOT_CANCELLABLE');
    END IF;

    UPDATE sms_messages
    SET status = 'failed', status_detail = 'campaign cancelled', status_updated_at = now()
    WHERE campaign_id = p_campaign_id AND status = 'queued';

    IF v_camp.credits_charged > 0 THEN
        v_credit := credit_user_sms_credits(
            p_account_id, v_camp.credits_charged,
            'refund:' || p_campaign_id::text, 'refund', p_campaign_id::text);
    END IF;

    RETURN jsonb_build_object('cancelled', true,
        'refunded_credits', COALESCE(v_camp.credits_charged, 0));
END;
$function$
;

-- ===== cascade_lead_suspend () =====
CREATE OR REPLACE FUNCTION public.cascade_lead_suspend()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approval_status = 'suspended' AND OLD.approval_status IS DISTINCT FROM 'suspended' THEN
    UPDATE public.shop_profiles sp
    SET is_active = false, updated_at = now()
    FROM public.sub_agents sa
    WHERE sa.upline_shop_id = NEW.id
      AND sp.owner_id = sa.user_id
      AND sp.is_active = true;
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== claim_hubtel_receive_paid (p_reference text) =====
CREATE OR REPLACE FUNCTION public.claim_hubtel_receive_paid(p_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row record;
BEGIN
  UPDATE public.hubtel_receive_charges
     SET status='paid', paid_at=now()
   WHERE reference_code=p_reference AND status='pending'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.hubtel_receive_charges WHERE reference_code=p_reference;
    IF NOT FOUND THEN RETURN jsonb_build_object('claimed',false,'error','not_found'); END IF;
    RETURN jsonb_build_object('claimed',false,'already',v_row.status);
  END IF;
  RETURN jsonb_build_object('claimed',true,'service_type',v_row.service_type,'order_id',v_row.order_id);
END $function$
;

-- ===== claim_momo_transaction (p_transaction_id text, p_user_id uuid, p_is_auto boolean, p_ref_code text) =====
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
    v_description      TEXT;
BEGIN
    -- 1. Get user role
    SELECT role INTO v_user_role
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

    -- 5. Determine which fee key to use based on user role
    IF v_user_role = 'agent' THEN
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
        v_description := 'Auto-Claim via Ref ' || p_ref_code || ' â€” ' || v_txn.sender_network || ' â€” TXN: ' || p_transaction_id;
    ELSE
        v_description := 'MoMo Claim â€” ' || v_txn.sender_network || ' â€” TXN: ' || p_transaction_id;
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
$function$
;

-- ===== claim_order_retry (p_order_id uuid, p_actor_id uuid, p_actor_role text, p_charge_amount numeric, p_reference_code text, p_cost_price numeric) =====
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
      codecraft_reference = NULL,
      dakazina_reference = NULL,
      dakazina_order_code = NULL,
      ghdata_order_id = NULL,
      bundleportal_reference = NULL,
      hendylinks_order_id = NULL,
      atishare_console_reference = NULL,
      atishare_console_transaction_id = NULL,
      spfastit_reference = NULL,
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
$function$
;

-- ===== claim_self_order_complete (p_order_id uuid, p_actor_id uuid) =====
CREATE OR REPLACE FUNCTION public.claim_self_order_complete(p_order_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_o public.orders%ROWTYPE;
  v_role text;
BEGIN
  SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_o.user_id = p_actor_id THEN
    v_role := 'customer';
  ELSIF v_o.shop_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shop_orders so
    JOIN public.shop_profiles sp ON sp.id = so.shop_id
    WHERE so.id = v_o.shop_order_id AND sp.owner_id = p_actor_id
  ) THEN
    v_role := 'shop_owner';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  IF v_o.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true);
  END IF;

  IF v_o.status <> 'processing' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_eligible', 'status', v_o.status);
  END IF;

  UPDATE public.orders SET
    status = 'completed',
    self_completed_at = now(),
    self_completed_by = p_actor_id,
    self_completed_by_role = v_role,
    updated_at = now()
  WHERE id = p_order_id;

  -- Keep shop_orders in sync so the profit-audit trigger (trg_log_shop_profit,
  -- AFTER UPDATE ON shop_orders) fires for self-completed shop orders, matching
  -- every other completion path (syncShopOrderStatus / shop-order-processor.ts).
  -- Guard against clobbering a refunded shop_orders row (defensive; a refunded
  -- shop_orders row shouldn't exist for a still-'processing' orders row in
  -- practice, but avoid overwriting a terminal refunded state if it ever does).
  IF v_o.shop_order_id IS NOT NULL THEN
    UPDATE public.shop_orders SET status = 'completed', updated_at = now()
    WHERE id = v_o.shop_order_id AND status <> 'refunded';
  END IF;

  RETURN jsonb_build_object('ok', true, 'role', v_role);
END;
$function$
;

-- ===== claim_sms_campaigns (p_limit integer, p_stale_minutes integer) =====
CREATE OR REPLACE FUNCTION public.claim_sms_campaigns(p_limit integer DEFAULT 3, p_stale_minutes integer DEFAULT 10)
 RETURNS SETOF sms_campaigns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    UPDATE sms_campaigns c
    SET status = 'processing', claimed_at = now()
    WHERE c.id IN (
        SELECT id FROM sms_campaigns
        WHERE (status = 'queued' AND (scheduled_at IS NULL OR scheduled_at <= now()))
           OR (status = 'processing' AND claimed_at < now() - make_interval(mins => p_stale_minutes))
        ORDER BY created_at
        LIMIT GREATEST(1, LEAST(p_limit, 10))
        FOR UPDATE SKIP LOCKED
    )
    RETURNING c.*;
END;
$function$
;

-- ===== claim_sms_welcome_bonus (p_shop_id uuid) =====
CREATE OR REPLACE FUNCTION public.claim_sms_welcome_bonus(p_shop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_credits_text  TEXT;
    v_credits       INTEGER;
BEGIN
    -- Read admin-configured credit count; default 10, cap at 500
    SELECT value INTO v_credits_text
    FROM shop_global_settings
    WHERE key = 'sms_welcome_bonus_credits';

    BEGIN
        v_credits := v_credits_text::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_credits := 10;
    END;

    IF v_credits IS NULL OR v_credits <= 0 OR v_credits > 500 THEN
        v_credits := 10;
    END IF;

    -- Mark bonus claimed (UPDATE returns 0 rows if already claimed â†’ raise)
    UPDATE shop_sms_activations
    SET bonus_claimed    = true,
        bonus_claimed_at = now()
    WHERE shop_id = p_shop_id
      AND bonus_claimed = false;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ALREADY_CLAIMED';
    END IF;

    -- Credit the SMS wallet atomically
    INSERT INTO shop_sms_wallets (shop_id, credits, total_purchased, total_used)
    VALUES (p_shop_id, v_credits, v_credits, 0)
    ON CONFLICT (shop_id) DO UPDATE
    SET credits         = shop_sms_wallets.credits         + v_credits,
        total_purchased = shop_sms_wallets.total_purchased + v_credits,
        updated_at      = now();

    RETURN jsonb_build_object('success', true, 'credits_added', v_credits);
END;
$function$
;

-- ===== claim_ussd_callback_retry (p_id uuid, p_stale_after_seconds integer) =====
CREATE OR REPLACE FUNCTION public.claim_ussd_callback_retry(p_id uuid, p_stale_after_seconds integer DEFAULT 300)
 RETURNS ussd_callback_retry_queue
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
    v_row ussd_callback_retry_queue;
begin
    update ussd_callback_retry_queue
    set attempts = attempts + 1,
        last_attempt_at = now(),
        claimed_at = now()
    where id = p_id
      and resolved = false
      and escalated = false
      and (claimed_at is null or claimed_at < now() - make_interval(secs => p_stale_after_seconds))
    returning * into v_row;
    return v_row;
end;
$function$
;

-- ===== create_sms_campaign (p_campaign_id uuid, p_user_id uuid, p_message text, p_recipients_count integer, p_segments integer, p_credits integer, p_mode text, p_sender text, p_source text, p_scheduled_at timestamp with time zone, p_claim_now boolean, p_blocked boolean, p_flagged boolean, p_flag_reason text, p_flag_severity text) =====
CREATE OR REPLACE FUNCTION public.create_sms_campaign(p_campaign_id uuid, p_user_id uuid, p_message text, p_recipients_count integer, p_segments integer, p_credits integer, p_mode text, p_sender text, p_source text DEFAULT 'dashboard'::text, p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_claim_now boolean DEFAULT false, p_blocked boolean DEFAULT false, p_flagged boolean DEFAULT false, p_flag_reason text DEFAULT NULL::text, p_flag_severity text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_acct      RECORD;
    v_role      TEXT;
    v_allowed   JSONB;
    v_ledger_id UUID;
    v_balance   INTEGER;
    v_status    TEXT;
BEGIN
    SELECT a.* INTO v_acct FROM sms_accounts a WHERE a.user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
    END IF;
    IF v_acct.status <> 'active' THEN
        RAISE EXCEPTION 'ACCOUNT_SUSPENDED';
    END IF;
    IF p_mode NOT IN ('platform', 'business') OR p_mode <> v_acct.mode THEN
        RAISE EXCEPTION 'MODE_MISMATCH';
    END IF;

    -- Role allowlist re-checked atomically (admin may narrow roles at any time).
    SELECT u.role INTO v_role FROM users u WHERE u.id = p_user_id AND u.status = 'active';
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE';
    END IF;
    SELECT value INTO v_allowed FROM admin_settings WHERE key = 'user_sms_allowed_roles';
    IF v_allowed IS NULL OR jsonb_typeof(v_allowed) <> 'array'
       OR NOT (v_allowed ? v_role) THEN
        RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
    END IF;

    -- Blocked attempt: audit row only, no money movement.
    IF p_blocked THEN
        INSERT INTO sms_campaigns (id, account_id, sender_used, mode_at_send, message,
            recipients_count, segments, credits_charged, status, flagged, flag_reason,
            flag_severity, source)
        VALUES (p_campaign_id, v_acct.id, NULL, p_mode, p_message,
            p_recipients_count, p_segments, 0, 'blocked', true, p_flag_reason,
            COALESCE(p_flag_severity, 'fraud'), p_source);
        RETURN jsonb_build_object('blocked', true, 'campaign_id', p_campaign_id);
    END IF;

    IF p_credits IS NULL OR p_credits <= 0 OR p_recipients_count <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;
    IF p_sender IS NULL OR length(trim(p_sender)) = 0 THEN
        -- Never fall through to an implicit provider default sender.
        RAISE EXCEPTION 'SENDER_REQUIRED';
    END IF;

    -- Reserve the debit ledger key (client retry with same UUID = no-op).
    INSERT INTO sms_credit_ledger (account_id, delta, kind, idempotency_key, reference)
    VALUES (v_acct.id, -p_credits, 'debit', 'debit:' || p_campaign_id::text, p_campaign_id::text)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;

    IF v_ledger_id IS NULL THEN
        RETURN jsonb_build_object('already_processed', true, 'campaign_id', p_campaign_id);
    END IF;

    -- Atomic compare-and-decrement (CHECK credits >= 0 backstops).
    UPDATE sms_wallets
    SET credits = credits - p_credits,
        total_used = total_used + p_credits,
        updated_at = now()
    WHERE account_id = v_acct.id AND credits >= p_credits
    RETURNING credits INTO v_balance;
    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;

    UPDATE sms_credit_ledger SET balance_after = v_balance WHERE id = v_ledger_id;

    v_status := CASE WHEN p_claim_now THEN 'processing' ELSE 'queued' END;

    INSERT INTO sms_campaigns (id, account_id, sender_used, mode_at_send, message,
        recipients_count, segments, credits_charged, status, flagged, flag_reason,
        flag_severity, scheduled_at, claimed_at, source)
    VALUES (p_campaign_id, v_acct.id, trim(p_sender), p_mode, p_message,
        p_recipients_count, p_segments, p_credits, v_status, p_flagged, p_flag_reason,
        p_flag_severity, p_scheduled_at,
        CASE WHEN p_claim_now THEN now() ELSE NULL END, p_source);

    RETURN jsonb_build_object(
        'already_processed', false,
        'campaign_id', p_campaign_id,
        'account_id', v_acct.id,
        'status', v_status,
        'balance', v_balance
    );
END;
$function$
;

-- ===== credit_airtime_commission (p_airtime_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.credit_airtime_commission(p_airtime_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record; v_pct numeric; v_share numeric; v_wallet_id uuid;
  v_role text; v_agent_expires_at timestamptz; v_eligible boolean;
BEGIN
  UPDATE public.airtime_orders
     SET commission_credited_at = now()
   WHERE id = p_airtime_order_id
     AND status = 'completed'
     AND commission_amount IS NOT NULL
     AND commission_credited_at IS NULL
     AND source = 'api'
  RETURNING * INTO v_order;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Nothing to credit (already credited, not completed, no commission, or not an API order)');
  END IF;

  IF v_order.user_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'No developer/buyer to credit');
  END IF;

  SELECT role, agent_expires_at
    INTO v_role, v_agent_expires_at
    FROM public.users WHERE id = v_order.user_id;

  -- Lifetime-only gate: dealer passes unconditionally (dealer_expires_at is
  -- never NULL in practice â€” a dealer always eventually converts to lifetime
  -- agent on expiry, see lib/effective-role.ts); agent requires a NULL
  -- agent_expires_at (lifetime agent).
  --
  -- NULL-SAFE and FAIL-CLOSED: IS NOT DISTINCT FROM never returns NULL, so an
  -- unknown/NULL role is denied, not paid (mirrors credit_commission_wallet's
  -- IS DISTINCT FROM fix in 20260903d_commission_eligibility_security_fixes.sql).
  v_eligible := (v_role IS NOT DISTINCT FROM 'dealer')
    OR (v_role IS NOT DISTINCT FROM 'agent' AND v_agent_expires_at IS NULL);
  IF NOT v_eligible THEN
    RETURN jsonb_build_object('success', true, 'message', 'Buyer not a lifetime agent/dealer â€” platform keeps full commission');
  END IF;

  SELECT COALESCE(NULLIF(trim(both '"' from value::text), '')::numeric, 40)
    INTO v_pct FROM public.admin_settings WHERE key = 'utility_commission_partner_percent';
  v_pct := LEAST(GREATEST(COALESCE(v_pct, 40), 0), 100);
  v_share := round(v_order.commission_amount * v_pct / 100.0, 4);
  IF v_share <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Share rounds to zero');
  END IF;

  INSERT INTO public.commission_wallets (owner_id, balance, total_earned) VALUES (v_order.user_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.commission_wallets WHERE owner_id = v_order.user_id FOR UPDATE;
  UPDATE public.commission_wallets
     SET balance = balance + v_share, total_earned = total_earned + v_share, updated_at = now()
   WHERE id = v_wallet_id;
  INSERT INTO public.commission_wallet_transactions
    (commission_wallet_id, airtime_order_id, type, amount, description, status)
  VALUES (v_wallet_id, p_airtime_order_id, 'commission', v_share,
          'Airtime commission: ' || v_order.network || ' ' || v_order.beneficiary_phone, 'completed');
  UPDATE public.airtime_orders SET partner_commission_amount = v_share WHERE id = p_airtime_order_id;
  RETURN jsonb_build_object('success', true, 'amount', v_share);
EXCEPTION WHEN unique_violation THEN
  UPDATE public.airtime_orders SET commission_credited_at = now() WHERE id = p_airtime_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Already credited (ledger unique)');
END $function$
;

-- ===== credit_commission_wallet (p_utility_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.credit_commission_wallet(p_utility_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record; v_pct numeric; v_share numeric; v_wallet_id uuid; v_role text;
BEGIN
  UPDATE public.utility_orders
     SET commission_credited_at = now()
   WHERE id = p_utility_order_id
     AND status = 'completed'
     AND commission_amount IS NOT NULL
     AND commission_credited_at IS NULL
     AND source IN ('api', 'dashboard')
  RETURNING * INTO v_order;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Nothing to credit (already credited, not completed, no commission, or not an eligible source)');
  END IF;

  IF v_order.user_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'No developer/buyer to credit');
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_order.user_id;
  -- NULL-SAFE and FAIL-CLOSED: a plain `v_role NOT IN (...)` yields NULL when v_role is
  -- NULL (nullable column, or no matching users row), and PL/pgSQL treats a NULL IF
  -- condition as false â€” which would fall THROUGH and pay commission to an unverified
  -- role. IS DISTINCT FROM is null-safe, so an unknown role is denied, not paid.
  IF v_role IS DISTINCT FROM 'agent' AND v_role IS DISTINCT FROM 'dealer' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Buyer role not eligible for commission â€” platform keeps full commission');
  END IF;

  SELECT COALESCE(NULLIF(trim(both '"' from value::text), '')::numeric, 40)
    INTO v_pct FROM public.admin_settings WHERE key = 'utility_commission_partner_percent';
  v_pct := LEAST(GREATEST(COALESCE(v_pct, 40), 0), 100);
  v_share := round(v_order.commission_amount * v_pct / 100.0, 4);
  IF v_share <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Share rounds to zero');
  END IF;

  INSERT INTO public.commission_wallets (owner_id, balance, total_earned) VALUES (v_order.user_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.commission_wallets WHERE owner_id = v_order.user_id FOR UPDATE;
  UPDATE public.commission_wallets
     SET balance = balance + v_share, total_earned = total_earned + v_share, updated_at = now()
   WHERE id = v_wallet_id;
  INSERT INTO public.commission_wallet_transactions
    (commission_wallet_id, utility_order_id, type, amount, description, status)
  VALUES (v_wallet_id, p_utility_order_id, 'commission', v_share,
          'Commission: ' || v_order.biller || ' ' || v_order.account_number, 'completed');
  UPDATE public.utility_orders SET partner_commission_amount = v_share WHERE id = p_utility_order_id;
  RETURN jsonb_build_object('success', true, 'amount', v_share);
EXCEPTION WHEN unique_violation THEN
  UPDATE public.utility_orders SET commission_credited_at = now() WHERE id = p_utility_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Already credited (ledger unique)');
END $function$
;

-- ===== credit_lead_margin (p_order_reference text, p_upline_shop_id uuid, p_amount numeric, p_description text) =====
CREATE OR REPLACE FUNCTION public.credit_lead_margin(p_order_reference text, p_upline_shop_id uuid, p_amount numeric, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id  UUID;
  v_wallet_id UUID;
BEGIN
  IF p_order_reference IS NULL OR length(p_order_reference) = 0 OR length(p_order_reference) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid reference');
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No margin to credit');
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.shop_profiles WHERE id = p_upline_shop_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Upline shop not found');
  END IF;

  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM public.shop_wallets WHERE owner_id = v_owner_id FOR UPDATE;

  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, type, amount, description, status, credit_source, order_reference)
  VALUES
    (v_wallet_id, 'profit', p_amount,
     COALESCE(p_description, 'Sub-agent wallet purchase margin'),
     'completed', 'wallet_sub_purchase', p_order_reference);

  UPDATE public.shop_wallets
  SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id;

  RETURN jsonb_build_object('success', true, 'message', 'Credited ' || p_amount);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== credit_shop_afa_profit (p_afa_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.credit_shop_afa_profit(p_afa_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profit DECIMAL;
  v_owner_id UUID;
  v_wallet_id UUID;
  v_guest_phone TEXT;
  v_existing_tx_id UUID;
BEGIN
  SELECT
    ao.profit,
    sp.owner_id,
    ao.guest_phone
  INTO
    v_profit,
    v_owner_id,
    v_guest_phone
  FROM public.afa_orders ao
  JOIN public.shop_profiles sp ON ao.shop_id = sp.id
  WHERE ao.id = p_afa_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_profit <= 0 OR v_profit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No profit to credit');
  END IF;

  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  -- Lock BEFORE checking idempotency â€” same rule as credit_shop_profit, prevents
  -- two concurrent callers (e.g. a retried admin click) from both passing the check.
  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id
  FOR UPDATE;

  SELECT id INTO v_existing_tx_id
  FROM public.shop_wallet_transactions
  WHERE afa_order_id = p_afa_order_id AND type = 'profit';

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  END IF;

  UPDATE public.shop_wallets
  SET
    balance = balance + v_profit,
    total_earned = total_earned + v_profit,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, afa_order_id, type, amount, description, status)
  VALUES
    (v_wallet_id, p_afa_order_id, 'profit', v_profit, 'AFA Registration: ' || COALESCE(v_guest_phone, 'guest'), 'completed');

  RETURN jsonb_build_object('success', true, 'message', 'Credited ' || v_profit);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== credit_shop_order_profits (p_shop_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.credit_shop_order_profits(p_shop_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profit        DECIMAL;
  v_sub_owner_id  UUID;
  v_network       TEXT;
  v_package_size  TEXT;
  v_guest_phone   TEXT;
  v_status        TEXT;
  v_sub_wallet_id UUID;
  v_credited_sub  BOOLEAN := false;
  v_credited_anc  INTEGER := 0;
  v_total_anc     DECIMAL := 0;
  v_existing      UUID;
  v_split         RECORD;
  v_anc_owner     UUID;
  v_anc_wallet    UUID;
  v_has_splits    BOOLEAN;
  v_legacy_shop   UUID;
  v_legacy_profit DECIMAL;
BEGIN
  SELECT so.profit, sp.owner_id, so.network, so.package_size, so.guest_phone,
         so.status, so.parent_shop_id, so.parent_profit
  INTO   v_profit, v_sub_owner_id, v_network, v_package_size, v_guest_phone,
         v_status, v_legacy_shop, v_legacy_profit
  FROM public.shop_orders so
  JOIN public.shop_profiles sp ON so.shop_id = sp.id
  WHERE so.id = p_shop_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  v_has_splits := EXISTS (SELECT 1 FROM public.shop_order_splits WHERE order_id = p_shop_order_id);

  IF NOT v_has_splits AND v_legacy_shop IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not a sub-agent order â€” use credit_shop_profit');
  END IF;

  IF v_status IN ('refunded','failed') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order not creditable (status ' || v_status || ')');
  END IF;

  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_sub_owner_id, 0, 0) ON CONFLICT (owner_id) DO NOTHING;
  SELECT id INTO v_sub_wallet_id FROM public.shop_wallets WHERE owner_id = v_sub_owner_id FOR UPDATE;

  IF COALESCE(v_profit, 0) > 0 THEN
    SELECT id INTO v_existing FROM public.shop_wallet_transactions
    WHERE shop_order_id = p_shop_order_id AND type = 'profit' AND shop_wallet_id = v_sub_wallet_id;
    IF v_existing IS NULL THEN
      UPDATE public.shop_wallets
      SET balance = balance + v_profit, total_earned = total_earned + v_profit, updated_at = NOW()
      WHERE id = v_sub_wallet_id;

      INSERT INTO public.shop_wallet_transactions
        (shop_wallet_id, shop_order_id, type, amount, description, status, credit_source)
      VALUES
        (v_sub_wallet_id, p_shop_order_id, 'profit', v_profit,
         'Sale: ' || v_network || ' ' || v_package_size || ' to ' || v_guest_phone, 'completed', 'order');
      v_credited_sub := true;
    END IF;
  END IF;

  FOR v_split IN
    SELECT s.beneficiary_shop_id AS beneficiary_shop_id, s.level AS level, s.profit AS profit
    FROM public.shop_order_splits s
    WHERE s.order_id = p_shop_order_id AND s.profit > 0
    UNION ALL
    SELECT v_legacy_shop, 1::SMALLINT, v_legacy_profit
    WHERE NOT v_has_splits
      AND v_legacy_shop IS NOT NULL
      AND COALESCE(v_legacy_profit, 0) > 0
    ORDER BY 2 ASC
  LOOP
    SELECT owner_id INTO v_anc_owner FROM public.shop_profiles WHERE id = v_split.beneficiary_shop_id;
    CONTINUE WHEN v_anc_owner IS NULL;

    INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
    VALUES (v_anc_owner, 0, 0) ON CONFLICT (owner_id) DO NOTHING;
    SELECT id INTO v_anc_wallet FROM public.shop_wallets WHERE owner_id = v_anc_owner FOR UPDATE;

    SELECT id INTO v_existing FROM public.shop_wallet_transactions
    WHERE shop_order_id = p_shop_order_id AND type = 'profit' AND shop_wallet_id = v_anc_wallet;
    CONTINUE WHEN v_existing IS NOT NULL;

    UPDATE public.shop_wallets
    SET balance = balance + v_split.profit, total_earned = total_earned + v_split.profit, updated_at = NOW()
    WHERE id = v_anc_wallet;

    INSERT INTO public.shop_wallet_transactions
      (shop_wallet_id, shop_order_id, type, amount, description, status, credit_source)
    VALUES
      (v_anc_wallet, p_shop_order_id, 'profit', v_split.profit,
       'Network sale: ' || v_network || ' ' || v_package_size || ' via sub-agent (level ' || v_split.level || ')',
       'completed', 'order_parent');

    v_credited_anc := v_credited_anc + 1;
    v_total_anc := v_total_anc + v_split.profit;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'credited_sub', v_credited_sub, 'sub_amount', COALESCE(v_profit, 0),
    'credited_ancestors', v_credited_anc, 'ancestor_amount', v_total_anc,
    'parent_amount', v_total_anc,
    'message', CASE
      WHEN NOT v_credited_sub AND v_credited_anc = 0 THEN 'Already credited'
      ELSE 'Credited'
    END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== credit_shop_profit (p_shop_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.credit_shop_profit(p_shop_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profit DECIMAL;
  v_owner_id UUID;
  v_wallet_id UUID;
  v_shop_name TEXT;
  v_guest_phone TEXT;
  v_network TEXT;
  v_package_size TEXT;
  v_existing_tx_id UUID;
BEGIN
  -- 1. Fetch Order & Owner Details
  SELECT
    so.profit,
    sp.owner_id,
    so.network,
    so.package_size,
    so.guest_phone
  INTO
    v_profit,
    v_owner_id,
    v_network,
    v_package_size,
    v_guest_phone
  FROM public.shop_orders so
  JOIN public.shop_profiles sp ON so.shop_id = sp.id
  WHERE so.id = p_shop_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_profit <= 0 OR v_profit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No profit to credit');
  END IF;

  -- 2. Get or Create Wallet (Atomic Upsert strategy)
  INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
  VALUES (v_owner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  -- 3. Lock the wallet row BEFORE checking idempotency (was: checked first, locked
  -- never). Serializes concurrent callers for the same owner â€” the second one to
  -- reach here blocks until the first commits, then sees the transaction row the
  -- first inserted below.
  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id
  FOR UPDATE;

  -- 4. Idempotency Check: Don't credit if already credited â€” now race-free because
  -- it runs under the wallet lock acquired above.
  SELECT id INTO v_existing_tx_id
  FROM public.shop_wallet_transactions
  WHERE shop_order_id = p_shop_order_id AND type = 'profit';

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  END IF;

  -- 5. Atomic Balance Update
  UPDATE public.shop_wallets
  SET
    balance = balance + v_profit,
    total_earned = total_earned + v_profit,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 6. Log Transaction
  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, shop_order_id, type, amount, description, status)
  VALUES
    (v_wallet_id, p_shop_order_id, 'profit', v_profit, 'Sale: ' || v_network || ' ' || v_package_size || ' to ' || v_guest_phone, 'completed');

  RETURN jsonb_build_object('success', true, 'message', 'Credited ' || v_profit);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== credit_shop_ussd_profit (p_shop_id uuid, p_profit numeric, p_ussd_ref text, p_description text) =====
CREATE OR REPLACE FUNCTION public.credit_shop_ussd_profit(p_shop_id uuid, p_profit numeric, p_ussd_ref text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_owner_id   UUID;
    v_wallet_id  UUID;
BEGIN
    IF p_profit <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No profit to credit');
    END IF;

    -- Idempotency: skip if already credited with this ref
    IF EXISTS (
        SELECT 1 FROM public.shop_wallet_transactions WHERE ussd_ref = p_ussd_ref
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already credited');
    END IF;

    -- Get shop owner
    SELECT owner_id INTO v_owner_id FROM public.shop_profiles WHERE id = p_shop_id;
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Shop not found');
    END IF;

    -- Upsert wallet
    INSERT INTO public.shop_wallets (owner_id, balance, total_earned)
    VALUES (v_owner_id, 0, 0)
    ON CONFLICT (owner_id) DO NOTHING;

    SELECT id INTO v_wallet_id FROM public.shop_wallets WHERE owner_id = v_owner_id;

    -- Atomic credit
    UPDATE public.shop_wallets
    SET balance       = balance + p_profit,
        total_earned  = total_earned + p_profit,
        updated_at    = NOW()
    WHERE id = v_wallet_id;

    -- Log with idempotency ref
    INSERT INTO public.shop_wallet_transactions
        (shop_wallet_id, type, amount, description, status, ussd_ref)
    VALUES
        (v_wallet_id, 'profit', p_profit, p_description, 'completed', p_ussd_ref);

    RETURN jsonb_build_object('success', true, 'message', 'Credited ' || p_profit);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== credit_sms_credits (p_shop_id uuid, p_credits integer) =====
CREATE OR REPLACE FUNCTION public.credit_sms_credits(p_shop_id uuid, p_credits integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;

    INSERT INTO shop_sms_wallets (shop_id, credits, total_purchased, total_used)
    VALUES (p_shop_id, p_credits, p_credits, 0)
    ON CONFLICT (shop_id) DO UPDATE
    SET credits          = shop_sms_wallets.credits          + p_credits,
        total_purchased  = shop_sms_wallets.total_purchased  + p_credits,
        updated_at       = now();

    RETURN jsonb_build_object('success', true);
END;
$function$
;

-- ===== credit_user_sms_credits (p_account_id uuid, p_credits integer, p_key text, p_kind text, p_reference text) =====
CREATE OR REPLACE FUNCTION public.credit_user_sms_credits(p_account_id uuid, p_credits integer, p_key text, p_kind text DEFAULT 'refund'::text, p_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_ledger_id UUID;
    v_balance   INTEGER;
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;
    IF p_key IS NULL OR length(trim(p_key)) < 8 THEN
        RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
    END IF;
    IF p_kind NOT IN ('purchase', 'refund', 'bonus', 'admin_adjust') THEN
        RAISE EXCEPTION 'INVALID_KIND';
    END IF;

    -- Reserve the key. Conflict = this credit already happened.
    INSERT INTO sms_credit_ledger (account_id, delta, kind, idempotency_key, reference)
    VALUES (p_account_id, p_credits, p_kind, p_key, p_reference)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;

    IF v_ledger_id IS NULL THEN
        RETURN jsonb_build_object('already_processed', true);
    END IF;

    UPDATE sms_wallets
    SET credits    = credits + p_credits,
        total_used = CASE WHEN p_kind = 'refund'
                          THEN GREATEST(0, total_used - p_credits)
                          ELSE total_used END,
        total_purchased = CASE WHEN p_kind IN ('purchase', 'bonus')
                               THEN total_purchased + p_credits
                               ELSE total_purchased END,
        updated_at = now()
    WHERE account_id = p_account_id
    RETURNING credits INTO v_balance;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    UPDATE sms_credit_ledger SET balance_after = v_balance WHERE id = v_ledger_id;

    RETURN jsonb_build_object('already_processed', false, 'balance', v_balance);
END;
$function$
;

-- ===== credit_utility_commission (p_utility_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.credit_utility_commission(p_utility_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record; v_pct numeric; v_share numeric; v_partner_id uuid; v_wallet_id uuid;
BEGIN
  UPDATE public.utility_orders
     SET commission_credited_at = now()
   WHERE id = p_utility_order_id
     AND status = 'completed'
     AND commission_amount IS NOT NULL
     AND commission_credited_at IS NULL
  RETURNING * INTO v_order;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Nothing to credit (already credited, not completed, or no commission)');
  END IF;

  IF v_order.shop_id IS NOT NULL THEN
    SELECT owner_id INTO v_partner_id FROM public.shop_profiles WHERE id = v_order.shop_id;
  ELSIF v_order.source IN ('api', 'dashboard') THEN
    -- Route-and-delegate: no shop_id -> the role-gated commission wallet path.
    -- This claim already fired (commission_credited_at is set), so undo it and
    -- let credit_commission_wallet perform its OWN claim + credit atomically.
    --
    -- LOAD-BEARING INVARIANT â€” do not split this into two separate RPC calls from
    -- application code. The unclaim below and the delegate call are safe ONLY because
    -- they execute inside this single function invocation (one transaction, row lock
    -- held throughout), so no other session can ever observe the momentarily-unclaimed
    -- row and double-credit it. Two round-trips from the app layer would commit the
    -- unclaim first and reopen exactly that race.
    UPDATE public.utility_orders SET commission_credited_at = NULL WHERE id = p_utility_order_id;
    RETURN public.credit_commission_wallet(p_utility_order_id);
  END IF;

  IF v_partner_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'No partner â€” platform keeps full commission');
  END IF;

  SELECT COALESCE(NULLIF(trim(both '"' from value::text), '')::numeric, 40)
    INTO v_pct FROM public.admin_settings WHERE key = 'utility_commission_partner_percent';
  v_pct := LEAST(GREATEST(COALESCE(v_pct, 40), 0), 100);
  v_share := round(v_order.commission_amount * v_pct / 100.0, 4);
  IF v_share <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Share rounds to zero');
  END IF;

  INSERT INTO public.shop_wallets (owner_id, balance, total_earned) VALUES (v_partner_id, 0, 0)
  ON CONFLICT (owner_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.shop_wallets WHERE owner_id = v_partner_id FOR UPDATE;
  UPDATE public.shop_wallets
     SET balance = balance + v_share, total_earned = total_earned + v_share, updated_at = now()
   WHERE id = v_wallet_id;
  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, utility_order_id, type, amount, description, status)
  VALUES (v_wallet_id, p_utility_order_id, 'utility_commission', v_share,
          'Utility commission: ' || v_order.biller || ' ' || v_order.account_number, 'completed');
  UPDATE public.utility_orders SET partner_commission_amount = v_share WHERE id = p_utility_order_id;
  RETURN jsonb_build_object('success', true, 'amount', v_share);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', true, 'message', 'Already credited (ledger unique)');
END $function$
;

-- ===== credit_wallet_balance (p_user_id uuid, p_amount numeric) =====
CREATE OR REPLACE FUNCTION public.credit_wallet_balance(p_user_id uuid, p_amount numeric)
 RETURNS TABLE(wallet_id uuid, new_balance numeric, new_total_spent numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_wallet_id UUID;
    v_new_balance NUMERIC;
    v_new_total_spent NUMERIC;
BEGIN
    UPDATE public.wallets
    SET
        balance     = balance + p_amount,
        total_spent = GREATEST(0, COALESCE(total_spent, 0) - p_amount),
        updated_at  = NOW()
    WHERE user_id = p_user_id
    RETURNING id, balance, COALESCE(total_spent, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_spent;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_spent;
END;
$function$
;

-- ===== debit_sms_credits (p_shop_id uuid, p_credits integer) =====
CREATE OR REPLACE FUNCTION public.debit_sms_credits(p_shop_id uuid, p_credits integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_new_credits INTEGER;
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM shop_sms_activations WHERE shop_id = p_shop_id) THEN
        RAISE EXCEPTION 'NOT_ACTIVATED';
    END IF;

    IF EXISTS (SELECT 1 FROM shop_sms_activations WHERE shop_id = p_shop_id AND sms_suspended = true) THEN
        RAISE EXCEPTION 'SUSPENDED';
    END IF;

    UPDATE shop_sms_wallets
    SET credits    = credits - p_credits,
        total_used = total_used + p_credits,
        updated_at = now()
    WHERE shop_id = p_shop_id AND credits >= p_credits
    RETURNING credits INTO v_new_credits;

    IF v_new_credits IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;

    RETURN jsonb_build_object('success', true, 'remaining', v_new_credits);
END;
$function$
;

-- ===== deduct_wallet_balance (p_user_id uuid, p_amount numeric) =====
CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(p_user_id uuid, p_amount numeric)
 RETURNS TABLE(wallet_id uuid, new_balance numeric, new_total_spent numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_wallet_id UUID;
    v_new_balance NUMERIC;
    v_new_total_spent NUMERIC;
BEGIN
    -- Atomic: UPDATE with WHERE balance >= amount.
    -- If balance is insufficient, no rows are updated â†’ we raise below.
    UPDATE public.wallets
    SET
        balance = balance - p_amount,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND balance >= p_amount
    RETURNING id, balance, COALESCE(total_spent, 0)
    INTO v_wallet_id, v_new_balance, v_new_total_spent;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN QUERY SELECT v_wallet_id, v_new_balance, v_new_total_spent;
END;
$function$
;

-- ===== delete_shop_data () =====
CREATE OR REPLACE FUNCTION public.delete_shop_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_owner_id  UUID;
    v_shop_id   UUID;
    v_wallet_id UUID;
BEGIN
    v_owner_id := auth.uid();

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    SELECT id INTO v_shop_id   FROM public.shop_profiles WHERE owner_id = v_owner_id;
    SELECT id INTO v_wallet_id FROM public.shop_wallets  WHERE owner_id = v_owner_id;

    IF v_shop_id IS NULL AND v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No shop found to delete');
    END IF;

    IF v_wallet_id IS NOT NULL THEN
        INSERT INTO public.archived_shop_financial_records (owner_id, shop_id, wallet_id, source_table, record)
        SELECT v_owner_id, v_shop_id, v_wallet_id, 'shop_wallets', to_jsonb(w)
        FROM public.shop_wallets w WHERE w.id = v_wallet_id;

        INSERT INTO public.archived_shop_financial_records (owner_id, shop_id, wallet_id, source_table, record)
        SELECT v_owner_id, v_shop_id, v_wallet_id, 'shop_wallet_transactions', to_jsonb(t)
        FROM public.shop_wallet_transactions t WHERE t.shop_wallet_id = v_wallet_id;
    END IF;

    IF v_shop_id IS NOT NULL THEN
        INSERT INTO public.archived_shop_financial_records (owner_id, shop_id, wallet_id, source_table, record)
        SELECT v_owner_id, v_shop_id, v_wallet_id, 'shop_orders', to_jsonb(o)
        FROM public.shop_orders o WHERE o.shop_id = v_shop_id;
    END IF;

    IF v_wallet_id IS NOT NULL THEN
        DELETE FROM public.shop_wallets WHERE id = v_wallet_id;
    END IF;

    IF v_shop_id IS NOT NULL THEN
        DELETE FROM public.shop_profiles WHERE id = v_shop_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Shop deleted successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== effective_owner_cost (p_price numeric, p_agent_price numeric, p_dealer_price numeric, p_role text) =====
CREATE OR REPLACE FUNCTION public.effective_owner_cost(p_price numeric, p_agent_price numeric, p_dealer_price numeric, p_role text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_role = 'dealer' AND COALESCE(p_dealer_price, 0) > 0 THEN p_dealer_price
    WHEN p_role = 'agent'  AND COALESCE(p_agent_price, 0)  > 0 THEN p_agent_price
    ELSE COALESCE(p_price, 0)
  END
$function$
;

-- ===== enforce_max_payment_details () =====
CREATE OR REPLACE FUNCTION public.enforce_max_payment_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (SELECT COUNT(*) FROM public.shop_payment_details WHERE shop_owner_id = NEW.shop_owner_id) >= 5 THEN
        RAISE EXCEPTION 'You can only save a maximum of 5 payment details.';
    END IF;
    RETURN NEW;
END;
$function$
;

-- ===== enforce_single_default_payment () =====
CREATE OR REPLACE FUNCTION public.enforce_single_default_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.shop_payment_details
        SET is_default = FALSE
        WHERE shop_owner_id = NEW.shop_owner_id
          AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$function$
;

-- ===== enforce_sub_agent_recruit_cap () =====
CREATE OR REPLACE FUNCTION public.enforce_sub_agent_recruit_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
  raw_cap TEXT;
  cap NUMERIC;
BEGIN
  IF NEW.upline_user_id IS NULL THEN
    RETURN NEW; -- legacy shop-invite rows are not subject to this cap
  END IF;

  -- Lock BEFORE counting (not after) â€” this is the entire fix. Two
  -- concurrent inserts for the same recruiter serialize here; the second
  -- only proceeds once the first's transaction has committed (and its row is
  -- therefore visible to this COUNT) or rolled back.
  PERFORM pg_advisory_xact_lock(hashtext('sub_agent_recruit_cap:' || NEW.upline_user_id::text));

  SELECT count(*) INTO current_count
  FROM public.sub_agents
  WHERE upline_user_id = NEW.upline_user_id;

  -- shop_global_settings.value is JSONB stored as a raw text-castable
  -- literal â€” mirrors the parseFloat(row.value) read convention already used
  -- in TypeScript (lib/sub-agent-create.ts, app/api/shop/withdraw/route.ts).
  SELECT value::text INTO raw_cap
  FROM public.shop_global_settings
  WHERE key = 'sub_agent_max_recruits';

  cap := NULLIF(raw_cap, '')::numeric;
  IF cap IS NULL OR cap <= 0 THEN
    cap := 5; -- DEFAULT_MAX_RECRUITS, kept in sync with lib/sub-agent-create.ts
  END IF;

  IF current_count >= cap THEN
    RAISE EXCEPTION 'SUB_AGENT_RECRUIT_CAP_EXCEEDED'
      USING HINT = 'Recruiter has reached their maximum number of sub-agents.';
  END IF;

  RETURN NEW;
END;
$function$
;

-- ===== enforce_subagent_contact_lock () =====
CREATE OR REPLACE FUNCTION public.enforce_subagent_contact_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.subagent_contact_override', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF (NEW.email IS DISTINCT FROM OLD.email OR NEW.phone_number IS DISTINCT FROM OLD.phone_number)
     AND EXISTS (
       SELECT 1 FROM public.sub_agents
       WHERE user_id = NEW.id AND upline_shop_id IS NULL
     ) THEN
    RAISE EXCEPTION 'Contact info for a sub-agent account cannot be changed directly. Contact support.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$
;

-- ===== enforce_support_thread_cap () =====
CREATE OR REPLACE FUNCTION public.enforce_support_thread_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  open_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('support_thread_cap:' || NEW.user_id::text));
  SELECT count(*) INTO open_count
  FROM public.support_threads
  WHERE user_id = NEW.user_id AND status = 'open';
  IF open_count >= 3 THEN
    RAISE EXCEPTION 'OPEN_THREAD_LIMIT'
      USING HINT = 'A user may have at most 3 open support threads.';
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== enforce_website_request_cap () =====
CREATE OR REPLACE FUNCTION public.enforce_website_request_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  open_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('website_request_cap:' || NEW.user_id::text));
  SELECT count(*) INTO open_count
  FROM public.website_requests
  WHERE user_id = NEW.user_id AND status IN ('new', 'contacted');
  IF open_count >= 1 THEN
    RAISE EXCEPTION 'OPEN_WEBSITE_REQUEST_LIMIT'
      USING HINT = 'A user may have at most 1 open website/app request or call request at a time.';
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== ensure_sms_account (p_user_id uuid) =====
CREATE OR REPLACE FUNCTION public.ensure_sms_account(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user   RECORD;
    v_acct   RECORD;
BEGIN
    SELECT id, status INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;
    IF v_user.status <> 'active' THEN
        RAISE EXCEPTION 'USER_NOT_ACTIVE';
    END IF;

    INSERT INTO sms_accounts (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_acct FROM sms_accounts WHERE user_id = p_user_id;

    INSERT INTO sms_wallets (account_id)
    VALUES (v_acct.id)
    ON CONFLICT (account_id) DO NOTHING;

    RETURN jsonb_build_object(
        'account_id', v_acct.id,
        'mode', v_acct.mode,
        'status', v_acct.status,
        'default_sender', v_acct.default_sender
    );
END;
$function$
;

-- ===== escalate_stale_sub_withdrawals () =====
CREATE OR REPLACE FUNCTION public.escalate_stale_sub_withdrawals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int;
BEGIN
  WITH to_escalate AS (
    SELECT swt.id
    FROM public.shop_wallet_transactions swt
    JOIN public.shop_wallets sw   ON sw.id  = swt.shop_wallet_id
    JOIN public.sub_agents   sa   ON sa.user_id = sw.owner_id
    LEFT JOIN public.shop_profiles lead ON lead.id = sa.upline_shop_id
    LEFT JOIN public.users lu           ON lu.id = lead.owner_id
    WHERE swt.status = 'shop_owner_pending'
      AND ( swt.escalate_after < now() OR lead.id IS NULL OR lead.approval_status IN ('suspended','rejected')
         OR lu.id IS NULL
         OR NOT ( (lu.role='agent' AND lu.agent_expires_at IS NULL) OR (lu.role='dealer' AND lu.dealer_expires_at > now()) ) )
    FOR UPDATE OF swt
  )
  UPDATE public.shop_wallet_transactions swt
  SET status='pending', auto_escalated=true, updated_at=now()
  FROM to_escalate te WHERE swt.id = te.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'escalated', v_count);
END;
$function$
;

-- ===== expire_stale_hubtel_receive (p_older_than_minutes integer) =====
CREATE OR REPLACE FUNCTION public.expire_stale_hubtel_receive(p_older_than_minutes integer DEFAULT 10)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_n integer;
BEGIN
  UPDATE public.hubtel_receive_charges
     SET status='expired'
   WHERE status='pending' AND created_at < now() - make_interval(mins => p_older_than_minutes);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $function$
;

-- ===== finalize_results_checker_sale (p_order_id uuid, p_user_id uuid) =====
CREATE OR REPLACE FUNCTION public.finalize_results_checker_sale(p_order_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.results_checker_inventory
  SET
    status                 = 'sold',
    reservation_expires_at = NULL,
    sold_to_user_id        = p_user_id,
    sold_at                = NOW(),
    updated_at             = NOW()
  WHERE reserved_by_order = p_order_id
    AND status = 'reserved';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

-- ===== find_drifted_shop_pricing () =====
CREATE OR REPLACE FUNCTION public.find_drifted_shop_pricing()
 RETURNS TABLE(shop_id uuid, package_id uuid, owner_id uuid, role text, selling_price numeric, owner_cost numeric, sub_price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    sp.shop_id, sp.package_id, spf.owner_id, u.role,
    sp.selling_price,
    public.effective_owner_cost(dp.price, dp.agent_price, dp.dealer_price, u.role) AS owner_cost,
    sp.sub_price
  FROM public.shop_pricing sp
  JOIN public.shop_profiles spf ON spf.id = sp.shop_id
  JOIN public.users u           ON u.id  = spf.owner_id
  JOIN public.data_packages dp  ON dp.id = sp.package_id
  WHERE NOT EXISTS (SELECT 1 FROM public.sub_agents sa WHERE sa.user_id = spf.owner_id)
    AND (
      sp.selling_price <= public.effective_owner_cost(dp.price, dp.agent_price, dp.dealer_price, u.role)
      OR (sp.sub_price IS NOT NULL
          AND sp.sub_price < public.effective_owner_cost(dp.price, dp.agent_price, dp.dealer_price, u.role))
    )

  UNION ALL

  SELECT
    sp.shop_id, sp.package_id, spf.owner_id, 'sub-agent'::text AS role,
    sp.selling_price,
    up.sub_price AS owner_cost,
    sp.sub_price
  FROM public.shop_pricing sp
  JOIN public.shop_profiles spf ON spf.id = sp.shop_id
  JOIN public.sub_agents sa     ON sa.user_id = spf.owner_id
  JOIN public.shop_pricing up   ON up.shop_id = sa.upline_shop_id AND up.package_id = sp.package_id
  WHERE up.sub_price IS NOT NULL
    AND sp.selling_price < up.sub_price

  UNION ALL

  -- New-model sub-agents only (Task 5, 2026-09-16, fix round): sa.upline_shop_id IS NULL
  -- makes this branch mutually exclusive with the old-model branch immediately above --
  -- without this guard, a sub_agents row that happens to carry BOTH upline_shop_id (old
  -- model) AND upline_user_id (new model) would be evaluated by both branches, potentially
  -- emitting a duplicated, differently-based drift alert for the same shop_pricing row the
  -- moment an admin changed a package price (confirmed live: 0 impact today only because
  -- neither branch currently flags any of the 4 shops in that overlapping state -- this
  -- guard prevents that from becoming a real, confusing double-alert later).
  SELECT
    sp.shop_id, sp.package_id, spf.owner_id, 'subagent'::text AS role,
    sp.selling_price,
    public.effective_owner_cost(dp.price, dp.agent_price, dp.dealer_price, ru.role)
      + COALESCE(
          (SELECT sap.markup FROM public.sub_agent_pricing sap
           WHERE sap.sub_user_id = spf.owner_id AND sap.product_type = 'data' AND sap.product_ref = sp.package_id::text),
          (SELECT sadp.markup FROM public.sub_agent_default_pricing sadp
           WHERE sadp.recruiter_id = sa.upline_user_id AND sadp.product_type = 'data' AND sadp.product_ref = sp.package_id::text),
          0
        ) AS owner_cost,
    sp.sub_price
  FROM public.shop_pricing sp
  JOIN public.shop_profiles spf ON spf.id = sp.shop_id
  JOIN public.sub_agents sa     ON sa.user_id = spf.owner_id AND sa.status = 'active' AND sa.upline_user_id IS NOT NULL AND sa.upline_shop_id IS NULL
  JOIN public.users ru          ON ru.id = sa.upline_user_id
  JOIN public.data_packages dp  ON dp.id = sp.package_id
  WHERE sp.selling_price <= (
    public.effective_owner_cost(dp.price, dp.agent_price, dp.dealer_price, ru.role)
    + COALESCE(
        (SELECT sap.markup FROM public.sub_agent_pricing sap
         WHERE sap.sub_user_id = spf.owner_id AND sap.product_type = 'data' AND sap.product_ref = sp.package_id::text),
        (SELECT sadp.markup FROM public.sub_agent_default_pricing sadp
         WHERE sadp.recruiter_id = sa.upline_user_id AND sadp.product_type = 'data' AND sadp.product_ref = sp.package_id::text),
        0
      )
  );
$function$
;

-- ===== get_admin_dashboard_stats () =====
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE result JSON;
BEGIN
    SELECT json_build_object(
        'totalUsers',         (SELECT count(*) FROM public.users),
        'totalOrders',        (SELECT count(*) FROM public.orders),
        'completedOrders',    (SELECT count(*) FROM public.orders WHERE status = 'completed'),
        'pendingOrders',      (SELECT count(*) FROM public.orders WHERE status = 'pending'),
        'totalRevenue',       COALESCE((SELECT sum(price) FROM public.orders WHERE status = 'completed'), 0),
        'totalWalletBalance', COALESCE((SELECT sum(balance) FROM public.wallets), 0),
        'successRate', CASE
            WHEN (SELECT count(*) FROM public.orders) > 0
            THEN round(((SELECT count(*) FROM public.orders WHERE status = 'completed')::float
                       / (SELECT count(*) FROM public.orders)::float) * 100)
            ELSE 0 END,
        'todayOrders',        (SELECT count(*) FROM public.orders WHERE created_at >= CURRENT_DATE),
        'revenueToday',   COALESCE((SELECT sum(price) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE), 0),
        'revenue7d',      COALESCE((SELECT sum(price) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE - 6), 0),
        'revenue30d',     COALESCE((SELECT sum(price) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE - 29), 0),
        'revenuePrev7d',  COALESCE((SELECT sum(price) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE - 13 AND created_at < CURRENT_DATE - 6), 0),
        'revenuePrev30d', COALESCE((SELECT sum(price) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE - 59 AND created_at < CURRENT_DATE - 29), 0),
        'profitToday', COALESCE((SELECT sum(price - COALESCE(cost_price_at_time,0)) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE), 0),
        'profit7d',    COALESCE((SELECT sum(price - COALESCE(cost_price_at_time,0)) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE - 6), 0),
        'profit30d',   COALESCE((SELECT sum(price - COALESCE(cost_price_at_time,0)) FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE - 29), 0),
        'outstandingDebt', COALESCE((SELECT sum(amount_owed - amount_settled) FROM public.pending_settlements WHERE status IN ('pending','partially_settled')), 0),
        'debtorCount',     (SELECT count(DISTINCT user_id) FROM public.pending_settlements WHERE status IN ('pending','partially_settled')),
        'failedNeedsAction', (SELECT count(*) FROM public.orders WHERE status='failed'),
        'newUsers7d',  (SELECT count(*) FROM public.users WHERE created_at >= CURRENT_DATE - 6),
        'newUsers30d', (SELECT count(*) FROM public.users WHERE created_at >= CURRENT_DATE - 29),
        -- â”€â”€ Refund metrics (new) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'refundedOrders',  (SELECT count(*) FROM public.orders WHERE status='refunded' OR payment_status='refunded'),
        'refundsAmount',   COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE source='refund'), 0),
        'refundsToday',    COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE source='refund' AND created_at >= CURRENT_DATE), 0),
        'refunds7d',       COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE source='refund' AND created_at >= CURRENT_DATE - 6), 0),
        'refunds30d',      COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE source='refund' AND created_at >= CURRENT_DATE - 29), 0),
        'roleMix', COALESCE((SELECT json_object_agg(COALESCE(role,'unknown'), c)
                             FROM (SELECT role, count(*) c FROM public.users GROUP BY role) r), '{}'::json)
    ) INTO result;
    RETURN result;
END;
$function$
;

-- ===== get_admin_dashboard_trends (p_range text) =====
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_trends(p_range text DEFAULT '7d'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_start date;
    v_is_hourly boolean := false;
    series_json json; network_json json; category_json json;
    source_json json; top_pkg_json json; top_agent_json json;
BEGIN
    IF p_range = 'today' THEN
        v_start := CURRENT_DATE; v_is_hourly := true;
    ELSIF p_range = '30d' THEN
        v_start := CURRENT_DATE - 29;
    ELSE
        v_start := CURRENT_DATE - 6;
    END IF;

    IF v_is_hourly THEN
        SELECT json_agg(t) INTO series_json FROM (
            SELECT to_char(g.b, 'HH24:00') AS bucket,
                   COALESCE(o.revenue,0) AS revenue, COALESCE(o.orders,0) AS orders, COALESCE(o.profit,0) AS profit
            FROM generate_series(date_trunc('hour', CURRENT_DATE::timestamp), date_trunc('hour', now()), interval '1 hour') g(b)
            LEFT JOIN (
                SELECT date_trunc('hour', created_at) hb, sum(price) revenue, count(*) orders,
                       sum(price - COALESCE(cost_price_at_time,0)) profit
                FROM public.orders WHERE status='completed' AND created_at >= CURRENT_DATE GROUP BY 1
            ) o ON o.hb = g.b
            ORDER BY g.b
        ) t;
    ELSE
        SELECT json_agg(t) INTO series_json FROM (
            SELECT to_char(g.b, 'Mon DD') AS bucket,
                   COALESCE(o.revenue,0) AS revenue, COALESCE(o.orders,0) AS orders, COALESCE(o.profit,0) AS profit
            FROM generate_series(v_start::timestamp, CURRENT_DATE::timestamp, interval '1 day') g(b)
            LEFT JOIN (
                SELECT created_at::date db, sum(price) revenue, count(*) orders,
                       sum(price - COALESCE(cost_price_at_time,0)) profit
                FROM public.orders WHERE status='completed' AND created_at >= v_start GROUP BY 1
            ) o ON o.db = g.b::date
            ORDER BY g.b
        ) t;
    END IF;

    SELECT json_agg(t) INTO network_json FROM (
        SELECT network, sum(price) revenue, count(*) orders
        FROM public.orders WHERE status='completed' AND created_at >= v_start GROUP BY network ORDER BY sum(price) DESC
    ) t;
    SELECT json_agg(t) INTO category_json FROM (
        SELECT category, sum(price) revenue, count(*) orders
        FROM public.orders WHERE status='completed' AND created_at >= v_start GROUP BY category ORDER BY sum(price) DESC
    ) t;
    SELECT json_agg(t) INTO source_json FROM (
        SELECT source, sum(price) revenue, count(*) orders
        FROM public.orders WHERE status='completed' AND created_at >= v_start GROUP BY source ORDER BY sum(price) DESC
    ) t;
    SELECT json_agg(t) INTO top_pkg_json FROM (
        SELECT (network || ' ' || size) AS label, network, size, count(*) orders, sum(price) revenue
        FROM public.orders WHERE status='completed' AND created_at >= v_start GROUP BY network, size ORDER BY sum(price) DESC LIMIT 5
    ) t;
    SELECT json_agg(t) INTO top_agent_json FROM (
        SELECT o.user_id, COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), 'Unknown') AS name,
               sum(o.price) revenue, count(*) orders
        FROM public.orders o JOIN public.users u ON u.id = o.user_id
        WHERE o.status='completed' AND o.created_at >= v_start AND u.role = 'agent'
        GROUP BY o.user_id, u.first_name, u.last_name ORDER BY sum(o.price) DESC LIMIT 5
    ) t;

    RETURN json_build_object(
        'range', p_range,
        'series', COALESCE(series_json,'[]'::json), 'byNetwork', COALESCE(network_json,'[]'::json),
        'byCategory', COALESCE(category_json,'[]'::json), 'bySource', COALESCE(source_json,'[]'::json),
        'topPackages', COALESCE(top_pkg_json,'[]'::json), 'topAgents', COALESCE(top_agent_json,'[]'::json)
    );
END;
$function$
;

-- ===== get_admin_recent_activity (p_limit integer) =====
CREATE OR REPLACE FUNCTION public.get_admin_recent_activity(p_limit integer DEFAULT 12)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE result json; v_limit int := LEAST(GREATEST(COALESCE(p_limit,12),1),50);
BEGIN
    SELECT COALESCE(json_agg(t), '[]'::json) INTO result FROM (
        SELECT kind, id, label, amount, status, at FROM (
            (SELECT 'order'::text AS kind, o.id::text AS id, (o.network || ' ' || o.size) AS label,
                    o.price::numeric AS amount, COALESCE(o.status,'') AS status, o.created_at AS at
             FROM public.orders o WHERE o.created_at IS NOT NULL ORDER BY o.created_at DESC LIMIT v_limit)
            UNION ALL
            (SELECT 'withdrawal'::text, w.id::text, COALESCE(NULLIF(w.description,''),'Withdrawal'),
                    w.amount::numeric, COALESCE(w.status,''), w.created_at
             FROM public.shop_wallet_transactions w WHERE w.type='withdrawal' AND w.created_at IS NOT NULL
             ORDER BY w.created_at DESC LIMIT v_limit)
            UNION ALL
            (SELECT 'signup'::text, ('user-' || substr(u.id::text, 1, 8)),
                    COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name),''),'New user'),
                    NULL::numeric, COALESCE(u.role,''), u.created_at
             FROM public.users u WHERE u.created_at IS NOT NULL ORDER BY u.created_at DESC LIMIT v_limit)
        ) unioned
        ORDER BY at DESC NULLS LAST LIMIT v_limit
    ) t;
    RETURN result;
END;
$function$
;

-- ===== get_my_orders_stats (p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_network text, p_category text, p_search text) =====
CREATE OR REPLACE FUNCTION public.get_my_orders_stats(p_user_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_network text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS TABLE(total_count bigint, pending_count bigint, queued_count bigint, processing_count bigint, completed_count bigint, failed_count bigint, refunded_count bigint, total_amount numeric, total_data_gb numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with matched as (
    select
      o.status,
      o.price,
      o.payment_status,
      o.size
    from public.orders o
    where o.user_id = p_user_id
      and o.shop_order_id is null
      and o.created_at >= p_date_from
      and o.created_at <= p_date_to
      and (p_network is null or o.network = p_network)
      and (p_category is null or coalesce(o.category, 'data') = p_category)
      and (p_search is null or o.phone_number ilike '%' || p_search || '%')
  ),
  sized as (
    select
      status,
      price,
      payment_status,
      (regexp_match(lower(size), '([\d.]+)\s*(gb|mb)'))[1]::numeric as size_value,
      (regexp_match(lower(size), '([\d.]+)\s*(gb|mb)'))[2] as size_unit
    from matched
  )
  select
    count(*) as total_count,
    count(*) filter (where status = 'pending') as pending_count,
    count(*) filter (where status = 'queued') as queued_count,
    count(*) filter (where status = 'processing') as processing_count,
    count(*) filter (where status = 'completed') as completed_count,
    count(*) filter (where status = 'failed') as failed_count,
    count(*) filter (where status = 'refunded') as refunded_count,
    coalesce(sum(price) filter (where payment_status is distinct from 'refunded'), 0) as total_amount,
    coalesce(sum(
      case
        when size_unit = 'gb' then size_value
        when size_unit = 'mb' then size_value / 1024
        else 0
      end
    ) filter (where payment_status is distinct from 'refunded'), 0) as total_data_gb
  from sized;
$function$
;

-- ===== get_profit_summary (p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_prev_start_date timestamp with time zone, p_prev_end_date timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.get_profit_summary(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_prev_start_date timestamp with time zone, p_prev_end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    -- Current Period
    v_main_revenue DECIMAL := 0;
    v_main_cost DECIMAL := 0;
    v_main_orders INT := 0;
    v_main_excluded INT := 0;

    v_shop_revenue DECIMAL := 0;
    v_shop_platform_cost DECIMAL := 0;
    v_shop_owner_profit_sum DECIMAL := 0;
    v_shop_orders INT := 0;
    v_shop_excluded INT := 0;

    -- Previous Period (for Growth)
    v_prev_main_profit DECIMAL := 0;
    v_prev_shop_platform_profit DECIMAL := 0;

    -- Totals
    v_total_revenue DECIMAL;
    v_total_cost DECIMAL;
    v_total_profit DECIMAL;
    v_profit_margin DECIMAL := 0;
    v_growth_pct DECIMAL := 0;
BEGIN
    -- MAIN: Current Period (Only Completed, Valid Cost)
    SELECT 
        COALESCE(SUM(price), 0),
        COALESCE(SUM(cost_price_at_time), 0),
        COUNT(id)
    INTO v_main_revenue, v_main_cost, v_main_orders
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- MAIN: Excluded Orders
    SELECT COUNT(id) INTO v_main_excluded
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND (cost_price_at_time IS NULL OR cost_price_at_time <= 0)
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- SHOP: Current Period
    SELECT 
        COALESCE(SUM(cost_price), 0),          -- What platform earned
        COALESCE(SUM(admin_cost_at_time), 0),  -- Platform's true cost
        COALESCE(SUM(profit), 0),              -- Owner's cut
        COUNT(id)
    INTO v_shop_revenue, v_shop_platform_cost, v_shop_owner_profit_sum, v_shop_orders
    FROM public.shop_orders
    WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- SHOP: Excluded Orders
    SELECT COUNT(id) INTO v_shop_excluded
    FROM public.shop_orders
    WHERE status = 'completed' AND (admin_cost_at_time IS NULL OR admin_cost_at_time <= 0)
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- PREVIOUS PERIOD (For Growth calculation)
    SELECT COALESCE(SUM(price - cost_price_at_time), 0) INTO v_prev_main_profit
    FROM public.orders
    WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
    AND created_at BETWEEN p_prev_start_date AND p_prev_end_date;

    SELECT COALESCE(SUM(cost_price - admin_cost_at_time), 0) INTO v_prev_shop_platform_profit
    FROM public.shop_orders
    WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    AND created_at BETWEEN p_prev_start_date AND p_prev_end_date;

    -- Compute Totals
    v_total_revenue := v_main_revenue + v_shop_revenue;
    v_total_cost := v_main_cost + v_shop_platform_cost;
    v_total_profit := (v_main_revenue - v_main_cost) + (v_shop_revenue - v_shop_platform_cost);
    
    IF v_total_revenue > 0 THEN
        v_profit_margin := ROUND((v_total_profit / v_total_revenue) * 100, 2);
    END IF;

    -- Compute Growth
    DECLARE
        v_prev_total_profit DECIMAL := v_prev_main_profit + v_prev_shop_platform_profit;
    BEGIN
        IF v_prev_total_profit > 0 THEN
            v_growth_pct := ROUND(((v_total_profit - v_prev_total_profit) / v_prev_total_profit) * 100, 2);
        ELSIF v_total_profit > 0 THEN
            v_growth_pct := 100;
        END IF;
    END;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_revenue', v_total_revenue,
            'total_cost', v_total_cost,
            'total_profit', v_total_profit,
            'profit_margin', v_profit_margin,
            'total_orders', v_main_orders + v_shop_orders,
            'excluded_orders', v_main_excluded + v_shop_excluded,
            'growth_percent', v_growth_pct
        ),
        'main_stats', jsonb_build_object(
            'revenue', v_main_revenue,
            'cost', v_main_cost,
            'profit', v_main_revenue - v_main_cost,
            'orders', v_main_orders
        ),
        'shop_stats', jsonb_build_object(
            'revenue', v_shop_revenue,
            'platform_cost', v_shop_platform_cost,
            'platform_profit', v_shop_revenue - v_shop_platform_cost,
            'owner_profit', v_shop_owner_profit_sum,
            'orders', v_shop_orders
        )
    );
END;
$function$
;

-- ===== get_profit_summary_v2 (p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_prev_start_date timestamp with time zone, p_prev_end_date timestamp with time zone, p_product_types text[], p_network text) =====
CREATE OR REPLACE FUNCTION public.get_profit_summary_v2(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_prev_start_date timestamp with time zone, p_prev_end_date timestamp with time zone, p_product_types text[] DEFAULT NULL::text[], p_network text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_total_revenue numeric := 0;
    v_total_cost numeric := 0;
    v_total_profit numeric := 0;
    v_total_orders bigint := 0;
    v_excluded bigint := 0;
    v_recruiter_payouts numeric := 0;
    v_partner_payouts numeric := 0;
    v_profit_margin numeric := 0;
    v_growth_pct numeric := 0;
    v_prev_total_profit numeric := 0;
    v_by_product jsonb := '{}'::jsonb;
    r record;
BEGIN
    FOR r IN SELECT * FROM public._profit_totals_v2(p_start_date, p_end_date, p_product_types, p_network) LOOP
        v_total_revenue := v_total_revenue + r.revenue;
        v_total_cost := v_total_cost + r.cost;
        v_total_profit := v_total_profit + r.profit;
        v_total_orders := v_total_orders + r.orders;
        v_excluded := v_excluded + r.excluded;
        v_recruiter_payouts := v_recruiter_payouts + r.recruiter_payout;
        v_partner_payouts := v_partner_payouts + r.partner_payout;
        v_by_product := v_by_product || jsonb_build_object(
            r.product, jsonb_build_object(
                'revenue', r.revenue, 'cost', r.cost, 'profit', r.profit,
                'orders', r.orders, 'excluded', r.excluded,
                'recruiter_payout', r.recruiter_payout, 'partner_payout', r.partner_payout
            )
        );
    END LOOP;

    SELECT COALESCE(SUM(profit),0) INTO v_prev_total_profit
    FROM public._profit_totals_v2(p_prev_start_date, p_prev_end_date, p_product_types, p_network);

    IF v_total_revenue > 0 THEN
        v_profit_margin := ROUND((v_total_profit / v_total_revenue) * 100, 2);
    END IF;
    IF v_prev_total_profit > 0 THEN
        v_growth_pct := ROUND(((v_total_profit - v_prev_total_profit) / v_prev_total_profit) * 100, 2);
    ELSIF v_total_profit > 0 THEN
        v_growth_pct := 100;
    END IF;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'total_revenue', v_total_revenue,
            'total_cost', v_total_cost,
            'total_profit', v_total_profit,
            'profit_margin', v_profit_margin,
            'total_orders', v_total_orders,
            'excluded_orders', v_excluded,
            'growth_percent', v_growth_pct,
            'recruiter_payouts', v_recruiter_payouts,
            'partner_commission_payouts', v_partner_payouts
        ),
        'by_product', v_by_product
    );
END;
$function$
;

-- ===== get_profit_timeseries (p_start_date timestamp with time zone, p_end_date timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.get_profit_timeseries(p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    WITH dates AS (
        SELECT generate_series(
            p_start_date::date,
            p_end_date::date,
            '1 day'::interval
        )::date AS day
    ),
    main_daily AS (
        SELECT 
            DATE(created_at) as day,
            SUM(price) as main_rev,
            SUM(price - cost_price_at_time) as main_profit
        FROM public.orders
        WHERE status = 'completed' AND shop_order_id IS NULL AND cost_price_at_time > 0
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
    ),
    shop_daily AS (
        SELECT 
            DATE(created_at) as day,
            SUM(cost_price) as shop_rev,
            SUM(cost_price - admin_cost_at_time) as shop_platform_profit,
            SUM(profit) as shop_owner_profit
        FROM public.shop_orders
        WHERE status = 'completed' AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(created_at)
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(d.day, 'YYYY-MM-DD'),
            'main_revenue', COALESCE(m.main_rev, 0),
            'main_profit', COALESCE(m.main_profit, 0),
            'shop_revenue', COALESCE(s.shop_rev, 0),
            'shop_platform_profit', COALESCE(s.shop_platform_profit, 0),
            'shop_owner_profit', COALESCE(s.shop_owner_profit, 0)
        ) ORDER BY d.day ASC
    ), '[]'::jsonb) INTO v_result
    FROM dates d
    LEFT JOIN main_daily m ON m.day = d.day
    LEFT JOIN shop_daily s ON s.day = d.day;

    RETURN v_result;
END;
$function$
;

-- ===== get_profit_timeseries_v2 (p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_product_types text[], p_network text) =====
CREATE OR REPLACE FUNCTION public.get_profit_timeseries_v2(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_product_types text[] DEFAULT NULL::text[], p_network text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    WITH dates AS (
        SELECT generate_series(p_start_date::date, p_end_date::date, '1 day'::interval)::date AS day
    ),
    daily AS (
        SELECT day, SUM(revenue) AS revenue, SUM(cost) AS cost
        FROM public._profit_daily_rows_v2(p_start_date, p_end_date, p_product_types, p_network)
        GROUP BY day
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', TO_CHAR(d.day, 'YYYY-MM-DD'),
            'revenue', COALESCE(x.revenue, 0),
            'cost', COALESCE(x.cost, 0),
            'profit', COALESCE(x.revenue, 0) - COALESCE(x.cost, 0)
        ) ORDER BY d.day ASC
    ), '[]'::jsonb) INTO v_result
    FROM dates d
    LEFT JOIN daily x ON x.day = d.day;

    RETURN v_result;
END;
$function$
;

-- ===== get_shop_credit_rollups (p_owner_id uuid) =====
CREATE OR REPLACE FUNCTION public.get_shop_credit_rollups(p_owner_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
    SELECT jsonb_build_object(
        'green_total', COALESCE(SUM(amount) FILTER (WHERE risk_status = 'green'), 0),
        'amber_total', COALESCE(SUM(amount) FILTER (WHERE risk_status = 'amber'), 0),
        'red_total',   COALESCE(SUM(amount) FILTER (WHERE risk_status = 'red'), 0),
        'red_count',   COUNT(*)            FILTER (WHERE risk_status = 'red')
    )
    FROM public.v_shop_profit_credit_reconciliation
    WHERE p_owner_id IS NULL OR owner_id = p_owner_id;
$function$
;

-- ===== get_shop_orders_by_phone (p_phone_number text, p_limit_count integer, p_shop_id uuid) =====
CREATE OR REPLACE FUNCTION public.get_shop_orders_by_phone(p_phone_number text, p_limit_count integer DEFAULT 20, p_shop_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, network text, package_size text, selling_price numeric, status text, created_at timestamp with time zone, guest_phone text, shop_name text, shop_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        so.id,
        so.network,
        so.package_size,
        so.selling_price,
        COALESCE(retry_o.status, orig_o.status, so.status) AS status,
        so.created_at,
        so.guest_phone,
        sp.shop_name,
        sp.shop_slug
    FROM public.shop_orders   so
    JOIN public.shop_profiles sp ON so.shop_id = sp.id
    LEFT JOIN public.orders orig_o ON orig_o.shop_order_id = so.id
    LEFT JOIN LATERAL (
        SELECT o2.status
        FROM public.orders o2
        WHERE o2.retry_of_order_id = orig_o.id
        ORDER BY o2.created_at DESC
        LIMIT 1
    ) retry_o ON true
    WHERE so.guest_phone = p_phone_number
      AND (p_shop_id IS NULL OR so.shop_id = p_shop_id)

    UNION ALL

    SELECT
        ao.id,
        'AFA'::text              AS network,
        'AFA Registration'::text AS package_size,
        ao.selling_price,
        ao.status,
        ao.created_at,
        ao.guest_phone,
        sp2.shop_name,
        sp2.shop_slug
    FROM public.afa_orders ao
    JOIN public.shop_profiles sp2 ON ao.shop_id = sp2.id
    WHERE ao.shop_id IS NOT NULL
      AND ao.guest_phone = p_phone_number
      AND (p_shop_id IS NULL OR ao.shop_id = p_shop_id)

    ORDER BY created_at DESC
    LIMIT p_limit_count;
END;
$function$
;

-- ===== get_shop_orders_by_phone (phone_number text, limit_count integer) =====
CREATE OR REPLACE FUNCTION public.get_shop_orders_by_phone(phone_number text, limit_count integer DEFAULT 20)
 RETURNS TABLE(id uuid, network text, package_size text, selling_price numeric, status text, created_at timestamp with time zone, guest_phone text, shop_name text, shop_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select 
    so.id,
    so.network,
    so.package_size,
    so.selling_price,
    so.status,
    so.created_at,
    so.guest_phone,
    sp.shop_name,
    sp.shop_slug
  from shop_orders so
  join shop_profiles sp on so.shop_id = sp.id
  where so.guest_phone = phone_number
  order by so.created_at desc
  limit limit_count;
end;
$function$
;

-- ===== get_shop_orders_stats (p_shop_id uuid, p_tab text, p_status text, p_network text, p_source text, p_search text, p_date_from timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.get_shop_orders_stats(p_shop_id uuid, p_tab text DEFAULT 'all'::text, p_status text DEFAULT NULL::text, p_network text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_count bigint, pending_count bigint, queued_count bigint, processing_count bigint, completed_count bigint, failed_count bigint, refunded_count bigint, revenue numeric, profit numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    count(*) as total_count,
    count(*) filter (where v.effective_status = 'pending') as pending_count,
    count(*) filter (where v.effective_status = 'queued') as queued_count,
    count(*) filter (where v.effective_status = 'processing') as processing_count,
    count(*) filter (where v.effective_status = 'completed') as completed_count,
    count(*) filter (where v.effective_status = 'failed') as failed_count,
    count(*) filter (where v.effective_status = 'refunded') as refunded_count,
    coalesce(sum(v.selling_price) filter (
      where v.effective_status in ('pending', 'queued', 'processing', 'completed')
    ), 0) as revenue,
    coalesce(sum(v.profit) filter (
      where v.effective_status in ('pending', 'queued', 'processing', 'completed')
    ), 0) as profit
  from public.shop_orders_effective v
  where v.shop_id = p_shop_id
    and (
      p_tab = 'all'
      or (p_tab = 'data' and v.package_id is not null)
      or (p_tab = 'airtime' and v.package_id is null)
    )
    and (p_status is null or v.effective_status = p_status)
    and (p_network is null or lower(v.network) = lower(p_network))
    and (
      p_source is null
      or (p_source = 'ussd' and v.source in ('ussd', 'ussd_shop'))
      or (p_source = 'storefront' and (v.source is null or v.source not in ('ussd', 'ussd_shop')))
    )
    and (p_search is null or v.guest_phone ilike '%' || p_search || '%')
    and (p_date_from is null or v.created_at >= p_date_from);
$function$
;

-- ===== get_shop_owner_stats () =====
CREATE OR REPLACE FUNCTION public.get_shop_owner_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'owner_id', u.id,
            'owner_name', COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
            'shop_name', sp.shop_name,
            'total_sales_count', COALESCE(stats.sales_count, 0),
            'total_sales_value', COALESCE(stats.sales_value, 0),
            'platform_profit', COALESCE(stats.plat_profit, 0),
            'owner_profit', COALESCE(stats.own_profit, 0),
            'wallet_balance', COALESCE(sw.balance, 0)
        ) ORDER BY stats.own_profit DESC NULLS LAST
    ), '[]'::jsonb) INTO v_result
    FROM public.shop_profiles sp
    JOIN public.users u ON u.id = sp.owner_id
    LEFT JOIN public.shop_wallets sw ON sw.owner_id = sp.owner_id
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(id) as sales_count,
            SUM(selling_price) as sales_value,
            SUM(cost_price - admin_cost_at_time) as plat_profit,
            SUM(profit) as own_profit
        FROM public.shop_orders
        WHERE shop_id = sp.id AND status = 'completed' 
          AND admin_cost_at_time IS NOT NULL AND admin_cost_at_time > 0
    ) stats ON true;

    RETURN v_result;
END;
$function$
;

-- ===== get_shop_voucher_stats (p_shop_id uuid, p_status text, p_search text, p_date_from timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.get_shop_voucher_stats(p_shop_id uuid, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_count bigint, pending_count bigint, processing_count bigint, completed_count bigint, failed_count bigint, refunded_count bigint, revenue numeric, profit numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    count(*) as total_count,
    count(*) filter (where r.status = 'pending') as pending_count,
    count(*) filter (where r.status = 'processing') as processing_count,
    count(*) filter (where r.status = 'completed') as completed_count,
    count(*) filter (where r.status = 'failed') as failed_count,
    count(*) filter (where r.status = 'refunded') as refunded_count,
    coalesce(sum(r.unit_price * r.quantity) filter (
      where r.status in ('pending', 'processing', 'completed')
    ), 0) as revenue,
    coalesce(sum(r.shop_markup * r.quantity) filter (
      where r.status in ('pending', 'processing', 'completed')
    ), 0) as profit
  from public.results_checker_orders r
  where r.shop_id = p_shop_id
    and r.payment_status != 'pending_payment'
    and (p_status is null or r.status = p_status)
    and (p_search is null or r.customer_phone ilike '%' || p_search || '%')
    and (p_date_from is null or r.created_at >= p_date_from);
$function$
;

-- ===== get_user_dashboard_stats (p_user_id uuid) =====
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND shop_order_id IS NULL),
        'completedOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'completed' AND shop_order_id IS NULL),
        'processingOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'processing' AND shop_order_id IS NULL),
        'failedOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'failed' AND shop_order_id IS NULL),
        'pendingOrders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND status = 'pending' AND shop_order_id IS NULL),
        'walletBalance', COALESCE((SELECT balance FROM public.wallets WHERE user_id = p_user_id), 0)
    ) INTO result;
    
    RETURN result;
END;
$function$
;

-- ===== get_user_transactions_with_balance (p_user_id uuid, p_limit integer, p_offset integer, p_source_filter text, p_type_filter text, p_start_date timestamp with time zone, p_end_date timestamp with time zone) =====
CREATE OR REPLACE FUNCTION public.get_user_transactions_with_balance(p_user_id uuid, p_limit integer, p_offset integer, p_source_filter text DEFAULT 'all'::text, p_type_filter text DEFAULT 'all'::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, amount numeric, type text, description text, reference text, source text, status text, created_at timestamp with time zone, balance_before numeric, balance_after numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    -- Ownership guard: reject cross-user snooping by authenticated callers.
    -- Service-role calls (admin routes) have auth.uid() = NULL and are allowed.
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'ACCESS_DENIED: You may only view your own transactions';
    END IF;

    RETURN QUERY
    WITH
    all_txns AS (
        SELECT
            t.id,
            t.amount,
            t.type,
            t.description,
            t.reference,
            t.source,
            t.status,
            t.created_at,
            -- Running sum of all *later* transactions (window function, O(n))
            COALESCE(
                SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END)
                    OVER (
                        PARTITION BY t.user_id
                        ORDER BY t.created_at DESC, t.id DESC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                0
            ) AS sum_of_later_txns
        FROM wallet_transactions t
        WHERE t.user_id = p_user_id
          AND (p_source_filter = 'all' OR t.source = p_source_filter)
          AND (p_type_filter   = 'all' OR t.type   = p_type_filter)
          AND (p_start_date IS NULL    OR t.created_at >= p_start_date)
          AND (p_end_date   IS NULL    OR t.created_at <= p_end_date)
    ),
    wallet_bal AS (
        SELECT COALESCE(balance, 0) AS balance
        FROM wallets
        WHERE user_id = p_user_id
    )
    SELECT
        t.id,
        t.amount::DECIMAL,
        t.type::TEXT,
        t.description::TEXT,
        t.reference::TEXT,
        t.source::TEXT,
        t.status::TEXT,
        t.created_at,
        (w.balance
            - t.sum_of_later_txns
            - CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END
        )::DECIMAL AS balance_before,
        (w.balance - t.sum_of_later_txns)::DECIMAL AS balance_after
    FROM all_txns t, wallet_bal w
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$function$
;

-- ===== get_wallet_overview () =====
CREATE OR REPLACE FUNCTION public.get_wallet_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_bal DECIMAL := 0;
    v_user_count INT := 0;
    v_shop_bal DECIMAL := 0;
    v_shop_count INT := 0;
BEGIN
    -- Regular User Wallets (Exclude Admins if preferred, or include all valid users)
    SELECT COALESCE(SUM(w.balance), 0), COUNT(w.id) 
    INTO v_user_bal, v_user_count
    FROM public.wallets w
    JOIN public.users u ON u.id = w.user_id
    WHERE u.role NOT IN ('admin', 'sub-admin') AND w.balance > 0;

    -- Shop Owner Wallets
    SELECT COALESCE(SUM(balance), 0), COUNT(id) 
    INTO v_shop_bal, v_shop_count
    FROM public.shop_wallets
    WHERE balance > 0;

    RETURN jsonb_build_object(
        'total_user_balance', v_user_bal,
        'user_count', v_user_count,
        'total_shop_owner_balance', v_shop_bal,
        'shop_owner_count', v_shop_count
    );
END;
$function$
;

-- ===== get_wallet_overview_v2 () =====
CREATE OR REPLACE FUNCTION public.get_wallet_overview_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_bal DECIMAL := 0;
    v_user_count INT := 0;
    v_shop_bal DECIMAL := 0;
    v_shop_count INT := 0;
    v_commission_bal DECIMAL := 0;
    v_commission_count INT := 0;
BEGIN
    SELECT COALESCE(SUM(w.balance), 0), COUNT(w.id)
    INTO v_user_bal, v_user_count
    FROM public.wallets w
    JOIN public.users u ON u.id = w.user_id
    WHERE u.role NOT IN ('admin', 'sub-admin') AND w.balance > 0;

    SELECT COALESCE(SUM(balance), 0), COUNT(id)
    INTO v_shop_bal, v_shop_count
    FROM public.shop_wallets
    WHERE balance > 0;

    -- commission_wallets holds BOTH recruiter sub-agent margin AND airtime/
    -- utility partner-commission shares â€” both credited via the same table
    -- (spec Â§1, Â§2). One combined liability figure; no product-level split
    -- needed here, the profit engine's recruiter_payout/partner_payout
    -- figures (Task 2's get_profit_summary_v2) already break that down.
    SELECT COALESCE(SUM(balance), 0), COUNT(id)
    INTO v_commission_bal, v_commission_count
    FROM public.commission_wallets
    WHERE balance > 0;

    RETURN jsonb_build_object(
        'total_user_balance', v_user_bal,
        'user_count', v_user_count,
        'total_shop_owner_balance', v_shop_bal,
        'shop_owner_count', v_shop_count,
        'total_commission_balance', v_commission_bal,
        'commission_count', v_commission_count
    );
END;
$function$
;

-- ===== get_wallet_stats (role_filter text) =====
CREATE OR REPLACE FUNCTION public.get_wallet_stats(role_filter text DEFAULT 'all'::text)
 RETURNS TABLE(total_balance numeric, total_credited numeric, total_spent numeric, user_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(w.balance), 0) as total_balance,
    COALESCE(SUM(w.total_credited), 0) as total_credited,
    COALESCE(SUM(w.total_spent), 0) as total_spent,
    COUNT(w.id) as user_count
  FROM wallets w
  JOIN users u ON w.user_id = u.id
  WHERE 
    CASE 
      WHEN role_filter = 'all' THEN true
      ELSE u.role = role_filter
    END;
END;
$function$
;

-- ===== guard_users_privilege_change () =====
CREATE OR REPLACE FUNCTION public.guard_users_privilege_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      raise exception 'SECURITY: changing account role is not permitted for this session';
    end if;
    if new.agent_expires_at is distinct from old.agent_expires_at
       or new.dealer_expires_at is distinct from old.dealer_expires_at then
      raise exception 'SECURITY: changing reseller expiry is not permitted for this session';
    end if;
    if new.status is distinct from old.status then
      raise exception 'SECURITY: changing account status is not permitted for this session';
    end if;
    if new.pin_hash is distinct from old.pin_hash
       or new.pin_salt is distinct from old.pin_salt
       or new.pin_attempts is distinct from old.pin_attempts
       or new.pin_locked_until is distinct from old.pin_locked_until then
      raise exception 'SECURITY: app-lock PIN can only be changed through the PIN service';
    end if;
    if new.email is distinct from old.email then
      raise exception 'SECURITY: email can only be changed through account support';
    end if;
    if (new.phone_number is distinct from old.phone_number
        or new.phone_verified is distinct from old.phone_verified)
       and old.phone_verified is true then
      raise exception 'SECURITY: a verified phone number can only be changed through the recovery flow';
    end if;
  end if;
  return new;
end;
$function$
;

-- ===== handle_new_user () =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_full_name  text;
  v_first_name text;
  v_last_name  text;
  v_space_pos  int;
BEGIN
  -- Prefer explicit first/last fields (email signup passes these).
  -- Fall back to full_name / name (Google OAuth sends these).
  v_full_name  := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name',      ''),
      ''
  );

  v_first_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      SPLIT_PART(v_full_name, ' ', 1),
      ''
  );

  -- Everything after the first space becomes last_name.
  v_space_pos  := POSITION(' ' IN v_full_name);
  v_last_name  := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
      CASE WHEN v_space_pos > 0
           THEN SUBSTRING(v_full_name FROM v_space_pos + 1)
           ELSE ''
      END,
      ''
  );

  INSERT INTO public.users (id, email, first_name, last_name, phone_number, role, status)
  VALUES (
      NEW.id,
      NEW.email,
      v_first_name,
      v_last_name,
      -- NULL (not '') when phone absent â€” avoids UNIQUE constraint violation
      -- for multiple OAuth users who have not provided a phone number yet.
      NULLIF(NEW.raw_user_meta_data->>'phone_number', ''),
      'customer',
      'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

-- ===== handle_new_user_wallet () =====
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

-- ===== increment_ussd_session_step (p_session_id text, p_mobile text, p_operator text, p_platform text) =====
CREATE OR REPLACE FUNCTION public.increment_ussd_session_step(p_session_id text, p_mobile text, p_operator text, p_platform text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    INSERT INTO public.ussd_sessions (session_id, mobile, operator, platform, steps, updated_at)
    VALUES (p_session_id, p_mobile, p_operator, p_platform, 1, NOW())
    ON CONFLICT (session_id) DO UPDATE
        SET steps = public.ussd_sessions.steps + 1,
            updated_at = NOW();
$function$
;

-- ===== increment_wallet_total_credited (p_user_id uuid, p_amount numeric) =====
CREATE OR REPLACE FUNCTION public.increment_wallet_total_credited(p_user_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  UPDATE wallets
  SET
    total_credited = COALESCE(total_credited, 0) + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
$function$
;

-- ===== is_admin () =====
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'sub-admin')
  );
$function$
;

-- ===== log_admin_settings_change () =====
CREATE OR REPLACE FUNCTION public.log_admin_settings_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    IF NEW.key IN (
        'paystack_fee_percent','agent_paystack_fee_percent','dealer_paystack_fee_percent',
        'paystack_min_topup','paystack_max_topup','mtn_price_adjustment','agent_upgrade_price',
        'auto_fulfillment_enabled','ussd_enabled','phone_verification_enabled','page_access_storefront',
        'data_network_stock'
    ) AND (TG_OP = 'INSERT' OR NEW.value IS DISTINCT FROM OLD.value) THEN
        INSERT INTO public.admin_settings_audit(key, old_value, new_value, changed_by, source)
        VALUES (NEW.key,
                CASE WHEN TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
                NEW.value, auth.uid(), 'settings');
    END IF;
    RETURN NEW;
END;
$function$
;

-- ===== log_main_profit () =====
CREATE OR REPLACE FUNCTION public.log_main_profit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Strict checking: ONLY on transition to 'completed' with valid cost constraint
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.cost_price_at_time > 0 AND NEW.shop_order_id IS NULL 
  THEN
    -- Prevent Duplicate Inserts explicitly
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_profit_logs 
      WHERE transaction_type = 'main' AND transaction_id = NEW.id
    ) THEN
        INSERT INTO public.admin_profit_logs (
          transaction_type, transaction_id, channel, role_at_time, 
          selling_price, admin_cost, profit, calculation_note
        ) VALUES (
          'main', NEW.id, 'main', NEW.role_at_time,
          NEW.price, NEW.cost_price_at_time, NEW.price - NEW.cost_price_at_time,
          format('Main order: %s (selling) - %s (cost) = %s %s | role: %s', 
            NEW.price, NEW.cost_price_at_time, NEW.price - NEW.cost_price_at_time,
            CASE WHEN (NEW.price - NEW.cost_price_at_time) < 0 THEN 'LOSS' ELSE 'PROFIT' END,
            COALESCE(NEW.role_at_time, 'unknown'))
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== log_rc_profit () =====
CREATE OR REPLACE FUNCTION public.log_rc_profit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_selling NUMERIC;
  v_admin_cost    NUMERIC;
BEGIN
  IF NEW.status = 'completed'
    AND (OLD.status IS NULL OR OLD.status <> 'completed')
    AND NEW.cost_price_at_time IS NOT NULL
    AND NEW.cost_price_at_time > 0
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_profit_logs
      WHERE transaction_type = 'results_checker' AND transaction_id = NEW.id
    ) THEN
      v_admin_selling := NEW.total_paid
                         - COALESCE(NEW.shop_markup, 0) * NEW.quantity
                         - COALESCE(NEW.fee_amount, 0);
      v_admin_cost    := NEW.cost_price_at_time * NEW.quantity;

      INSERT INTO public.admin_profit_logs (
        transaction_type, transaction_id, channel, role_at_time,
        selling_price, admin_cost, profit, calculation_note
      ) VALUES (
        'results_checker', NEW.id, 'results_checker', NEW.user_role,
        v_admin_selling, v_admin_cost, v_admin_selling - v_admin_cost,
        format(
          'RC admin profit: %s admin-revenue - %s cost (%sx %s) = %s %s | markup %s, fee %s excluded | ref: %s',
          v_admin_selling, v_admin_cost, NEW.quantity, COALESCE(NEW.type_name, 'unknown'),
          v_admin_selling - v_admin_cost,
          CASE WHEN (v_admin_selling - v_admin_cost) < 0 THEN 'LOSS' ELSE 'PROFIT' END,
          COALESCE(NEW.shop_markup, 0) * NEW.quantity, COALESCE(NEW.fee_amount, 0),
          COALESCE(NEW.reference_code, 'N/A')
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== log_shop_profit () =====
CREATE OR REPLACE FUNCTION public.log_shop_profit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Strict checking: ONLY on transition to 'completed' with valid admin cost
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.admin_cost_at_time IS NOT NULL AND NEW.admin_cost_at_time > 0 
  THEN
    -- Prevent Duplicate Inserts Explicitly
    IF NOT EXISTS (
       SELECT 1 FROM public.admin_profit_logs 
       WHERE transaction_type = 'shop' AND transaction_id = NEW.id
    ) THEN
        INSERT INTO public.admin_profit_logs (
          transaction_type, transaction_id, channel, role_at_time, 
          amount_paid_to_admin, admin_cost, profit, calculation_note
        ) VALUES (
          'shop', NEW.id, 'shop', NEW.owner_role_at_time,
          NEW.cost_price, NEW.admin_cost_at_time, NEW.cost_price - NEW.admin_cost_at_time,
          format('Shop order: %s (owner paid) - %s (admin cost) = %s %s | role: %s', 
            NEW.cost_price, NEW.admin_cost_at_time, NEW.cost_price - NEW.admin_cost_at_time,
            CASE WHEN (NEW.cost_price - NEW.admin_cost_at_time) < 0 THEN 'LOSS' ELSE 'PROFIT' END,
            COALESCE(NEW.owner_role_at_time, 'unknown'))
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== mark_shop_order_refunded (p_shop_order_id uuid, p_actor_id uuid, p_reason text, p_reverse_profit boolean) =====
CREATE OR REPLACE FUNCTION public.mark_shop_order_refunded(p_shop_order_id uuid, p_actor_id uuid, p_reason text, p_reverse_profit boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_so public.shop_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_so FROM public.shop_orders WHERE id = p_shop_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','shop_order_not_found'); END IF;
  IF v_so.status = 'refunded' THEN RETURN jsonb_build_object('ok',true,'already_refunded',true); END IF;
  IF v_so.status NOT IN ('pending','processing','failed') THEN
    RETURN jsonb_build_object('ok',false,'error','not_refundable','status',v_so.status); END IF;

  IF p_reverse_profit THEN PERFORM public.reverse_shop_profit(p_shop_order_id, p_actor_id, p_reason); END IF;

  UPDATE public.shop_orders SET status='refunded', refund_method='paystack',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason WHERE id = p_shop_order_id;
  UPDATE public.orders SET status='refunded', payment_status='refunded',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason, updated_at=now()
    WHERE shop_order_id = p_shop_order_id AND status <> 'refunded';
  UPDATE public.airtime_orders SET status='refunded',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason, updated_at=now()
    WHERE reference_code IN (SELECT reference_code FROM public.orders WHERE shop_order_id = p_shop_order_id)
      AND status <> 'refunded';
  RETURN jsonb_build_object('ok',true,'refunded',true);
END; $function$
;

-- ===== normalize_gh_phone (p_phone text) =====
CREATE OR REPLACE FUNCTION public.normalize_gh_phone(p_phone text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN d IS NULL THEN NULL
    WHEN length(d) = 12 AND left(d, 3) = '233' THEN '0' || substring(d FROM 4)
    WHEN length(d) = 10 AND left(d, 1) = '0'   THEN d
    ELSE NULL
  END
  FROM (SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g') AS d) s
$function$
;

-- ===== order_has_payment_evidence (p_order orders) =====
CREATE OR REPLACE FUNCTION public.order_has_payment_evidence(p_order orders)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    SELECT
        EXISTS (
            SELECT 1 FROM public.wallet_transactions d
             WHERE d.user_id = p_order.user_id
               AND d.type = 'debit'
               AND (   d.reference IN (p_order.reference_code, p_order.id::text,
                                       'USSD-WALLET-' || substr(p_order.reference_code, 6))
                    OR d.reference LIKE 'RETRY-' || p_order.id::text || '%'
                    OR d.description ILIKE '%' || replace(replace(replace(p_order.reference_code, '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'))
     OR EXISTS (
            SELECT 1 FROM public.order_retry_attempts a
             WHERE a.new_order_id = p_order.id AND coalesce(a.charged_amount, 0) > 0)
     OR EXISTS (
            SELECT 1 FROM public.ussd_pending_orders u
             WHERE u.hubtel_order_id IS NOT NULL AND u.status = 'fulfilled'
               AND ('USSD-DATA-' || upper(replace(u.session_id, '-', ''))) = p_order.reference_code);
$function$
;

-- ===== process_afa_order (p_user_id uuid, p_amount numeric, p_form_data jsonb, p_reference_code text) =====
CREATE OR REPLACE FUNCTION public.process_afa_order(p_user_id uuid, p_amount numeric, p_form_data jsonb, p_reference_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_wallet_id      UUID;
    v_wallet_balance NUMERIC;
    v_new_balance    NUMERIC;
    v_transaction_id UUID;
    v_order_id       UUID;
BEGIN
    SELECT id, balance
        INTO v_wallet_id, v_wallet_balance
        FROM public.wallets
        WHERE user_id = p_user_id
        FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF v_wallet_balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    UPDATE public.wallets
        SET
            balance     = balance - p_amount,
            total_spent = COALESCE(total_spent, 0) + p_amount,
            updated_at  = NOW()
        WHERE id = v_wallet_id
        RETURNING balance INTO v_new_balance;

    INSERT INTO public.wallet_transactions (
        wallet_id, user_id, type, amount, description,
        reference, source, status, metadata
    ) VALUES (
        v_wallet_id, p_user_id, 'debit', p_amount,
        'MTN AFA Registration Fee',
        p_reference_code, 'purchase', 'completed',
        jsonb_build_object('category', 'afa_order', 'source', 'afa_registration')
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.afa_orders (
        user_id, full_name, phone, ghana_card, id_type, id_number,
        location, region, occupation, date_of_birth, notes, status,
        payment_amount, payment_method, reference_code, transaction_id
    ) VALUES (
        p_user_id,
        p_form_data->>'full_name',
        p_form_data->>'phone',
        p_form_data->>'id_number',
        'Ghana Card',
        p_form_data->>'id_number',
        p_form_data->>'location',
        p_form_data->>'region',
        'Farmer',
        (p_form_data->>'date_of_birth')::DATE,
        p_form_data->>'notes',
        'pending',
        p_amount,
        'wallet',
        p_reference_code,
        v_transaction_id
    )
    RETURNING id INTO v_order_id;

    RETURN json_build_object(
        'order_id',       v_order_id,
        'transaction_id', v_transaction_id,
        'new_balance',    v_new_balance
    );
END;
$function$
;

-- ===== process_commission_withdrawal (p_wallet_id uuid, p_amount numeric, p_fee numeric, p_net_amount numeric, p_account_name text, p_momo_number text, p_network text, p_description text, p_owner_id uuid, p_name_verified boolean) =====
CREATE OR REPLACE FUNCTION public.process_commission_withdrawal(p_wallet_id uuid, p_amount numeric, p_fee numeric, p_net_amount numeric, p_account_name text, p_momo_number text, p_network text, p_description text, p_owner_id uuid, p_name_verified boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_wallet record; v_tx_id uuid;
BEGIN
  SELECT * INTO v_wallet FROM public.commission_wallets
   WHERE id = p_wallet_id AND owner_id = COALESCE(auth.uid(), p_owner_id) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_net_amount IS NULL OR p_net_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  IF round(p_amount - p_fee, 2) <> round(p_net_amount, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE public.commission_wallets
     SET balance = balance - p_amount, total_withdrawn = COALESCE(total_withdrawn, 0) + p_amount, updated_at = now()
   WHERE id = p_wallet_id;
  INSERT INTO public.commission_wallet_transactions
    (commission_wallet_id, type, amount, fee, net_amount, description, status, momo_number, network, account_name, name_verified)
  VALUES (p_wallet_id, 'withdrawal', p_amount, p_fee, p_net_amount, p_description, 'pending', p_momo_number, p_network, p_account_name, p_name_verified)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'net_amount', p_net_amount, 'fee', p_fee);
END $function$
;

-- ===== process_shop_withdrawal (p_wallet_id uuid, p_amount numeric, p_fee numeric, p_net_amount numeric, p_account_name text, p_momo_number text, p_account_number text, p_network text, p_payment_type text, p_bank_id text, p_bank_name text, p_branch text, p_description text, p_owner_id uuid, p_name_verified boolean) =====
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
    v_computed_fee := (p_amount * v_pct / 100.0) + v_flat;
    v_fee := GREATEST(COALESCE(p_fee, 0), v_computed_fee);
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
$function$
;

-- ===== process_ussd_wallet_payment (p_user_id uuid, p_amount numeric, p_description text, p_reference text) =====
CREATE OR REPLACE FUNCTION public.process_ussd_wallet_payment(p_user_id uuid, p_amount numeric, p_description text, p_reference text)
 RETURNS TABLE(wallet_id uuid, new_balance numeric, already_processed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_wallet_id uuid;
    v_new_balance numeric;
BEGIN
    INSERT INTO public.wallet_transactions
        (wallet_id, user_id, type, amount, description, reference, source, status)
    SELECT w.id, p_user_id, 'debit', p_amount, p_description, p_reference, 'ussd', 'pending'
    FROM public.wallets w
    WHERE w.user_id = p_user_id
    ON CONFLICT (reference) WHERE source = 'ussd' DO NOTHING
    RETURNING public.wallet_transactions.wallet_id INTO v_wallet_id;

    IF v_wallet_id IS NULL THEN
        SELECT wt.wallet_id, w.balance INTO v_wallet_id, v_new_balance
        FROM public.wallet_transactions wt
        JOIN public.wallets w ON w.id = wt.wallet_id
        WHERE wt.reference = p_reference AND wt.source = 'ussd';

        IF v_wallet_id IS NULL THEN
            RAISE EXCEPTION 'WALLET_NOT_FOUND';
        END IF;

        RETURN QUERY SELECT v_wallet_id, v_new_balance, true;
        RETURN;
    END IF;

    UPDATE public.wallets
    SET balance     = balance - p_amount,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at  = NOW()
    WHERE id = v_wallet_id
      AND balance >= p_amount
    RETURNING balance INTO v_new_balance;

    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    UPDATE public.wallet_transactions
    SET status = 'completed'
    WHERE public.wallet_transactions.wallet_id = v_wallet_id
      AND public.wallet_transactions.reference = p_reference
      AND public.wallet_transactions.source = 'ussd';

    RETURN QUERY SELECT v_wallet_id, v_new_balance, false;
END;
$function$
;

-- ===== protect_shop_admin_columns () =====
CREATE OR REPLACE FUNCTION public.protect_shop_admin_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only enforce restriction for standard authenticated users (shop owners).
  -- Server-side calls using the service role bypass RLS entirely and
  -- are NOT subject to this trigger guard (auth.role() will be null or 'service_role').
  IF auth.role() = 'authenticated' THEN
    -- Force sensitive admin-only columns to remain unchanged
    NEW.paystack_fee_percent      := OLD.paystack_fee_percent;
    NEW.withdrawal_fee_percent    := OLD.withdrawal_fee_percent;
    NEW.withdrawal_fee_flat       := OLD.withdrawal_fee_flat;
    NEW.min_withdrawal_amount     := OLD.min_withdrawal_amount;
    NEW.approval_status           := OLD.approval_status;
    NEW.fulfillment_mode          := OLD.fulfillment_mode;
    NEW.is_active                 := OLD.is_active;
    NEW.approved_by               := OLD.approved_by;
    NEW.approved_at               := OLD.approved_at;
    -- utilities_enabled is money-eligibility state: app/api/shop/utility-settings/route.ts
    -- gates enabling it behind an agent/dealer role check, and credit_utility_commission's
    -- shop_id branch pays commission with NO role re-check on the strength of that gate.
    -- Without pinning it here, an authenticated owner could PATCH shop_profiles directly
    -- via the REST API and self-enable, bypassing the role gate entirely. The legitimate
    -- write goes through the service-role client, which this guard does not apply to.
    NEW.utilities_enabled         := OLD.utilities_enabled;
    -- Owner pricing: only app/api/shop/pricing/route.ts (service role) may change these â€”
    -- it clamps negatives and enforces the fee caps; a direct write could do neither.
    NEW.airtime_fee_mtn                   := OLD.airtime_fee_mtn;
    NEW.airtime_fee_telecel               := OLD.airtime_fee_telecel;
    NEW.airtime_fee_at                    := OLD.airtime_fee_at;
    NEW.mashup_fee_percent                := OLD.mashup_fee_percent;
    NEW.results_checker_markup_customer   := OLD.results_checker_markup_customer;
    NEW.results_checker_markup_agent      := OLD.results_checker_markup_agent;
    NEW.results_checker_markup_dealer     := OLD.results_checker_markup_dealer;
    NEW.afa_fee_percent                   := OLD.afa_fee_percent;
    NEW.afa_selling_price                 := OLD.afa_selling_price;
  END IF;
  RETURN NEW;
END;
$function$
;

-- ===== protect_shop_pricing_updates () =====
CREATE OR REPLACE FUNCTION public.protect_shop_pricing_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    -- Lock profit_margin from ever being changed after creation
    IF NEW.profit_margin != OLD.profit_margin THEN
        RAISE EXCEPTION 'profit_margin cannot be changed after creation';
    END IF;
    RETURN NEW;
END;
$function$
;

-- ===== publish_terms_version (p_version text, p_effective_date date, p_sections jsonb, p_changelog jsonb, p_requires boolean, p_created_by uuid) =====
CREATE OR REPLACE FUNCTION public.publish_terms_version(p_version text, p_effective_date date, p_sections jsonb, p_changelog jsonb, p_requires boolean, p_created_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.terms_versions SET is_current = false WHERE is_current = true;

  INSERT INTO public.terms_versions
    (version, effective_date, sections, changelog, requires_reacceptance, is_current, created_by, published_at)
  VALUES
    (p_version, p_effective_date, p_sections, p_changelog, p_requires, true, p_created_by, now())
  ON CONFLICT (version) DO UPDATE SET
    effective_date        = EXCLUDED.effective_date,
    sections              = EXCLUDED.sections,
    changelog             = EXCLUDED.changelog,
    requires_reacceptance = EXCLUDED.requires_reacceptance,
    is_current            = true,
    created_by            = EXCLUDED.created_by,
    published_at          = now();
END;
$function$
;

-- ===== purchase_sms_bundle (p_owner_id uuid, p_bundle_id uuid, p_paid_from text) =====
CREATE OR REPLACE FUNCTION public.purchase_sms_bundle(p_owner_id uuid, p_bundle_id uuid, p_paid_from text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_shop_id     UUID;
    v_credits     INTEGER;
    v_price       NUMERIC;
    v_rows        INTEGER;
    v_purchase_id UUID;
BEGIN
    IF p_paid_from NOT IN ('wallet', 'profit') THEN
        RAISE EXCEPTION 'INVALID_SOURCE';
    END IF;

    SELECT id INTO v_shop_id FROM shop_profiles WHERE owner_id = p_owner_id;
    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'SHOP_NOT_FOUND';
    END IF;

    -- Must be activated first â€” server-side enforcement, not just UI
    IF NOT EXISTS (SELECT 1 FROM shop_sms_activations WHERE shop_id = v_shop_id) THEN
        RAISE EXCEPTION 'NOT_ACTIVATED';
    END IF;

    -- Price/credits come from the admin-configured bundle row only
    SELECT credits, price INTO v_credits, v_price
    FROM shop_sms_bundles
    WHERE id = p_bundle_id AND is_active = true;
    IF v_credits IS NULL THEN
        RAISE EXCEPTION 'BUNDLE_NOT_FOUND';
    END IF;

    -- Atomic debit
    IF p_paid_from = 'wallet' THEN
        UPDATE wallets
        SET balance = balance - v_price,
            total_spent = COALESCE(total_spent, 0) + v_price,
            updated_at = now()
        WHERE user_id = p_owner_id AND balance >= v_price;
    ELSE
        UPDATE shop_wallets
        SET balance = balance - v_price,
            updated_at = now()
        WHERE owner_id = p_owner_id AND balance >= v_price;
    END IF;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    -- Credit the SMS wallet
    INSERT INTO shop_sms_wallets (shop_id, credits, total_purchased)
    VALUES (v_shop_id, v_credits, v_credits)
    ON CONFLICT (shop_id) DO UPDATE SET
        credits         = shop_sms_wallets.credits + v_credits,
        total_purchased = shop_sms_wallets.total_purchased + v_credits,
        updated_at      = now();

    INSERT INTO shop_sms_purchases (shop_id, owner_id, bundle_id, credits, price, paid_from)
    VALUES (v_shop_id, p_owner_id, p_bundle_id, v_credits, v_price, p_paid_from)
    RETURNING id INTO v_purchase_id;

    IF p_paid_from = 'wallet' THEN
        INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
        SELECT id, p_owner_id, 'debit', v_price, 'SMS bundle: ' || v_credits || ' credits',
               'SHOPSMS-' || v_purchase_id::text, 'purchase', 'completed'
        FROM wallets WHERE user_id = p_owner_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'credits_added', v_credits, 'price', v_price);
END;
$function$
;

-- ===== purchase_user_sms_credits (p_user_id uuid, p_bundle_id uuid, p_paid_from text, p_payment_reference text, p_verified_amount numeric, p_client_key text) =====
CREATE OR REPLACE FUNCTION public.purchase_user_sms_credits(p_user_id uuid, p_bundle_id uuid, p_paid_from text, p_payment_reference text DEFAULT NULL::text, p_verified_amount numeric DEFAULT NULL::numeric, p_client_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_acct        RECORD;
    v_bundle      RECORD;
    v_price       NUMERIC(10,2);
    v_key         TEXT;
    v_ledger_id   UUID;
    v_balance     INTEGER;
    v_purchase_id UUID;
BEGIN
    IF p_paid_from NOT IN ('wallet', 'momo') THEN
        RAISE EXCEPTION 'INVALID_SOURCE';
    END IF;

    SELECT a.*, w.credits AS wallet_credits
    INTO v_acct
    FROM sms_accounts a
    JOIN sms_wallets w ON w.account_id = a.id
    WHERE a.user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
    END IF;
    IF v_acct.status <> 'active' THEN
        RAISE EXCEPTION 'ACCOUNT_SUSPENDED';
    END IF;

    SELECT * INTO v_bundle FROM sms_bundles
    WHERE id = p_bundle_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUNDLE_NOT_FOUND';
    END IF;

    -- v2 GUARD: a bundle can only be bought by an account in its own mode
    -- (or a 'both'-mode bundle, purchasable from either mode).
    IF v_bundle.mode <> 'both' AND v_bundle.mode <> v_acct.mode THEN
        RAISE EXCEPTION 'BUNDLE_MODE_MISMATCH';
    END IF;

    v_price := v_bundle.price;   -- v2: business_price no longer consulted

    IF p_paid_from = 'momo' THEN
        IF p_payment_reference IS NULL OR length(trim(p_payment_reference)) < 6 THEN
            RAISE EXCEPTION 'MISSING_PAYMENT_REFERENCE';
        END IF;
        IF p_verified_amount IS NULL OR p_verified_amount <> v_price THEN
            RAISE EXCEPTION 'AMOUNT_MISMATCH';
        END IF;
        v_key := 'purchase:' || p_payment_reference;
    ELSE
        IF p_client_key IS NULL OR length(trim(p_client_key)) < 8 THEN
            RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
        END IF;
        v_key := 'purchase:' || p_client_key;
    END IF;

    -- Reserve the ledger key BEFORE moving any money.
    INSERT INTO sms_credit_ledger (account_id, delta, kind, idempotency_key, reference)
    VALUES (v_acct.id, v_bundle.credits, 'purchase', v_key, p_payment_reference)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_ledger_id;

    IF v_ledger_id IS NULL THEN
        RETURN jsonb_build_object('already_processed', true);
    END IF;

    IF p_paid_from = 'wallet' THEN
        PERFORM deduct_wallet_balance(p_user_id, v_price);
    END IF;

    UPDATE sms_wallets
    SET credits         = credits + v_bundle.credits,
        total_purchased = total_purchased + v_bundle.credits,
        updated_at      = now()
    WHERE account_id = v_acct.id
    RETURNING credits INTO v_balance;

    UPDATE sms_credit_ledger SET balance_after = v_balance WHERE id = v_ledger_id;

    INSERT INTO sms_purchases (account_id, user_id, bundle_id, credits, price, paid_from, payment_reference)
    VALUES (v_acct.id, p_user_id, p_bundle_id, v_bundle.credits, v_price, p_paid_from, p_payment_reference)
    RETURNING id INTO v_purchase_id;

    IF p_paid_from = 'wallet' THEN
        INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
        SELECT id, p_user_id, 'debit', v_price, 'SMS credits: ' || v_bundle.credits,
               'SMSCRED-' || v_purchase_id::text, 'purchase', 'completed'
        FROM wallets WHERE user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'already_processed', false,
        'credits_added', v_bundle.credits,
        'price', v_price,
        'balance', v_balance
    );
END;
$function$
;

-- ===== purge_old_sms_messages (p_months integer, p_limit integer) =====
CREATE OR REPLACE FUNCTION public.purge_old_sms_messages(p_months integer DEFAULT 12, p_limit integer DEFAULT 5000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM sms_messages
    WHERE id IN (
        SELECT id FROM sms_messages
        WHERE created_at < now() - make_interval(months => GREATEST(1, p_months))
        LIMIT GREATEST(1, LEAST(p_limit, 20000))
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$
;

-- ===== record_phone_recovery_attempt (p_user_id uuid, p_correct boolean) =====
CREATE OR REPLACE FUNCTION public.record_phone_recovery_attempt(p_user_id uuid, p_correct boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.phone_recovery_attempts;
  v_now timestamptz := now();
  v_count integer;
  v_locked_until timestamptz;
begin
  insert into public.phone_recovery_attempts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.phone_recovery_attempts
  where user_id = p_user_id
  for update;

  if v_now - v_row.window_started_at > interval '1 hour' then
    v_row.attempt_count := 0;
    v_row.window_started_at := v_now;
    v_row.locked_until := null;
    v_row.hard_locked := false;
  end if;

  if v_row.hard_locked then
    update public.phone_recovery_attempts
    set window_started_at = v_row.window_started_at, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'hard_locked');
  end if;

  if v_row.locked_until is not null and v_now < v_row.locked_until then
    update public.phone_recovery_attempts
    set window_started_at = v_row.window_started_at, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'locked', 'retry_at', v_row.locked_until);
  end if;

  if p_correct then
    update public.phone_recovery_attempts
    set attempt_count = 0, window_started_at = v_now, locked_until = null,
        hard_locked = false, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'ok');
  end if;

  v_count := v_row.attempt_count + 1;

  if v_count = 3 then
    v_locked_until := v_now + interval '1 minute';
    update public.phone_recovery_attempts
    set attempt_count = v_count, window_started_at = v_row.window_started_at,
        locked_until = v_locked_until, hard_locked = false, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'locked', 'retry_at', v_locked_until);
  elsif v_count = 6 then
    v_locked_until := v_now + interval '2 minutes';
    update public.phone_recovery_attempts
    set attempt_count = v_count, window_started_at = v_row.window_started_at,
        locked_until = v_locked_until, hard_locked = false, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'locked', 'retry_at', v_locked_until);
  elsif v_count >= 9 then
    update public.phone_recovery_attempts
    set attempt_count = v_count, window_started_at = v_row.window_started_at,
        locked_until = null, hard_locked = true, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'hard_locked');
  else
    update public.phone_recovery_attempts
    set attempt_count = v_count, window_started_at = v_row.window_started_at, updated_at = v_now
    where user_id = p_user_id;
    return jsonb_build_object('outcome', 'wrong', 'attempt_count', v_count);
  end if;
end;
$function$
;

-- ===== redeem_sub_invite (p_code text, p_user_id uuid) =====
CREATE OR REPLACE FUNCTION public.redeem_sub_invite(p_code text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite     public.shop_invites%ROWTYPE;
  v_existing   public.sub_agents%ROWTYPE;
  v_has_shop   boolean;
  v_inviter    uuid;
  v_inviter_sa public.sub_agents%ROWTYPE;
  v_depth      integer;
BEGIN
  IF p_code IS NULL OR length(btrim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_user');
  END IF;

  SELECT * INTO v_existing FROM public.sub_agents WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already_member', true,
      'status', v_existing.status, 'upline_shop_id', v_existing.upline_shop_id);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.shop_profiles WHERE owner_id = p_user_id) INTO v_has_shop;
  IF v_has_shop THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_shop_owner');
  END IF;

  SELECT * INTO v_invite FROM public.shop_invites WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invite_not_found'); END IF;
  IF v_invite.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invite_revoked'); END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_expired'); END IF;
  IF v_invite.max_uses IS NOT NULL AND v_invite.used_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_exhausted'); END IF;

  SELECT owner_id INTO v_inviter FROM public.shop_profiles WHERE id = v_invite.shop_id;
  IF v_inviter IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'upline_missing');
  END IF;
  IF v_inviter = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_self_recruit');
  END IF;

  v_depth := public.sub_chain_depth_above(v_invite.shop_id);
  IF v_depth >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_depth_reached');
  END IF;

  SELECT * INTO v_inviter_sa FROM public.sub_agents WHERE user_id = v_inviter;
  IF FOUND THEN
    IF v_inviter_sa.status <> 'active' OR NOT v_inviter_sa.may_recruit THEN
      RETURN jsonb_build_object('ok', false, 'error', 'inviter_cannot_recruit');
    END IF;
  END IF;

  INSERT INTO public.sub_agents (user_id, upline_shop_id, status, joined_via_invite)
    VALUES (p_user_id, v_invite.shop_id, 'pending', v_invite.id);
  UPDATE public.shop_invites SET used_count = used_count + 1 WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'created', true, 'status', 'pending', 'upline_shop_id', v_invite.shop_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', true, 'already_member', true);
END;
$function$
;

-- ===== refund_afa_order_wallet (p_afa_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.refund_afa_order_wallet(p_afa_order_id uuid, p_actor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ao public.afa_orders%ROWTYPE;
  v_wallet_id uuid;
  v_ref text;
  v_amount numeric;
BEGIN
  SELECT * INTO v_ao FROM public.afa_orders WHERE id = p_afa_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'order_not_found'); END IF;
  IF v_ao.status = 'refunded' THEN RETURN jsonb_build_object('ok', true, 'already_refunded', true); END IF;
  IF v_ao.status NOT IN ('pending', 'processing', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_refundable', 'status', v_ao.status); END IF;
  IF v_ao.shop_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shop_linked_use_owner_wallet'); END IF;
  IF v_ao.user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_wallet_user'); END IF;
  IF COALESCE(v_ao.payment_method, 'momo') <> 'wallet' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_wallet_paid'); END IF;

  -- cost_price is only populated on shop/ussd_shop rows; dashboard/API/USSD
  -- wallet-debited rows record the debited amount in payment_amount instead.
  v_amount := COALESCE(v_ao.cost_price, v_ao.payment_amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_amount_to_refund'); END IF;

  v_ref := 'REFUND-AFA-WALLET-' || p_afa_order_id::text;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_ao.user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_ao.user_id, 0) RETURNING id INTO v_wallet_id;
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_ao.user_id, 'credit', v_amount,
            'Refund for AFA registration ' || p_afa_order_id::text, v_ref, 'refund', 'completed');
  UPDATE public.wallets SET balance = balance + v_amount,
         total_spent = GREATEST(0, total_spent - v_amount) WHERE id = v_wallet_id;

  UPDATE public.afa_orders SET status = 'refunded', refund_method = 'wallet',
         refunded_by = p_actor_id, refunded_at = now(), refund_reason = p_reason, updated_at = now()
    WHERE id = p_afa_order_id;

  RETURN jsonb_build_object('ok', true, 'refunded', true, 'amount', v_amount);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok', true, 'already_refunded', true);
END;
$function$
;

-- ===== refund_airtime_wallet (p_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.refund_airtime_wallet(p_order_id uuid, p_actor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_o public.airtime_orders%ROWTYPE; v_ref text; v_wallet_id uuid; v_new_balance numeric;
BEGIN
  SELECT * INTO v_o FROM public.airtime_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
  IF v_o.status = 'refunded' THEN RETURN jsonb_build_object('ok',true,'already_refunded',true); END IF;
  IF v_o.status NOT IN ('pending','processing','failed') THEN
    RETURN jsonb_build_object('ok',false,'error','not_refundable','status',v_o.status); END IF;
  IF v_o.user_id IS NULL OR v_o.shop_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','not_retail_airtime'); END IF;

  v_ref := 'REFUND-AIRTIME-' || p_order_id::text;
  INSERT INTO public.wallets (user_id, balance) VALUES (v_o.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_o.user_id FOR UPDATE;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_o.user_id, 'credit', v_o.total_paid,
            'Refund for airtime order ' || v_o.reference_code, v_ref, 'refund', 'completed');
  UPDATE public.wallets SET balance = balance + v_o.total_paid,
         total_spent = GREATEST(0, total_spent - v_o.total_paid) WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;
  UPDATE public.airtime_orders SET status='refunded',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason, updated_at=now()
    WHERE id = p_order_id;
  RETURN jsonb_build_object('ok',true,'refunded',true,'amount',v_o.total_paid,'new_balance',v_new_balance);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',true,'already_refunded',true);
END $function$
;

-- ===== refund_order_wallet (p_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.refund_order_wallet(p_order_id uuid, p_actor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_o public.orders%ROWTYPE;
    v_ref text;
    v_wallet_id uuid;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
    IF v_o.payment_status = 'refunded' OR v_o.status = 'refunded' THEN
        RETURN jsonb_build_object('ok',true,'already_refunded',true);
    END IF;
    IF v_o.status NOT IN ('pending','processing','failed') THEN
        RETURN jsonb_build_object('ok',false,'error','not_refundable','status',v_o.status);
    END IF;
    IF v_o.user_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_wallet_user'); END IF;

    v_ref := 'REFUND-ORDER-' || p_order_id::text;
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_o.user_id FOR UPDATE;
    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance) VALUES (v_o.user_id, 0) RETURNING id INTO v_wallet_id;
    END IF;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_o.user_id, 'credit', v_o.price, 'Refund for order ' || v_o.reference_code, v_ref, 'refund', 'completed');
    UPDATE public.wallets SET balance = balance + v_o.price, total_spent = GREATEST(0, total_spent - v_o.price) WHERE id = v_wallet_id;
    UPDATE public.orders SET status='refunded', payment_status='refunded', refunded_by=p_actor_id,
        refunded_at=now(), refund_reason=p_reason, updated_at=now() WHERE id = p_order_id;

    BEGIN
        IF NOT public.order_has_payment_evidence(v_o) THEN
            INSERT INTO public.security_events (event_type, reference, expected_amount, order_type, detail)
            VALUES ('refund_without_payment_trace', v_o.reference_code, v_o.price, 'data',
                    jsonb_build_object('order_id', v_o.id, 'user_id', v_o.user_id, 'source', v_o.source,
                                       'payment_method', v_o.payment_method, 'refunded_by', p_actor_id,
                                       'refund_reference', v_ref));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object('ok',true,'refunded',true,'amount',v_o.price);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok',true,'already_refunded',true);
END;
$function$
;

-- ===== refund_shop_withdrawal (p_tx_id uuid, p_admin_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.refund_shop_withdrawal(p_tx_id uuid, p_admin_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_wallet_id UUID;
    v_amount NUMERIC;
    v_status TEXT;
    v_type TEXT;
    v_new_balance NUMERIC;
BEGIN
    SELECT shop_wallet_id, amount, status, type
      INTO v_wallet_id, v_amount, v_status, v_type
    FROM shop_wallet_transactions
    WHERE id = p_tx_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal transaction not found';
    END IF;
    IF v_type <> 'withdrawal' THEN
        RAISE EXCEPTION 'Not a withdrawal transaction';
    END IF;

    IF v_status = 'reversed' THEN
        RETURN jsonb_build_object('success', true, 'alreadyRefunded', true);
    END IF;
    IF v_status NOT IN ('pending', 'failed') THEN
        RAISE EXCEPTION 'Cannot refund a payout in status % â€” only pending or failed withdrawals are refundable', v_status;
    END IF;

    UPDATE shop_wallets
    SET balance = balance + v_amount,
        total_withdrawn = GREATEST(COALESCE(total_withdrawn, 0) - v_amount, 0),
        updated_at = NOW()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    UPDATE shop_wallet_transactions
    SET status = 'reversed',
        failure_reason = LEFT(COALESCE(p_reason, 'Refunded by admin'), 500),
        processed_by = p_admin_id,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_tx_id;

    RETURN jsonb_build_object('success', true, 'newBalance', v_new_balance, 'refunded', v_amount);
END;
$function$
;

-- ===== refund_sms_credits (p_shop_id uuid, p_credits integer) =====
CREATE OR REPLACE FUNCTION public.refund_sms_credits(p_shop_id uuid, p_credits integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;

    UPDATE shop_sms_wallets
    SET credits    = credits + p_credits,
        total_used = GREATEST(0, total_used - p_credits),
        updated_at = now()
    WHERE shop_id = p_shop_id;

    RETURN jsonb_build_object('success', true);
END;
$function$
;

-- ===== refund_ussd_wallet (p_user_id uuid, p_amount numeric, p_reference text, p_description text) =====
CREATE OR REPLACE FUNCTION public.refund_ussd_wallet(p_user_id uuid, p_amount numeric, p_reference text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_wallet_id   UUID;
    v_new_balance NUMERIC;
BEGIN
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.wallet_transactions
        WHERE reference = p_reference AND source = 'refund'
    ) THEN
        RETURN jsonb_build_object('already_processed', true);
    END IF;

    INSERT INTO public.wallet_transactions
        (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES
        (v_wallet_id, p_user_id, 'credit', p_amount, p_description, p_reference, 'refund', 'completed');

    UPDATE public.wallets
        SET balance        = balance + p_amount,
            total_credited = COALESCE(total_credited, 0) + p_amount,
            updated_at     = NOW()
        WHERE id = v_wallet_id
        RETURNING balance INTO v_new_balance;

    RETURN jsonb_build_object('already_processed', false, 'new_balance', v_new_balance);
END;
$function$
;

-- ===== refund_utility_wallet (p_utility_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.refund_utility_wallet(p_utility_order_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_order record; v_ref text; v_wallet_id uuid; v_new_balance numeric;
BEGIN
  UPDATE public.utility_orders
     SET status = 'refunded', payment_status = 'refunded',
         refunded_by = p_actor_id, refunded_at = now(), refund_reason = p_reason,
         updated_at = now()
   WHERE id = p_utility_order_id
     AND payment_method IN ('wallet','ussd_wallet','ussd_momo')
     AND shop_id IS NULL
     AND status IN ('pending','failed')
     AND payment_status = 'paid'
     AND user_id IS NOT NULL
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    SELECT * INTO v_order FROM public.utility_orders WHERE id = p_utility_order_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
    END IF;
    IF v_order.status = 'refunded' OR v_order.payment_status = 'refunded' THEN
      RETURN jsonb_build_object('success', true, 'already_refunded', true);
    END IF;
    IF v_order.user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No wallet owner');
    END IF;
    IF v_order.shop_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_wallet_payment');
    END IF;
    IF v_order.payment_method NOT IN ('wallet','ussd_wallet','ussd_momo') THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_wallet_payment');
    END IF;
    IF v_order.payment_status <> 'paid' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_paid', 'payment_status', v_order.payment_status);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'not_refundable', 'status', v_order.status);
  END IF;

  v_ref := 'REFUND-' || v_order.reference_code;

  INSERT INTO public.wallets (user_id, balance) VALUES (v_order.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_order.user_id FOR UPDATE;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_order.user_id, 'credit', v_order.amount,
            'Refund for utility order ' || v_order.reference_code, v_ref, 'refund', 'completed');
  UPDATE public.wallets SET balance = balance + v_order.amount,
         total_spent = GREATEST(0, total_spent - v_order.amount) WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

  RETURN jsonb_build_object('success', true, 'refunded', true, 'amount', v_order.amount, 'new_balance', v_new_balance);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', true, 'already_refunded', true);
END $function$
;

-- ===== register_numbers_manual (p_phones text[], p_actor_id uuid) =====
CREATE OR REPLACE FUNCTION public.register_numbers_manual(p_phones text[], p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_canon   text[];
  v_orders  integer := 0;
  v_shop    integer := 0;
BEGIN
  SELECT array_agg(DISTINCT n) INTO v_canon
  FROM (SELECT public.normalize_gh_phone(x) AS n FROM unnest(p_phones) AS x) s
  WHERE n IS NOT NULL;

  IF v_canon IS NULL OR array_length(v_canon, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_valid_phones');
  END IF;

  INSERT INTO public.number_registrations (phone_number, network, status, source, registered_at)
  SELECT p, 'MTN', 'registered', 'admin', now() FROM unnest(v_canon) AS p
  ON CONFLICT (phone_number) DO UPDATE
    SET status = 'registered', registered_at = now();

  UPDATE public.orders o
     SET status = 'pending', updated_at = now()
   WHERE o.status = 'queued'
     AND public.normalize_gh_phone(o.phone_number) = ANY (v_canon);
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  UPDATE public.shop_orders so
     SET status = 'pending', updated_at = now()
   WHERE so.status = 'queued'
     AND public.normalize_gh_phone(so.guest_phone) = ANY (v_canon);
  GET DIAGNOSTICS v_shop = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'registered', array_length(v_canon, 1), 'released_orders', v_orders, 'released_shop_orders', v_shop);
END;
$function$
;

-- ===== reject_commission_withdrawal (p_transaction_id uuid, p_admin_id uuid, p_note text) =====
CREATE OR REPLACE FUNCTION public.reject_commission_withdrawal(p_transaction_id uuid, p_admin_id uuid, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tx record;
BEGIN
  UPDATE public.commission_wallet_transactions
     SET status = 'failed', admin_note = p_note, processed_by = p_admin_id, processed_at = now(), updated_at = now()
   WHERE id = p_transaction_id AND type = 'withdrawal' AND status = 'pending'
  RETURNING * INTO v_tx;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_pending');
  END IF;

  UPDATE public.commission_wallets
     SET balance = balance + v_tx.amount, total_withdrawn = GREATEST(0, COALESCE(total_withdrawn, 0) - v_tx.amount), updated_at = now()
   WHERE id = v_tx.commission_wallet_id;
  INSERT INTO public.commission_wallet_transactions (commission_wallet_id, type, amount, description, status)
  VALUES (v_tx.commission_wallet_id, 'withdrawal_reversal', v_tx.amount, 'Withdrawal rejected: ' || COALESCE(p_note, ''), 'completed');

  RETURN jsonb_build_object('success', true, 'refunded', v_tx.amount);
END $function$
;

-- ===== release_expired_rc_reservations () =====
CREATE OR REPLACE FUNCTION public.release_expired_rc_reservations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.results_checker_inventory inv
  SET status = 'available', reserved_by_order = NULL, reservation_expires_at = NULL, updated_at = NOW()
  WHERE inv.status = 'reserved'
    AND inv.reservation_expires_at < NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.results_checker_orders o
      WHERE o.id = inv.reserved_by_order
        AND o.payment_status = 'completed'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

-- ===== release_registration_batch (p_batch_id uuid, p_actor_id uuid) =====
CREATE OR REPLACE FUNCTION public.release_registration_batch(p_batch_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batch   public.number_registration_batches%ROWTYPE;
  v_orders  integer := 0;
  v_shop    integer := 0;
BEGIN
  SELECT * INTO v_batch FROM public.number_registration_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  UPDATE public.number_registration_batches
     SET status = 'confirmed', confirmed_at = now(), confirmed_by = p_actor_id
   WHERE id = p_batch_id;

  UPDATE public.number_registrations
     SET status = 'registered', registered_at = now()
   WHERE batch_id = p_batch_id AND status <> 'registered';

  UPDATE public.orders o
     SET status = 'pending', updated_at = now()
   WHERE o.status = 'queued'
     AND public.normalize_gh_phone(o.phone_number) IN (
       SELECT phone_number FROM public.number_registrations WHERE batch_id = p_batch_id
     );
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  UPDATE public.shop_orders so
     SET status = 'pending', updated_at = now()
   WHERE so.status = 'queued'
     AND public.normalize_gh_phone(so.guest_phone) IN (
       SELECT phone_number FROM public.number_registrations WHERE batch_id = p_batch_id
     );
  GET DIAGNOSTICS v_shop = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'released_orders', v_orders, 'released_shop_orders', v_shop);
END;
$function$
;

-- ===== resolve_sub_withdrawal (p_actor_id uuid, p_tx_id uuid, p_action text, p_note text) =====
CREATE OR REPLACE FUNCTION public.resolve_sub_withdrawal(p_actor_id uuid, p_tx_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.shop_wallet_transactions%ROWTYPE;
  v_owner uuid; v_upline uuid; v_lead uuid; v_lead_eligible boolean;
BEGIN
  SELECT * INTO v_tx FROM public.shop_wallet_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND OR v_tx.type <> 'withdrawal' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_tx.status <> 'shop_owner_pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_pending_owner'); END IF;
  SELECT sw.owner_id INTO v_owner FROM public.shop_wallets sw WHERE sw.id = v_tx.shop_wallet_id;
  SELECT sa.upline_shop_id INTO v_upline FROM public.sub_agents sa WHERE sa.user_id = v_owner;
  SELECT owner_id INTO v_lead FROM public.shop_profiles WHERE id = v_upline;
  IF v_lead IS NULL OR v_lead <> p_actor_id THEN RETURN jsonb_build_object('ok', false, 'error', 'not_your_sub'); END IF;

  -- Lead must still be eligible to exercise approval authority. A suspended /
  -- rejected shop, or a Lead who is no longer a lifetime agent or active dealer,
  -- has no say â€” the row auto-escalates to admin via the escalation cron.
  SELECT COALESCE(
      (lu.role = 'agent'  AND lu.agent_expires_at IS NULL)
   OR (lu.role = 'dealer' AND lu.dealer_expires_at > now()), false)
  INTO v_lead_eligible
  FROM public.shop_profiles lp JOIN public.users lu ON lu.id = lp.owner_id
  WHERE lp.id = v_upline AND lp.approval_status NOT IN ('suspended','rejected');
  v_lead_eligible := COALESCE(v_lead_eligible, false);
  IF NOT v_lead_eligible THEN
    -- The Lead may have become ineligible AFTER submitting (e.g. dealer expiry),
    -- so the row could still carry its original +48h escalate_after. Pull it
    -- forward so the escalation cron forwards it to admin on the next tick
    -- instead of leaving the sub's funds in limbo. Row is already FOR UPDATE.
    UPDATE public.shop_wallet_transactions SET escalate_after = now(), updated_at = now() WHERE id = p_tx_id;
    RETURN jsonb_build_object('ok', false, 'error', 'lead_ineligible');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.shop_wallet_transactions
    SET status='pending', sub_approval_status='approved', sub_approved_by=p_actor_id, sub_approval_note=p_note, updated_at=now()
    WHERE id = p_tx_id;
    RETURN jsonb_build_object('ok', true, 'action', 'approved');
  ELSIF p_action = 'reject' THEN
    UPDATE public.shop_wallets
    SET balance = balance + v_tx.amount, total_withdrawn = GREATEST(0, COALESCE(total_withdrawn,0) - v_tx.amount), updated_at=now()
    WHERE id = v_tx.shop_wallet_id;
    UPDATE public.shop_wallet_transactions
    SET status='reversed', sub_approval_status='rejected', sub_approved_by=p_actor_id, sub_approval_note=p_note, updated_at=now()
    WHERE id = p_tx_id;
    RETURN jsonb_build_object('ok', true, 'action', 'rejected');
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
END;
$function$
;

-- ===== resubmit_withdrawal (p_transaction_id uuid, p_account_name text, p_momo_number text, p_network text) =====
CREATE OR REPLACE FUNCTION public.resubmit_withdrawal(p_transaction_id uuid, p_account_name text, p_momo_number text, p_network text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_current_note TEXT;
    v_new_note     TEXT;
BEGIN
    -- Get the current admin note
    SELECT admin_note INTO v_current_note
    FROM public.shop_wallet_transactions
    WHERE id = p_transaction_id
      AND status = 'rejected'
      AND shop_wallet_id IN (
          SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resubmission failed: transaction not found, not rejected, or does not belong to you.';
    END IF;

    -- Build the hardcoded audit trail note server-side
    v_new_note := '[RESUBMITTED] Previously rejected: "' || COALESCE(v_current_note, 'No reason given') || '". New payment details provided.';

    -- Perform the extremely restricted update
    UPDATE public.shop_wallet_transactions
    SET
        status       = 'pending',
        account_name = p_account_name,
        momo_number  = p_momo_number,
        network      = p_network,
        admin_note   = v_new_note,
        updated_at   = NOW()
    WHERE id = p_transaction_id;
END;
$function$
;

-- ===== resubmit_withdrawal (p_transaction_id uuid, p_account_name text, p_momo_number text, p_network text, p_admin_note text) =====
CREATE OR REPLACE FUNCTION public.resubmit_withdrawal(p_transaction_id uuid, p_account_name text, p_momo_number text, p_network text, p_admin_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.shop_wallet_transactions
    SET
        status       = 'pending',
        account_name = p_account_name,
        momo_number  = p_momo_number,
        network      = p_network,
        admin_note   = p_admin_note,
        updated_at   = NOW()
    WHERE id = p_transaction_id
      -- Must currently be rejected
      AND status = 'rejected'
      -- Must actually belong to the calling user
      AND shop_wallet_id IN (
          SELECT id FROM public.shop_wallets WHERE owner_id = auth.uid()
      );

    -- If no row was updated, raise an error so the client knows
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resubmission failed: transaction not found, not rejected, or does not belong to you.';
    END IF;
END;
$function$
;

-- ===== reverse_lead_margin (p_shop_order_id uuid, p_order_reference text) =====
CREATE OR REPLACE FUNCTION public.reverse_lead_margin(p_shop_order_id uuid DEFAULT NULL::uuid, p_order_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tx public.shop_wallet_transactions%ROWTYPE; v_rev_source text; v_already boolean;
BEGIN
  IF p_shop_order_id IS NOT NULL THEN
    SELECT * INTO v_tx FROM public.shop_wallet_transactions
      WHERE shop_order_id = p_shop_order_id AND type = 'profit' AND credit_source = 'order_parent'
      ORDER BY created_at LIMIT 1;
  ELSIF p_order_reference IS NOT NULL THEN
    SELECT * INTO v_tx FROM public.shop_wallet_transactions
      WHERE order_reference = p_order_reference AND type = 'profit' AND credit_source = 'wallet_sub_purchase'
      ORDER BY created_at LIMIT 1;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'no_key');
  END IF;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'nothing_to_reverse', true); END IF;
  v_rev_source := v_tx.credit_source || '_reversal';

  -- Lock the wallet BEFORE checking already-reversed (was: checked first, locked
  -- after) â€” closes the same class of TOCTOU fixed above in credit_shop_profit.
  PERFORM 1 FROM public.shop_wallets WHERE id = v_tx.shop_wallet_id FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM public.shop_wallet_transactions
    WHERE shop_wallet_id = v_tx.shop_wallet_id AND type = 'profit_reversal' AND credit_source = v_rev_source
      AND ((p_shop_order_id IS NOT NULL AND shop_order_id = p_shop_order_id)
        OR (p_order_reference IS NOT NULL AND order_reference = p_order_reference))
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('ok', true, 'already_reversed', true);
  END IF;

  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, shop_order_id, type, amount, status, description, credit_source, order_reference)
  VALUES (v_tx.shop_wallet_id, v_tx.shop_order_id, 'profit_reversal', v_tx.amount, 'completed',
     'Lead margin reversal for refunded sub-agent order', v_rev_source, v_tx.order_reference);
  UPDATE public.shop_wallets SET balance = balance - v_tx.amount,
      total_earned = GREATEST(0, total_earned - v_tx.amount), updated_at = now()
  WHERE id = v_tx.shop_wallet_id;
  RETURN jsonb_build_object('ok', true, 'reversed', true, 'amount', v_tx.amount);
END;
$function$
;

-- ===== reverse_shop_afa_profit (p_afa_order_id uuid) =====
CREATE OR REPLACE FUNCTION public.reverse_shop_afa_profit(p_afa_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id UUID;
  v_wallet_id UUID;
  v_profit_tx_id UUID;
  v_amount DECIMAL;
  v_existing_reversal_id UUID;
  v_new_balance DECIMAL;
BEGIN
  SELECT sp.owner_id
  INTO v_owner_id
  FROM public.afa_orders ao
  JOIN public.shop_profiles sp ON ao.shop_id = sp.id
  WHERE ao.id = p_afa_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  SELECT id INTO v_wallet_id
  FROM public.shop_wallets
  WHERE owner_id = v_owner_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    -- No wallet exists at all, so nothing could ever have been credited.
    RETURN jsonb_build_object('success', false, 'message', 'No profit to reverse');
  END IF;

  -- Find the original profit row for this order.
  SELECT id, amount INTO v_profit_tx_id, v_amount
  FROM public.shop_wallet_transactions
  WHERE afa_order_id = p_afa_order_id AND type = 'profit';

  IF v_profit_tx_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No profit to reverse');
  END IF;

  -- Idempotency check runs under the wallet lock acquired above.
  SELECT id INTO v_existing_reversal_id
  FROM public.shop_wallet_transactions
  WHERE afa_order_id = p_afa_order_id AND type = 'profit_reversal';

  IF v_existing_reversal_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already reversed');
  END IF;

  UPDATE public.shop_wallets
  SET
    balance = balance - v_amount,
    total_earned = GREATEST(0, total_earned - v_amount),
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.shop_wallet_transactions
    (shop_wallet_id, afa_order_id, type, amount, description, status)
  VALUES
    (v_wallet_id, p_afa_order_id, 'profit_reversal', v_amount, 'AFA Registration cancelled â€” profit reversed', 'completed');

  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Reversed ' || v_amount || ' â€” wallet balance is now negative (' || v_new_balance || ')');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Reversed ' || v_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- ===== reverse_shop_profit (p_shop_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.reverse_shop_profit(p_shop_order_id uuid, p_actor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_profit numeric; v_owner uuid; v_wallet_id uuid;
BEGIN
  SELECT so.profit, sp.owner_id INTO v_profit, v_owner
    FROM public.shop_orders so JOIN public.shop_profiles sp ON sp.id = so.shop_id
    WHERE so.id = p_shop_order_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok',false,'error','shop_order_not_found'); END IF;

  SELECT id INTO v_wallet_id FROM public.shop_wallets WHERE owner_id = v_owner FOR UPDATE;
  IF v_wallet_id IS NULL THEN RETURN jsonb_build_object('ok',true,'already_reversed',true); END IF;

  IF EXISTS (SELECT 1 FROM public.shop_wallet_transactions
             WHERE shop_order_id = p_shop_order_id AND type = 'profit_reversal') THEN
    RETURN jsonb_build_object('ok',true,'already_reversed',true); END IF;

  INSERT INTO public.shop_wallet_transactions (shop_wallet_id, shop_order_id, type, amount, status)
    VALUES (v_wallet_id, p_shop_order_id, 'profit_reversal', v_profit, 'completed');
  UPDATE public.shop_wallets SET balance = balance - v_profit,
         total_earned = GREATEST(0, total_earned - v_profit) WHERE id = v_wallet_id;
  RETURN jsonb_build_object('ok',true,'reversed',true,'amount',v_profit);
END; $function$
;

-- ===== rls_auto_enable () =====
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- ===== rotate_shop_invite (p_actor_id uuid, p_shop_id uuid) =====
CREATE OR REPLACE FUNCTION public.rotate_shop_invite(p_actor_id uuid, p_shop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner   uuid;
  v_code    text;
  v_attempt int := 0;
BEGIN
  -- Ownership re-check: the actor must own this shop.
  SELECT owner_id INTO v_owner FROM public.shop_profiles WHERE id = p_shop_id;
  IF v_owner IS NULL OR v_owner <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_shop');
  END IF;

  -- Retire every currently-active invite for this shop.
  UPDATE public.shop_invites
  SET revoked_at = now()
  WHERE shop_id = p_shop_id AND revoked_at IS NULL;

  -- Mint one fresh unlimited, non-expiring code; retry on UNIQUE(code) collision.
  LOOP
    v_attempt := v_attempt + 1;
    v_code := left(
      translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
      12
    );
    BEGIN
      INSERT INTO public.shop_invites (shop_id, code, max_uses, expires_at)
      VALUES (p_shop_id, v_code, NULL, NULL);
      RETURN jsonb_build_object('ok', true, 'code', v_code);
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'code_generation_failed');
      END IF;
    END;
  END LOOP;
END;
$function$
;

-- ===== save_shop_payment_detail_if_under_limit (p_owner_id uuid, p_account_name text, p_momo_number text, p_account_number text, p_network text, p_payment_type text, p_bank_id text, p_limit integer) =====
CREATE OR REPLACE FUNCTION public.save_shop_payment_detail_if_under_limit(p_owner_id uuid, p_account_name text, p_momo_number text, p_account_number text, p_network text, p_payment_type text, p_bank_id text, p_limit integer DEFAULT 5)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_count int;
    -- The caller may lower the cap, never raise it.
    v_limit int := LEAST(GREATEST(COALESCE(p_limit, 5), 0), 5);
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() != p_owner_id THEN
        RAISE EXCEPTION 'ACCESS_DENIED: You may only save your own payment details';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('shop_payment_details:' || p_owner_id::text, 0));

    SELECT COUNT(*) INTO v_count
    FROM public.shop_payment_details
    WHERE shop_owner_id = p_owner_id;

    IF v_count >= v_limit THEN
        -- At the limit: no insert. The withdraw route's post-withdrawal auto-save
        -- ignores this; POST /api/shop/payment-details reports it to the owner.
        RETURN false;
    END IF;

    INSERT INTO public.shop_payment_details (
        shop_owner_id, account_name, momo_number, account_number,
        network, payment_type, bank_id, is_default
    ) VALUES (
        p_owner_id, p_account_name, p_momo_number, p_account_number,
        p_network, p_payment_type, p_bank_id, v_count = 0
    );
    RETURN true;
END;
$function$
;

-- ===== set_sub_agent_state (p_actor_id uuid, p_sub_user_id uuid, p_action text, p_ceiling numeric, p_is_admin boolean) =====
CREATE OR REPLACE FUNCTION public.set_sub_agent_state(p_actor_id uuid, p_sub_user_id uuid, p_action text, p_ceiling numeric DEFAULT NULL::numeric, p_is_admin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sa    public.sub_agents%ROWTYPE;
  v_owner uuid;
BEGIN
  SELECT * INTO v_sa FROM public.sub_agents WHERE user_id = p_sub_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'sub_not_found'); END IF;

  SELECT owner_id INTO v_owner FROM public.shop_profiles WHERE id = v_sa.upline_shop_id;
  IF NOT p_is_admin AND (v_owner IS NULL OR v_owner <> p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_sub');
  END IF;

  IF p_action = 'approve' THEN
    IF v_sa.status = 'suspended' THEN RETURN jsonb_build_object('ok', false, 'error', 'suspended'); END IF;
    UPDATE public.sub_agents SET status='active', approved_by=p_actor_id, approved_at=now(), updated_at=now()
      WHERE user_id=p_sub_user_id;

  ELSIF p_action = 'suspend' THEN
    UPDATE public.sub_agents SET status='suspended', updated_at=now() WHERE user_id=p_sub_user_id;
    UPDATE public.shop_profiles SET is_active=false, updated_at=now() WHERE owner_id=p_sub_user_id;
    UPDATE public.shop_invites SET revoked_at = now()
      WHERE shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = p_sub_user_id)
        AND revoked_at IS NULL;

  ELSIF p_action = 'reactivate' THEN
    UPDATE public.sub_agents SET status='active', updated_at=now() WHERE user_id=p_sub_user_id;

  ELSIF p_action = 'set_ceiling' THEN
    IF p_ceiling IS NOT NULL AND p_ceiling < 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_ceiling'); END IF;
    UPDATE public.sub_agents SET markup_ceiling=p_ceiling, updated_at=now() WHERE user_id=p_sub_user_id;

  ELSIF p_action = 'grant_recruit' THEN
    IF public.sub_chain_depth_above(v_sa.upline_shop_id) >= 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'max_depth_reached');
    END IF;
    UPDATE public.sub_agents SET may_recruit=true, updated_at=now() WHERE user_id=p_sub_user_id;

  ELSIF p_action = 'revoke_recruit' THEN
    UPDATE public.sub_agents SET may_recruit=false, updated_at=now() WHERE user_id=p_sub_user_id;
    UPDATE public.shop_invites SET revoked_at = now()
      WHERE shop_id IN (SELECT id FROM public.shop_profiles WHERE owner_id = p_sub_user_id)
        AND revoked_at IS NULL;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', p_action);
END;
$function$
;

-- ===== settle_afa_refund_to_owner (p_afa_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.settle_afa_refund_to_owner(p_afa_order_id uuid, p_actor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ao public.afa_orders%ROWTYPE;
  v_owner uuid;
  v_wallet_id uuid;
  v_ref text;
BEGIN
  SELECT * INTO v_ao FROM public.afa_orders WHERE id = p_afa_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'order_not_found'); END IF;
  IF v_ao.status = 'refunded' THEN RETURN jsonb_build_object('ok', true, 'already_refunded', true); END IF;
  IF v_ao.status NOT IN ('pending', 'processing', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_refundable', 'status', v_ao.status); END IF;
  IF v_ao.shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_shop_linked'); END IF;
  IF v_ao.cost_price IS NULL OR v_ao.cost_price <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_cost_to_refund'); END IF;

  SELECT owner_id INTO v_owner FROM public.shop_profiles WHERE id = v_ao.shop_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'owner_not_found'); END IF;

  v_ref := 'REFUND-AFA-OWNER-' || p_afa_order_id::text;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_owner FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_owner, 0) RETURNING id INTO v_wallet_id;
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_owner, 'credit', v_ao.cost_price,
            'AFA order refund (cost) ' || p_afa_order_id::text, v_ref, 'refund', 'completed');
  UPDATE public.wallets SET balance = balance + v_ao.cost_price WHERE id = v_wallet_id;

  UPDATE public.afa_orders SET status = 'refunded', refund_method = 'owner_wallet',
         refunded_by = p_actor_id, refunded_at = now(), refund_reason = p_reason, updated_at = now()
    WHERE id = p_afa_order_id;

  RETURN jsonb_build_object('ok', true, 'settled', true, 'amount', v_ao.cost_price);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok', true, 'already_refunded', true);
END;
$function$
;

-- ===== settle_shop_refund_to_owner (p_shop_order_id uuid, p_actor_id uuid, p_reason text) =====
CREATE OR REPLACE FUNCTION public.settle_shop_refund_to_owner(p_shop_order_id uuid, p_actor_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_so public.shop_orders%ROWTYPE; v_owner uuid; v_wallet_id uuid; v_ref text;
BEGIN
  SELECT * INTO v_so FROM public.shop_orders WHERE id = p_shop_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','shop_order_not_found'); END IF;
  IF v_so.status = 'refunded' THEN RETURN jsonb_build_object('ok',true,'already_refunded',true); END IF;
  IF v_so.status NOT IN ('pending','processing','failed') THEN
    RETURN jsonb_build_object('ok',false,'error','not_refundable','status',v_so.status); END IF;

  SELECT owner_id INTO v_owner FROM public.shop_profiles WHERE id = v_so.shop_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok',false,'error','owner_not_found'); END IF;

  v_ref := 'REFUND-SHOP-OWNER-' || p_shop_order_id::text;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_owner FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_owner, 0) RETURNING id INTO v_wallet_id; END IF;

  -- credit COST ONLY to owner's personal retail wallet; profit stays in shop_wallets (kept, NOT reversed)
  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, reference, source, status)
    VALUES (v_wallet_id, v_owner, 'credit', v_so.cost_price,
            'Shop order refund (cost) ' || p_shop_order_id::text, v_ref, 'refund', 'completed');
  UPDATE public.wallets SET balance = balance + v_so.cost_price WHERE id = v_wallet_id;

  UPDATE public.shop_orders SET status='refunded', refund_method='owner_wallet',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason WHERE id = p_shop_order_id;
  UPDATE public.orders SET status='refunded', payment_status='refunded',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason, updated_at=now()
    WHERE shop_order_id = p_shop_order_id AND status <> 'refunded';
  -- storefront airtime mirror row shares reference_code (SHOP-*) with the orders mirror row
  UPDATE public.airtime_orders SET status='refunded',
         refunded_by=p_actor_id, refunded_at=now(), refund_reason=p_reason, updated_at=now()
    WHERE reference_code IN (SELECT reference_code FROM public.orders WHERE shop_order_id = p_shop_order_id)
      AND status <> 'refunded';

  RETURN jsonb_build_object('ok',true,'settled',true,'amount',v_so.cost_price);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('ok',true,'already_refunded',true);
END; $function$
;

-- ===== settle_sms_campaign (p_campaign_id uuid) =====
CREATE OR REPLACE FUNCTION public.settle_sms_campaign(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_camp        RECORD;
    v_failed      INTEGER;
    v_undispatched INTEGER;
    v_refund      INTEGER;
    v_final       TEXT;
    v_credit      JSONB;
BEGIN
    SELECT * INTO v_camp FROM sms_campaigns
    WHERE id = p_campaign_id AND status = 'processing'
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('settled', false, 'reason', 'NOT_PROCESSING');
    END IF;

    SELECT COUNT(*) FILTER (WHERE status = 'failed'),
           COUNT(*) FILTER (WHERE status = 'queued')
    INTO v_failed, v_undispatched
    FROM sms_messages WHERE campaign_id = p_campaign_id;

    -- Undispatched rows at settle time (dispatcher aborted): mark failed so
    -- they are refunded and never silently lost.
    IF v_undispatched > 0 THEN
        UPDATE sms_messages
        SET status = 'failed', status_detail = 'not dispatched', status_updated_at = now()
        WHERE campaign_id = p_campaign_id AND status = 'queued';
        v_failed := v_failed + v_undispatched;
    END IF;

    v_refund := v_failed * v_camp.segments;
    v_final  := CASE
        WHEN v_failed = 0 THEN 'completed'
        WHEN v_failed >= v_camp.recipients_count THEN 'failed'
        ELSE 'partial'
    END;

    IF v_refund > 0 THEN
        v_credit := credit_user_sms_credits(
            v_camp.account_id, v_refund,
            'refund:' || p_campaign_id::text, 'refund', p_campaign_id::text);
    END IF;

    UPDATE sms_campaigns
    SET status = v_final, settled_at = now()
    WHERE id = p_campaign_id;

    RETURN jsonb_build_object('settled', true, 'final_status', v_final,
        'failed_count', v_failed, 'refunded_credits', COALESCE(v_refund, 0));
END;
$function$
;

-- ===== shop_sms_usage_breakdown (p_shop_id uuid) =====
CREATE OR REPLACE FUNCTION public.shop_sms_usage_breakdown(p_shop_id uuid)
 RETURNS TABLE(source text, credits bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT l.source, COALESCE(SUM(l.credits_used), 0)::bigint
  FROM public.shop_sms_logs l
  WHERE l.shop_id = p_shop_id
  GROUP BY l.source;
$function$
;

-- ===== sub_chain_depth_above (p_shop_id uuid) =====
CREATE OR REPLACE FUNCTION public.sub_chain_depth_above(p_shop_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_depth   INTEGER := 0;
  v_shop    UUID := p_shop_id;
  v_owner   UUID;
  v_upline  UUID;
  i         INTEGER;
BEGIN
  FOR i IN 1..3 LOOP
    SELECT owner_id INTO v_owner FROM public.shop_profiles WHERE id = v_shop;
    IF v_owner IS NULL THEN RETURN v_depth; END IF;

    SELECT upline_shop_id INTO v_upline FROM public.sub_agents WHERE user_id = v_owner;
    IF v_upline IS NULL THEN RETURN v_depth; END IF;

    v_depth := v_depth + 1;
    v_shop  := v_upline;
  END LOOP;

  RETURN v_depth;
END;
$function$
;

-- ===== toggle_fulfillment_supplier_network (p_supplier_key text, p_network text, p_enable boolean) =====
CREATE OR REPLACE FUNCTION public.toggle_fulfillment_supplier_network(p_supplier_key text, p_network text, p_enable boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_raw jsonb;
  v_current jsonb;
  v_new jsonb;
  v_key text;
  v_allowed CONSTANT text[] := ARRAY[
    'networks', 'codecraft_networks', 'xpress_networks', 'ghdata_networks',
    'agentportal_networks', 'bundleportal_networks', 'hendylinks_networks',
    'atishare_console_networks', 'spfastit_networks'
  ];
BEGIN
  IF NOT (p_supplier_key = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'invalid_supplier_key: %', p_supplier_key;
  END IF;
  IF p_network IS NULL OR length(trim(p_network)) = 0 THEN
    RAISE EXCEPTION 'invalid_network';
  END IF;

  PERFORM 1 FROM public.admin_settings WHERE key = 'fulfillment_settings' FOR UPDATE;

  SELECT value INTO v_raw FROM public.admin_settings WHERE key = 'fulfillment_settings';

  IF v_raw IS NULL THEN
    v_current := '{}'::jsonb;
  ELSIF jsonb_typeof(v_raw) = 'string' THEN
    v_current := COALESCE(NULLIF(v_raw #>> '{}', ''), '{}')::jsonb;
  ELSE
    v_current := v_raw;
  END IF;

  v_new := v_current;
  FOREACH v_key IN ARRAY v_allowed LOOP
    IF v_key = p_supplier_key THEN
      v_new := jsonb_set(
        v_new, ARRAY[v_key],
        COALESCE(v_new -> v_key, '{}'::jsonb) || jsonb_build_object(p_network, p_enable),
        true
      );
    ELSIF p_enable THEN
      v_new := jsonb_set(
        v_new, ARRAY[v_key],
        COALESCE(v_new -> v_key, '{}'::jsonb) || jsonb_build_object(p_network, false),
        true
      );
    END IF;
  END LOOP;

  INSERT INTO public.admin_settings (key, value)
  VALUES ('fulfillment_settings', to_jsonb(v_new::text))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN v_new;
END;
$function$
;

-- ===== transfer_commission_wallet (p_owner_id uuid, p_amount numeric, p_destination text) =====
CREATE OR REPLACE FUNCTION public.transfer_commission_wallet(p_owner_id uuid, p_amount numeric, p_destination text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_wallet record; v_shop_wallet_id uuid; v_main_wallet_id uuid;
BEGIN
  IF p_destination NOT IN ('main', 'shop') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_destination');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  SELECT * INTO v_wallet FROM public.commission_wallets WHERE owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_commission_wallet');
  END IF;
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  IF p_destination = 'shop' THEN
    -- Deliberately requires a PRE-EXISTING shop wallet (unlike 'main' below,
    -- which auto-creates) â€” a commission holder with no storefront has no
    -- shop wallet to receive into, and we don't want to silently create one.
    SELECT id INTO v_shop_wallet_id FROM public.shop_wallets WHERE owner_id = p_owner_id FOR UPDATE;
    IF v_shop_wallet_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_shop_wallet');
    END IF;
  END IF;

  UPDATE public.commission_wallets SET balance = balance - p_amount, updated_at = now() WHERE id = v_wallet.id;
  INSERT INTO public.commission_wallet_transactions (commission_wallet_id, type, amount, description, status)
  VALUES (v_wallet.id, CASE WHEN p_destination = 'main' THEN 'transfer_out_main' ELSE 'transfer_out_shop' END,
          p_amount, 'Transfer to ' || CASE WHEN p_destination = 'main' THEN 'main wallet' ELSE 'shop wallet' END, 'completed');

  IF p_destination = 'main' THEN
    -- Deliberate auto-creation: every user has (or should have) a main
    -- wallet, so upsert-then-credit rather than failing the transfer.
    -- credit_wallet_balance() is NOT used here â€” it applies refund
    -- semantics (erodes total_spent) and writes no wallet_transactions row,
    -- which would leave a balance jump with nothing in the user's ledger
    -- explaining it. Credit and ledger explicitly instead.
    INSERT INTO public.wallets (user_id, balance) VALUES (p_owner_id, 0) ON CONFLICT (user_id) DO NOTHING;
    SELECT id INTO v_main_wallet_id FROM public.wallets WHERE user_id = p_owner_id FOR UPDATE;
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_main_wallet_id;
    INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, description, source, status)
    VALUES (v_main_wallet_id, p_owner_id, 'credit', p_amount, 'Transfer from commission wallet', 'commission', 'completed');
  ELSE
    -- Balance only â€” this amount was already counted in
    -- commission_wallets.total_earned; adding it to shop_wallets.total_earned
    -- too would double-count it and blur the commission/shop separation.
    UPDATE public.shop_wallets SET balance = balance + p_amount, updated_at = now()
     WHERE id = v_shop_wallet_id;
    INSERT INTO public.shop_wallet_transactions (shop_wallet_id, type, amount, description, status)
    VALUES (v_shop_wallet_id, 'commission_transfer_in', p_amount, 'Transfer from commission wallet', 'completed');
  END IF;

  RETURN jsonb_build_object('success', true, 'destination', p_destination, 'amount', p_amount);
END $function$
;

-- ===== trg_sub_agent_earning_by_paystack_reference () =====
CREATE OR REPLACE FUNCTION public.trg_sub_agent_earning_by_paystack_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.apply_sub_agent_earning_sync(COALESCE(NEW.paystack_reference, NEW.id::text), NEW.status, TG_TABLE_NAME);
  RETURN NEW;
END;
$function$
;

-- ===== trg_sub_agent_earning_by_reference_code () =====
CREATE OR REPLACE FUNCTION public.trg_sub_agent_earning_by_reference_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.apply_sub_agent_earning_sync(NEW.reference_code, NEW.status, TG_TABLE_NAME);
  RETURN NEW;
END;
$function$
;

-- ===== update_guest_push_subscriptions_updated_at () =====
CREATE OR REPLACE FUNCTION public.update_guest_push_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

-- ===== update_push_subscriptions_updated_at () =====
CREATE OR REPLACE FUNCTION public.update_push_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- ===== update_support_threads_updated_at () =====
CREATE OR REPLACE FUNCTION public.update_support_threads_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ===== update_utility_orders_updated_at () =====
CREATE OR REPLACE FUNCTION public.update_utility_orders_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ===== update_website_requests_updated_at () =====
CREATE OR REPLACE FUNCTION public.update_website_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ===== upsert_shop_customer_from_order () =====
CREATE OR REPLACE FUNCTION public.upsert_shop_customer_from_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.shop_id IS NULL OR NEW.guest_phone IS NULL OR NEW.guest_phone = '' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.shop_customers (shop_id, phone, total_orders, total_spent, first_order_at, last_order_at)
    VALUES (NEW.shop_id, NEW.guest_phone, 1, COALESCE(NEW.selling_price, 0), NEW.created_at, NEW.created_at)
    ON CONFLICT (shop_id, phone) DO UPDATE SET
        total_orders  = shop_customers.total_orders + 1,
        total_spent   = shop_customers.total_spent + COALESCE(NEW.selling_price, 0),
        last_order_at = GREATEST(shop_customers.last_order_at, NEW.created_at),
        updated_at    = now();

    RETURN NEW;
END;
$function$
;

-- ===== upsert_shop_customer_from_rc_order () =====
CREATE OR REPLACE FUNCTION public.upsert_shop_customer_from_rc_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.shop_id IS NULL OR NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.shop_customers (shop_id, phone, total_orders, total_spent, first_order_at, last_order_at)
    VALUES (
        NEW.shop_id, NEW.customer_phone, 1,
        COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 1),
        NEW.created_at, NEW.created_at
    )
    ON CONFLICT (shop_id, phone) DO UPDATE SET
        total_orders  = shop_customers.total_orders + 1,
        total_spent   = shop_customers.total_spent + (COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 1)),
        last_order_at = GREATEST(shop_customers.last_order_at, NEW.created_at),
        updated_at    = now();

    RETURN NEW;
END;
$function$
;


-- ============================================================
-- 04 INDEXES
-- ============================================================
CREATE INDEX idx_aclu_user_id ON public.admin_custom_list_users USING btree (user_id);
CREATE INDEX idx_admin_custom_lists_created_by ON public.admin_custom_lists USING btree (created_by);
CREATE INDEX idx_admin_payment_actions_created ON public.admin_payment_actions USING btree (created_at DESC);
CREATE INDEX idx_admin_payment_actions_reference ON public.admin_payment_actions USING btree (reference);
CREATE INDEX idx_profit_logs_type ON public.admin_profit_logs USING btree (transaction_type);
CREATE INDEX idx_admin_settings_audit_changed_at ON public.admin_settings_audit USING btree (changed_at DESC);
CREATE INDEX afa_orders_guest_phone_idx ON public.afa_orders USING btree (guest_phone) WHERE (guest_phone IS NOT NULL);
CREATE UNIQUE INDEX afa_orders_paystack_reference_unique ON public.afa_orders USING btree (paystack_reference) WHERE (paystack_reference IS NOT NULL);
CREATE INDEX afa_orders_shop_id_idx ON public.afa_orders USING btree (shop_id) WHERE (shop_id IS NOT NULL);
CREATE INDEX idx_afa_orders_transaction_id ON public.afa_orders USING btree (transaction_id);
CREATE INDEX idx_afa_orders_user_id ON public.afa_orders USING btree (user_id);
CREATE INDEX idx_airtime_batches_created_at ON public.airtime_fulfillment_batches USING btree (created_at DESC);
CREATE INDEX idx_airtime_batches_status ON public.airtime_fulfillment_batches USING btree (status);
CREATE INDEX idx_airtime_orders_beneficiary_phone ON public.airtime_orders USING btree (beneficiary_phone);
CREATE INDEX idx_airtime_orders_created_at ON public.airtime_orders USING btree (created_at DESC);
CREATE INDEX idx_airtime_orders_fulfilled_by ON public.airtime_orders USING btree (fulfilled_by);
CREATE INDEX idx_airtime_orders_fulfillment_service ON public.airtime_orders USING btree (fulfillment_service) WHERE (fulfillment_service IS NOT NULL);
CREATE INDEX idx_airtime_orders_reference ON public.airtime_orders USING btree (reference_code);
CREATE INDEX idx_airtime_orders_shop_id ON public.airtime_orders USING btree (shop_id);
CREATE INDEX idx_airtime_orders_user_id ON public.airtime_orders USING btree (user_id);
CREATE INDEX idx_api_keys_key_type ON public.api_keys USING btree (key_type);
CREATE INDEX idx_api_keys_status ON public.api_keys USING btree (status);
CREATE INDEX idx_api_keys_user_id ON public.api_keys USING btree (user_id);
CREATE INDEX idx_api_logs_api_key_id ON public.api_logs USING btree (api_key_id);
CREATE INDEX idx_api_logs_created_at ON public.api_logs USING btree (created_at DESC);
CREATE INDEX idx_api_logs_user_id ON public.api_logs USING btree (user_id);
CREATE INDEX archived_shop_financials_owner_idx ON public.archived_shop_financial_records USING btree (owner_id);
CREATE INDEX archived_shop_financials_shop_idx ON public.archived_shop_financial_records USING btree (shop_id);
CREATE INDEX idx_atishare_manual_sends_admin_created ON public.atishare_console_manual_sends USING btree (admin_id, created_at DESC);
CREATE INDEX idx_commission_wallet_tx_status ON public.commission_wallet_transactions USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'paystack_pending'::text]));
CREATE INDEX idx_commission_wallet_tx_wallet_id ON public.commission_wallet_transactions USING btree (commission_wallet_id);
CREATE UNIQUE INDEX uq_commission_wallet_tx_airtime_order_credit ON public.commission_wallet_transactions USING btree (airtime_order_id) WHERE (type = 'commission'::text);
CREATE UNIQUE INDEX uq_commission_wallet_tx_order_credit ON public.commission_wallet_transactions USING btree (utility_order_id) WHERE (type = 'commission'::text);
CREATE UNIQUE INDEX uq_commission_wallet_tx_sub_agent_credit ON public.commission_wallet_transactions USING btree (order_table, order_reference) WHERE (type = 'sub_agent_margin'::text);
CREATE UNIQUE INDEX uq_commission_wallet_tx_sub_agent_reversal ON public.commission_wallet_transactions USING btree (order_table, order_reference) WHERE (type = 'sub_agent_margin_reversal'::text);
CREATE INDEX idx_complaints_order_id ON public.complaints USING btree (order_id);
CREATE INDEX idx_complaints_user_id ON public.complaints USING btree (user_id);
CREATE INDEX idx_data_packages_ussd ON public.data_packages USING btree (network, sort_order) WHERE ((ussd_enabled = true) AND (is_available = true));
CREATE INDEX idx_fulfillment_logs_order_id ON public.fulfillment_logs USING btree (order_id);
CREATE INDEX guest_push_subscriptions_phone_idx ON public.guest_push_subscriptions USING btree (guest_phone) WHERE (guest_phone IS NOT NULL);
CREATE INDEX guest_push_subscriptions_shop_id_idx ON public.guest_push_subscriptions USING btree (shop_id);
CREATE INDEX idx_hrc_status_created ON public.hubtel_receive_charges USING btree (status, created_at);
CREATE INDEX idx_momo_claim_attempts_created_at ON public.momo_claim_attempts USING btree (created_at DESC);
CREATE INDEX idx_momo_claim_attempts_user_id ON public.momo_claim_attempts USING btree (user_id);
CREATE INDEX idx_momo_transactions_claimed_by ON public.momo_transactions USING btree (claimed_by);
CREATE INDEX idx_momo_transactions_created_at ON public.momo_transactions USING btree (created_at DESC);
CREATE INDEX idx_momo_transactions_status ON public.momo_transactions USING btree (status);
CREATE INDEX idx_momo_transactions_transaction_id ON public.momo_transactions USING btree (transaction_id);
CREATE INDEX idx_mtn_fulfillment_tracking_order_id ON public.mtn_fulfillment_tracking USING btree (order_id);
CREATE INDEX idx_mtn_fulfillment_tracking_status_created ON public.mtn_fulfillment_tracking USING btree (status, created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_number_registrations_batch ON public.number_registrations USING btree (batch_id);
CREATE INDEX idx_number_registrations_status ON public.number_registrations USING btree (status);
CREATE INDEX idx_order_retry_attempts_source ON public.order_retry_attempts USING btree (source_order_id);
CREATE INDEX idx_orders_api_key_id ON public.orders USING btree (api_key_id);
CREATE INDEX idx_orders_atishare_console_transaction_id ON public.orders USING btree (atishare_console_transaction_id) WHERE (atishare_console_transaction_id IS NOT NULL);
CREATE INDEX idx_orders_completed ON public.orders USING btree (created_at DESC) WHERE (status = 'completed'::text);
CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX idx_orders_dakazina_order_code ON public.orders USING btree (dakazina_order_code) WHERE (dakazina_order_code IS NOT NULL);
CREATE INDEX idx_orders_dakazina_reference ON public.orders USING btree (dakazina_reference) WHERE (dakazina_reference IS NOT NULL);
CREATE INDEX idx_orders_dispatch_claimed_at ON public.orders USING btree (dispatch_claimed_at) WHERE (dispatch_claimed_at IS NOT NULL);
CREATE INDEX idx_orders_download_batch_id ON public.orders USING btree (download_batch_id);
CREATE INDEX idx_orders_hendylinks_order_id ON public.orders USING btree (hendylinks_order_id) WHERE (hendylinks_order_id IS NOT NULL);
CREATE INDEX idx_orders_retry_of_created ON public.orders USING btree (retry_of_order_id, created_at DESC) WHERE (retry_of_order_id IS NOT NULL);
CREATE INDEX idx_orders_retry_of_order_id ON public.orders USING btree (retry_of_order_id) WHERE (retry_of_order_id IS NOT NULL);
CREATE INDEX idx_orders_self_completed_by ON public.orders USING btree (self_completed_by) WHERE (self_completed_by IS NOT NULL);
CREATE INDEX idx_orders_shop_order_id ON public.orders USING btree (shop_order_id) WHERE (shop_order_id IS NOT NULL);
CREATE INDEX idx_orders_source ON public.orders USING btree (source);
CREATE INDEX idx_orders_spfastit_reference ON public.orders USING btree (spfastit_reference) WHERE (spfastit_reference IS NOT NULL);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC) WHERE (shop_order_id IS NULL);
CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);
CREATE INDEX idx_passkey_challenge_exp ON public.passkey_challenges USING btree (expires_at);
CREATE INDEX idx_passkey_challenge_val ON public.passkey_challenges USING btree (challenge);
CREATE INDEX idx_passkey_cred_id ON public.passkey_credentials USING btree (credential_id);
CREATE INDEX idx_passkey_user_id ON public.passkey_credentials USING btree (user_id);
CREATE INDEX idx_pending_settlements_status_created ON public.pending_settlements USING btree (status, created_at DESC);
CREATE INDEX idx_pending_settlements_user_status ON public.pending_settlements USING btree (user_id, status);
CREATE INDEX idx_pending_settlements_wallet_transaction_id ON public.pending_settlements USING btree (wallet_transaction_id);
CREATE INDEX idx_phone_otp_phone ON public.phone_otp_verifications USING btree (phone);
CREATE UNIQUE INDEX phone_otp_verifications_verify_reference_key ON public.phone_otp_verifications USING btree (verify_reference) WHERE (verify_reference IS NOT NULL);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX idx_rc_complaints_order_id ON public.results_checker_complaints USING btree (order_id);
CREATE INDEX idx_rc_complaints_shop_id ON public.results_checker_complaints USING btree (shop_id);
CREATE INDEX idx_rc_complaints_user_id ON public.results_checker_complaints USING btree (user_id);
CREATE INDEX idx_rc_inv_available ON public.results_checker_inventory USING btree (type_id, created_at) WHERE (status = 'available'::text);
CREATE INDEX idx_rc_inv_reserved_expiry ON public.results_checker_inventory USING btree (reservation_expires_at) WHERE (status = 'reserved'::text);
CREATE INDEX idx_rc_inv_type_status ON public.results_checker_inventory USING btree (type_id, status);
CREATE INDEX idx_rc_inventory_sold_to_user_id ON public.results_checker_inventory USING btree (sold_to_user_id);
CREATE INDEX idx_rc_orders_created ON public.results_checker_orders USING btree (created_at DESC);
CREATE INDEX idx_rc_orders_ref ON public.results_checker_orders USING btree (reference_code);
CREATE INDEX idx_rc_orders_shop ON public.results_checker_orders USING btree (shop_id);
CREATE INDEX idx_rc_orders_shop_created ON public.results_checker_orders USING btree (shop_id, created_at DESC);
CREATE INDEX idx_rc_orders_status ON public.results_checker_orders USING btree (status, payment_status);
CREATE INDEX idx_rc_orders_type_id ON public.results_checker_orders USING btree (type_id);
CREATE INDEX idx_rc_orders_user ON public.results_checker_orders USING btree (user_id);
CREATE INDEX idx_rc_types_active ON public.results_checker_types USING btree (display_order) WHERE (is_active = true);
CREATE INDEX security_events_created_at_idx ON public.security_events USING btree (created_at DESC);
CREATE INDEX security_events_reference_idx ON public.security_events USING btree (reference);
CREATE INDEX security_events_type_idx ON public.security_events USING btree (event_type, created_at DESC);
CREATE INDEX shop_afa_pending_shop_phone_idx ON public.shop_afa_pending_orders USING btree (shop_id, guest_phone, status, created_at DESC);
CREATE INDEX idx_shop_announcements_shop_id ON public.shop_announcements USING btree (shop_id);
CREATE INDEX idx_shop_customers_last_order ON public.shop_customers USING btree (shop_id, last_order_at DESC);
CREATE INDEX idx_shop_customers_shop ON public.shop_customers USING btree (shop_id);
CREATE INDEX idx_shop_invites_code ON public.shop_invites USING btree (code);
CREATE INDEX idx_shop_invites_shop ON public.shop_invites USING btree (shop_id);
CREATE INDEX idx_shop_order_splits_beneficiary ON public.shop_order_splits USING btree (beneficiary_shop_id);
CREATE INDEX idx_shop_order_splits_order ON public.shop_order_splits USING btree (order_id);
CREATE INDEX idx_shop_orders_completed ON public.shop_orders USING btree (created_at DESC) WHERE (status = 'completed'::text);
CREATE INDEX idx_shop_orders_created ON public.shop_orders USING btree (created_at DESC);
CREATE INDEX idx_shop_orders_fulfilled_by ON public.shop_orders USING btree (fulfilled_by);
CREATE INDEX idx_shop_orders_guest_phone ON public.shop_orders USING btree (guest_phone);
CREATE INDEX idx_shop_orders_package_id ON public.shop_orders USING btree (package_id);
CREATE INDEX idx_shop_orders_parent ON public.shop_orders USING btree (parent_shop_id);
CREATE INDEX idx_shop_orders_paystack_reference ON public.shop_orders USING btree (paystack_reference);
CREATE INDEX idx_shop_orders_shop ON public.shop_orders USING btree (shop_id);
CREATE INDEX idx_shop_orders_shop_created ON public.shop_orders USING btree (shop_id, created_at DESC);
CREATE INDEX idx_shop_orders_status ON public.shop_orders USING btree (status);
CREATE INDEX idx_shop_payment_details_shop_owner_id ON public.shop_payment_details USING btree (shop_owner_id);
CREATE INDEX idx_shop_pricing_package ON public.shop_pricing USING btree (package_id);
CREATE INDEX idx_shop_pricing_shop ON public.shop_pricing USING btree (shop_id);
CREATE INDEX idx_shop_pricing_logs_package_id ON public.shop_pricing_logs USING btree (package_id);
CREATE INDEX idx_shop_pricing_logs_shop_id ON public.shop_pricing_logs USING btree (shop_id);
CREATE INDEX idx_shop_pricing_pending_package_id ON public.shop_pricing_pending USING btree (package_id);
CREATE INDEX idx_shop_profiles_approved_by ON public.shop_profiles USING btree (approved_by);
CREATE INDEX idx_shop_profiles_owner ON public.shop_profiles USING btree (owner_id);
CREATE INDEX idx_shop_profiles_pricing_approved_by ON public.shop_profiles USING btree (pricing_approved_by);
CREATE INDEX idx_shop_profiles_slug ON public.shop_profiles USING btree (shop_slug);
CREATE INDEX idx_shop_profiles_status ON public.shop_profiles USING btree (approval_status);
CREATE INDEX idx_shop_profiles_ussd_code ON public.shop_profiles USING btree (ussd_code) WHERE (ussd_active = true);
CREATE INDEX idx_shop_rc_markups_shop ON public.shop_rc_markups USING btree (shop_id);
CREATE UNIQUE INDEX idx_shop_sender_ids_one_approved ON public.shop_sender_ids USING btree (shop_id) WHERE (status = 'approved'::text);
CREATE UNIQUE INDEX idx_shop_sender_ids_one_default ON public.shop_sender_ids USING btree (shop_id) WHERE (is_default = true);
CREATE UNIQUE INDEX idx_shop_sender_ids_one_pending ON public.shop_sender_ids USING btree (shop_id) WHERE (status = 'under_review'::text);
CREATE INDEX idx_shop_sender_ids_review ON public.shop_sender_ids USING btree (requested_at) WHERE (status = 'under_review'::text);
CREATE INDEX idx_shop_sender_ids_shop ON public.shop_sender_ids USING btree (shop_id);
CREATE INDEX idx_shop_sms_delivery_receipts_log_id ON public.shop_sms_delivery_receipts USING btree (log_id);
CREATE INDEX idx_shop_sms_delivery_receipts_provider_message_id ON public.shop_sms_delivery_receipts USING btree (provider_message_id) WHERE (provider_message_id IS NOT NULL);
CREATE INDEX idx_shop_sms_delivery_receipts_stuck_scan ON public.shop_sms_delivery_receipts USING btree (status, updated_at) WHERE (status = 'sent'::text);
CREATE INDEX idx_shop_sms_group_members_group ON public.shop_sms_group_members USING btree (group_id);
CREATE INDEX idx_shop_sms_group_members_shop ON public.shop_sms_group_members USING btree (shop_id);
CREATE INDEX idx_shop_sms_groups_shop ON public.shop_sms_groups USING btree (shop_id);
CREATE INDEX idx_shop_sms_logs_flagged ON public.shop_sms_logs USING btree (flagged) WHERE (flagged = true);
CREATE INDEX idx_shop_sms_logs_shop ON public.shop_sms_logs USING btree (shop_id, created_at DESC);
CREATE INDEX idx_shop_sms_logs_shop_source_created ON public.shop_sms_logs USING btree (shop_id, source, created_at DESC);
CREATE INDEX idx_shop_sms_purchases_shop ON public.shop_sms_purchases USING btree (shop_id);
CREATE INDEX shop_sms_templates_shop_id_idx ON public.shop_sms_templates USING btree (shop_id);
CREATE INDEX idx_shop_wallet_transactions_wallet ON public.shop_wallet_transactions USING btree (shop_wallet_id);
CREATE INDEX idx_shop_wallet_tx_moolre_pending ON public.shop_wallet_transactions USING btree (status) WHERE (status = 'moolre_pending'::text);
CREATE INDEX idx_shop_wallet_tx_owner_pending ON public.shop_wallet_transactions USING btree (escalate_after) WHERE (status = 'shop_owner_pending'::text);
CREATE INDEX idx_shop_wallet_tx_paystack_pending ON public.shop_wallet_transactions USING btree (status) WHERE (status = 'paystack_pending'::text);
CREATE INDEX idx_shop_wallet_tx_profit_type ON public.shop_wallet_transactions USING btree (type) WHERE (type = 'profit'::text);
CREATE INDEX idx_shop_wallet_txns_shop_order_id ON public.shop_wallet_transactions USING btree (shop_order_id);
CREATE UNIQUE INDEX uq_shop_wallet_tx_afa_profit ON public.shop_wallet_transactions USING btree (afa_order_id) WHERE ((afa_order_id IS NOT NULL) AND (type = 'profit'::text));
CREATE UNIQUE INDEX uq_shop_wallet_tx_paystack_ref ON public.shop_wallet_transactions USING btree (paystack_transfer_reference) WHERE (paystack_transfer_reference IS NOT NULL);
CREATE UNIQUE INDEX uq_shop_wallet_tx_source_ref ON public.shop_wallet_transactions USING btree (credit_source, order_reference) WHERE (order_reference IS NOT NULL);
CREATE UNIQUE INDEX uq_shop_wallet_tx_utility_commission ON public.shop_wallet_transactions USING btree (utility_order_id) WHERE (utility_order_id IS NOT NULL);
CREATE INDEX idx_sms_business_profiles_reviewed_by ON public.sms_business_profiles USING btree (reviewed_by);
CREATE INDEX idx_sms_campaigns_account ON public.sms_campaigns USING btree (account_id, created_at DESC);
CREATE INDEX idx_sms_campaigns_dispatch ON public.sms_campaigns USING btree (status, scheduled_at) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));
CREATE INDEX idx_sms_campaigns_flagged ON public.sms_campaigns USING btree (created_at DESC) WHERE (flagged = true);
CREATE INDEX idx_sms_contact_groups_account_id ON public.sms_contact_groups USING btree (account_id);
CREATE INDEX idx_sms_contacts_group_id ON public.sms_contacts USING btree (group_id);
CREATE INDEX idx_sms_contacts_phone ON public.sms_contacts USING btree (phone_number);
CREATE UNIQUE INDEX idx_sms_contacts_unique_group_phone ON public.sms_contacts USING btree (group_id, phone_number);
CREATE INDEX idx_sms_credit_ledger_account ON public.sms_credit_ledger USING btree (account_id, created_at DESC);
CREATE INDEX idx_sms_group_contacts_group ON public.sms_group_contacts USING btree (group_id);
CREATE INDEX idx_sms_messages_account ON public.sms_messages USING btree (account_id, created_at DESC);
CREATE INDEX idx_sms_messages_campaign ON public.sms_messages USING btree (campaign_id, chunk_no);
CREATE INDEX idx_sms_messages_pending ON public.sms_messages USING btree (status_updated_at) WHERE (status = ANY (ARRAY['queued'::text, 'sent'::text]));
CREATE INDEX idx_sms_messages_provider_mid ON public.sms_messages USING btree (provider_message_id) WHERE (provider_message_id IS NOT NULL);
CREATE INDEX idx_sms_purchases_account ON public.sms_purchases USING btree (account_id, created_at DESC);
CREATE INDEX idx_sms_purchases_bundle_id ON public.sms_purchases USING btree (bundle_id);
CREATE INDEX idx_sms_purchases_user_id ON public.sms_purchases USING btree (user_id);
CREATE INDEX idx_sms_sender_ids_account ON public.sms_sender_ids USING btree (account_id);
CREATE UNIQUE INDEX idx_sms_sender_ids_approved_name ON public.sms_sender_ids USING btree (lower(TRIM(BOTH FROM sender_text))) WHERE (status = 'approved'::text);
CREATE UNIQUE INDEX idx_sms_sender_ids_default ON public.sms_sender_ids USING btree (account_id) WHERE (is_default = true);
CREATE INDEX idx_sms_sender_ids_review ON public.sms_sender_ids USING btree (requested_at) WHERE (status = ANY (ARRAY['under_review'::text, 'submitted_to_hubtel'::text]));
CREATE INDEX idx_sms_user_templates_account_id ON public.sms_user_templates USING btree (account_id);
CREATE INDEX idx_sub_agent_default_pricing_recruiter ON public.sub_agent_default_pricing USING btree (recruiter_id);
CREATE INDEX idx_sub_agent_order_earnings_recruiter ON public.sub_agent_order_earnings USING btree (recruiter_id, status);
CREATE INDEX idx_sub_agent_order_earnings_sub ON public.sub_agent_order_earnings USING btree (sub_user_id);
CREATE INDEX idx_sub_agent_pricing_sub ON public.sub_agent_pricing USING btree (sub_user_id);
CREATE INDEX idx_sub_agents_status ON public.sub_agents USING btree (status);
CREATE INDEX idx_sub_agents_upline ON public.sub_agents USING btree (upline_shop_id);
CREATE INDEX idx_sub_agents_upline_user ON public.sub_agents USING btree (upline_user_id);
CREATE INDEX idx_support_messages_thread ON public.support_messages USING btree (thread_id, created_at);
CREATE INDEX idx_support_threads_order_id ON public.support_threads USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX idx_support_threads_status ON public.support_threads USING btree (status, last_message_at DESC);
CREATE INDEX idx_support_threads_user_id ON public.support_threads USING btree (user_id, last_message_at DESC);
CREATE INDEX idx_sysann_scheduled ON public.system_announcements USING btree (scheduled_at) WHERE (status = 'scheduled'::text);
CREATE INDEX terms_acceptances_user_idx ON public.terms_acceptances USING btree (user_id);
CREATE UNIQUE INDEX terms_versions_one_current ON public.terms_versions USING btree (is_current) WHERE (is_current = true);
CREATE INDEX idx_upr_is_active ON public.user_payment_references USING btree (is_active);
CREATE INDEX idx_upr_reference_code ON public.user_payment_references USING btree (reference_code);
CREATE INDEX idx_upr_user_id ON public.user_payment_references USING btree (user_id);
CREATE INDEX idx_users_agent_expires_at ON public.users USING btree (agent_expires_at);
CREATE INDEX idx_users_auto_upgrade_enabled ON public.users USING btree (auto_upgrade_enabled) WHERE (auto_upgrade_enabled = true);
CREATE INDEX idx_users_dealer_expires_at ON public.users USING btree (dealer_expires_at) WHERE (dealer_expires_at IS NOT NULL);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE INDEX ussd_callback_retry_queue_pending_idx ON public.ussd_callback_retry_queue USING btree (first_failed_at) WHERE ((NOT resolved) AND (NOT escalated));
CREATE UNIQUE INDEX ussd_callback_retry_queue_session_id_key ON public.ussd_callback_retry_queue USING btree (session_id);
CREATE INDEX idx_ussd_customers_mobile ON public.ussd_customers USING btree (mobile);
CREATE INDEX idx_ussd_pending_mobile ON public.ussd_pending_orders USING btree (mobile);
CREATE INDEX idx_ussd_pending_status ON public.ussd_pending_orders USING btree (status, created_at);
CREATE UNIQUE INDEX ussd_refund_queue_session_method_uniq ON public.ussd_refund_queue USING btree (session_id, payment_method);
CREATE INDEX ussd_refund_queue_status_idx ON public.ussd_refund_queue USING btree (status, created_at DESC);
CREATE INDEX idx_ussd_sessions_mobile ON public.ussd_sessions USING btree (mobile, interrupted_at) WHERE (interrupted_state IS NOT NULL);
CREATE INDEX idx_utility_orders_payref ON public.utility_orders USING btree (payment_reference) WHERE (payment_reference IS NOT NULL);
CREATE INDEX idx_utility_orders_shop ON public.utility_orders USING btree (shop_id) WHERE (shop_id IS NOT NULL);
CREATE INDEX idx_utility_orders_status ON public.utility_orders USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));
CREATE INDEX idx_utility_orders_user ON public.utility_orders USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX uq_utility_orders_user_payref ON public.utility_orders USING btree (user_id, payment_reference) WHERE ((payment_reference IS NOT NULL) AND (user_id IS NOT NULL));
CREATE UNIQUE INDEX utility_refund_queue_order_uniq ON public.utility_refund_queue USING btree (utility_order_id);
CREATE INDEX utility_refund_queue_status_idx ON public.utility_refund_queue USING btree (status, created_at DESC);
CREATE INDEX idx_wallet_payments_status_created ON public.wallet_payments USING btree (status, created_at);
CREATE INDEX idx_wallet_payments_user_id ON public.wallet_payments USING btree (user_id);
CREATE INDEX idx_wallet_payments_wallet_id ON public.wallet_payments USING btree (wallet_id);
CREATE INDEX idx_wallet_transactions_category ON public.wallet_transactions USING btree (((metadata ->> 'category'::text)));
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions USING btree (user_id);
CREATE INDEX idx_wallet_transactions_user_time ON public.wallet_transactions USING btree (user_id, created_at DESC, id DESC);
CREATE INDEX idx_wallet_transactions_wallet_id ON public.wallet_transactions USING btree (wallet_id);
CREATE UNIQUE INDEX uq_wallet_tx_refund_reference ON public.wallet_transactions USING btree (reference) WHERE ((source = 'refund'::text) AND (reference ~~ 'REFUND-%'::text));
CREATE UNIQUE INDEX wallet_transactions_payment_reference_unique ON public.wallet_transactions USING btree (reference) WHERE (source = 'payment'::text);
CREATE UNIQUE INDEX wallet_transactions_ussd_reference_unique ON public.wallet_transactions USING btree (reference) WHERE (source = 'ussd'::text);
CREATE INDEX idx_website_requests_status ON public.website_requests USING btree (status, created_at DESC);
CREATE INDEX idx_website_requests_user_id ON public.website_requests USING btree (user_id, created_at DESC);


-- ============================================================
-- 05 TRIGGERS
-- ============================================================
-- ===== trigger trg_log_admin_settings_change on admin_settings =====
CREATE TRIGGER trg_log_admin_settings_change AFTER INSERT OR UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION log_admin_settings_change();

-- ===== trigger trg_block_client_insert on afa_orders =====
CREATE TRIGGER trg_block_client_insert BEFORE INSERT ON public.afa_orders FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger trg_sync_sub_agent_earning_afa on afa_orders =====
CREATE TRIGGER trg_sync_sub_agent_earning_afa AFTER UPDATE OF status ON public.afa_orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION trg_sub_agent_earning_by_reference_code();

-- ===== trigger trg_block_client_insert on airtime_orders =====
CREATE TRIGGER trg_block_client_insert BEFORE INSERT ON public.airtime_orders FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger trg_auto_update_shop_pricing on data_packages =====
CREATE TRIGGER trg_auto_update_shop_pricing AFTER UPDATE OF price, agent_price, dealer_price ON public.data_packages FOR EACH ROW EXECUTE FUNCTION auto_update_shop_pricing_on_platform_cost();

-- ===== trigger trg_guest_push_updated_at on guest_push_subscriptions =====
CREATE TRIGGER trg_guest_push_updated_at BEFORE UPDATE ON public.guest_push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_guest_push_subscriptions_updated_at();

-- ===== trigger trg_block_client_insert on orders =====
CREATE TRIGGER trg_block_client_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger trg_log_main_profit on orders =====
CREATE TRIGGER trg_log_main_profit AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION log_main_profit();

-- ===== trigger trg_sync_sub_agent_earning_orders on orders =====
CREATE TRIGGER trg_sync_sub_agent_earning_orders AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION trg_sub_agent_earning_by_reference_code();

-- ===== trigger push_subscriptions_updated_at_trigger on push_subscriptions =====
CREATE TRIGGER push_subscriptions_updated_at_trigger BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- ===== trigger trg_log_rc_profit on results_checker_orders =====
CREATE TRIGGER trg_log_rc_profit AFTER UPDATE ON public.results_checker_orders FOR EACH ROW EXECUTE FUNCTION log_rc_profit();

-- ===== trigger trg_shop_customers_from_rc_orders on results_checker_orders =====
CREATE TRIGGER trg_shop_customers_from_rc_orders AFTER INSERT ON public.results_checker_orders FOR EACH ROW EXECUTE FUNCTION upsert_shop_customer_from_rc_order();

-- ===== trigger trg_sync_sub_agent_earning_rc on results_checker_orders =====
CREATE TRIGGER trg_sync_sub_agent_earning_rc AFTER UPDATE OF status ON public.results_checker_orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION trg_sub_agent_earning_by_reference_code();

-- ===== trigger trg_log_shop_profit on shop_orders =====
CREATE TRIGGER trg_log_shop_profit AFTER UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION log_shop_profit();

-- ===== trigger trg_shop_customers_from_orders on shop_orders =====
CREATE TRIGGER trg_shop_customers_from_orders AFTER INSERT ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION upsert_shop_customer_from_order();

-- ===== trigger trg_sync_sub_agent_earning_shop on shop_orders =====
CREATE TRIGGER trg_sync_sub_agent_earning_shop AFTER UPDATE OF status ON public.shop_orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION trg_sub_agent_earning_by_paystack_reference();

-- ===== trigger trg_block_client_write on shop_payment_details =====
CREATE TRIGGER trg_block_client_write BEFORE INSERT OR UPDATE ON public.shop_payment_details FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger trg_max_payment_details on shop_payment_details =====
CREATE TRIGGER trg_max_payment_details BEFORE INSERT ON public.shop_payment_details FOR EACH ROW EXECUTE FUNCTION enforce_max_payment_details();

-- ===== trigger trg_single_default_payment on shop_payment_details =====
CREATE TRIGGER trg_single_default_payment AFTER INSERT OR UPDATE ON public.shop_payment_details FOR EACH ROW EXECUTE FUNCTION enforce_single_default_payment();

-- ===== trigger enforce_shop_admin_columns on shop_profiles =====
CREATE TRIGGER enforce_shop_admin_columns BEFORE UPDATE ON public.shop_profiles FOR EACH ROW EXECUTE FUNCTION protect_shop_admin_columns();

-- ===== trigger trg_cascade_lead_suspend on shop_profiles =====
CREATE TRIGGER trg_cascade_lead_suspend AFTER UPDATE OF approval_status ON public.shop_profiles FOR EACH ROW EXECUTE FUNCTION cascade_lead_suspend();

-- ===== trigger trg_enforce_sub_agent_recruit_cap on sub_agents =====
CREATE TRIGGER trg_enforce_sub_agent_recruit_cap BEFORE INSERT ON public.sub_agents FOR EACH ROW EXECUTE FUNCTION enforce_sub_agent_recruit_cap();

-- ===== trigger trg_support_thread_bump on support_messages =====
CREATE TRIGGER trg_support_thread_bump AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION bump_support_thread_last_message();

-- ===== trigger trg_support_thread_cap on support_threads =====
CREATE TRIGGER trg_support_thread_cap BEFORE INSERT ON public.support_threads FOR EACH ROW EXECUTE FUNCTION enforce_support_thread_cap();

-- ===== trigger trg_support_threads_updated_at on support_threads =====
CREATE TRIGGER trg_support_threads_updated_at BEFORE UPDATE ON public.support_threads FOR EACH ROW EXECUTE FUNCTION update_support_threads_updated_at();

-- ===== trigger trg_block_client_write on user_payment_references =====
CREATE TRIGGER trg_block_client_write BEFORE INSERT OR UPDATE ON public.user_payment_references FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger on_user_created_wallet on users =====
CREATE TRIGGER on_user_created_wallet AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_wallet();

-- ===== trigger trg_enforce_subagent_contact_lock on users =====
CREATE TRIGGER trg_enforce_subagent_contact_lock BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION enforce_subagent_contact_lock();

-- ===== trigger trg_guard_users_privilege on users =====
CREATE TRIGGER trg_guard_users_privilege BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION guard_users_privilege_change();

-- ===== trigger trg_utility_orders_updated_at on utility_orders =====
CREATE TRIGGER trg_utility_orders_updated_at BEFORE UPDATE ON public.utility_orders FOR EACH ROW EXECUTE FUNCTION update_utility_orders_updated_at();

-- ===== trigger trg_block_client_write on wallet_transactions =====
CREATE TRIGGER trg_block_client_write BEFORE INSERT OR UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger trg_block_client_write on wallets =====
CREATE TRIGGER trg_block_client_write BEFORE INSERT OR UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION block_client_money_writes();

-- ===== trigger trg_website_request_cap on website_requests =====
CREATE TRIGGER trg_website_request_cap BEFORE INSERT ON public.website_requests FOR EACH ROW EXECUTE FUNCTION enforce_website_request_cap();

-- ===== trigger trg_website_requests_updated_at on website_requests =====
CREATE TRIGGER trg_website_requests_updated_at BEFORE UPDATE ON public.website_requests FOR EACH ROW EXECUTE FUNCTION update_website_requests_updated_at();


-- ============================================================
-- 06 ENABLE RLS
-- ============================================================
-- All 112 base tables on the source project have RLS enabled (none use FORCE ROW LEVEL SECURITY).
-- Generated from pg_class.relrowsecurity on ubvjtacdmwynqcxuposj, 2026-10-07.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_custom_list_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_payment_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afa_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_fulfillment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtime_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_shop_financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atishare_console_manual_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubtel_receive_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momo_claim_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtn_fulfillment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtn_whitelist_server_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mtn_whitelist_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_registration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_retry_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results_checker_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results_checker_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results_checker_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results_checker_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_afa_pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_pricing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_pricing_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_rc_markups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sender_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_refund_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_send_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sms_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_group_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_sender_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_user_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_agent_default_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_agent_order_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_agent_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_callback_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_refund_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_refund_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_saved_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_requests ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 07 RLS POLICIES
-- ============================================================
CREATE POLICY admin_custom_list_users_admin_only ON public.admin_custom_list_users AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY admin_custom_lists_admin_only ON public.admin_custom_lists AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Admins can view profit logs" ON public.admin_profit_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY admin_settings_insert ON public.admin_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

CREATE POLICY admin_settings_select ON public.admin_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY admin_settings_update ON public.admin_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

CREATE POLICY admin_settings_audit_select ON public.admin_settings_audit AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

CREATE POLICY afa_orders_select_combined ON public.afa_orders AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = afa_orders.shop_id)))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY "Admins manage airtime batches" ON public.airtime_fulfillment_batches AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY airtime_orders_select_combined ON public.airtime_orders AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))) OR ((shop_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = airtime_orders.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY "api_keys: admin full access" ON public.api_keys AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

CREATE POLICY "api_keys: select own or admin" ON public.api_keys AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY "api_keys: user select own" ON public.api_keys AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "api_logs: admin read all" ON public.api_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

CREATE POLICY "api_logs: select own or admin" ON public.api_logs AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY "api_logs: user read own" ON public.api_logs AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY archived_financials_admin_read ON public.archived_shop_financial_records AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "admins read manual sends" ON public.atishare_console_manual_sends AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'admin'::text)))));

CREATE POLICY commission_wallet_tx_admin_select ON public.commission_wallet_transactions AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY commission_wallet_tx_owner_select ON public.commission_wallet_transactions AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM commission_wallets w
  WHERE ((w.id = commission_wallet_transactions.commission_wallet_id) AND (w.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY commission_wallets_admin_select ON public.commission_wallets AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY commission_wallets_owner_select ON public.commission_wallets AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = owner_id));

CREATE POLICY "Users can create complaints" ON public.complaints AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view own complaints" ON public.complaints AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view own customer purchases" ON public.customer_purchases AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Admins can delete packages" ON public.data_packages AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Admins can insert packages" ON public.data_packages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Admins can update packages" ON public.data_packages AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Anyone can view packages" ON public.data_packages AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can do everything with batches" ON public.download_batches AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Admin full access to fulfillment logs" ON public.fulfillment_logs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Service role full access" ON public.guest_push_subscriptions AS PERMISSIVE FOR ALL TO service_role
  USING (true);

CREATE POLICY momo_claim_attempts_admin_write ON public.momo_claim_attempts AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY momo_transactions_admin_delete ON public.momo_transactions AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY momo_transactions_admin_insert ON public.momo_transactions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY momo_transactions_admin_update ON public.momo_transactions AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY momo_transactions_select_combined ON public.momo_transactions AS PERMISSIVE FOR SELECT TO public
  USING (((claimed_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY "Admin full access to mtn fulfillment tracking" ON public.mtn_fulfillment_tracking AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY mtn_whitelist_server_status_admin_read ON public.mtn_whitelist_server_status AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY mtn_whitelist_status_admin_only ON public.mtn_whitelist_status AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Users can delete own notifications" ON public.notifications AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can view own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY nr_batches_admin_only ON public.number_registration_batches AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY nr_registrations_admin_only ON public.number_registrations AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY "Users can view own orders" ON public.orders AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "No client access to challenges" ON public.passkey_challenges AS PERMISSIVE FOR ALL TO public
  USING (false);

CREATE POLICY "Users delete own passkeys" ON public.passkey_credentials AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users read own passkeys" ON public.passkey_credentials AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Admin only access" ON public.pending_settlements AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY phone_blacklist_admin_only ON public.phone_blacklist AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY push_subscriptions_combined ON public.push_subscriptions AS PERMISSIVE FOR ALL TO authenticated, service_role
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.role() AS role) = 'service_role'::text)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.role() AS role) = 'service_role'::text)));

CREATE POLICY rc_complaints_select_combined ON public.results_checker_complaints AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = results_checker_complaints.shop_id)))) OR (( SELECT auth.role() AS role) = 'service_role'::text)));

CREATE POLICY rc_complaints_service_delete ON public.results_checker_complaints AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_complaints_service_insert ON public.results_checker_complaints AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_complaints_service_update ON public.results_checker_complaints AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_inventory_service_only ON public.results_checker_inventory AS PERMISSIVE FOR ALL TO public
  USING ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_orders_select_combined ON public.results_checker_orders AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.role() AS role) = 'service_role'::text)));

CREATE POLICY rc_orders_service_delete ON public.results_checker_orders AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_orders_service_insert ON public.results_checker_orders AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_orders_service_update ON public.results_checker_orders AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.role() AS role) = 'service_role'::text));

CREATE POLICY rc_orders_shop_owner_select ON public.results_checker_orders AS PERMISSIVE FOR SELECT TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY rc_types_select_all ON public.results_checker_types AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY rc_types_write_service ON public.results_checker_types AS PERMISSIVE FOR ALL TO service_role
  USING (true);

CREATE POLICY shop_announcements_owner_delete ON public.shop_announcements AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_announcements.shop_id)))));

CREATE POLICY shop_announcements_owner_insert ON public.shop_announcements AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_announcements.shop_id)))));

CREATE POLICY shop_announcements_owner_update ON public.shop_announcements AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_announcements.shop_id)))));

CREATE POLICY shop_announcements_select_combined ON public.shop_announcements AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY shop_customers_owner_select ON public.shop_customers AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_customers.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY shop_customers_owner_update ON public.shop_customers AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_customers.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_customers.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY shop_global_settings_admin_delete ON public.shop_global_settings AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY shop_global_settings_admin_insert ON public.shop_global_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY shop_global_settings_admin_update ON public.shop_global_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY shop_global_settings_read ON public.shop_global_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY shop_invites_lead_all ON public.shop_invites AS PERMISSIVE FOR ALL TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_order_splits_beneficiary_read ON public.shop_order_splits AS PERMISSIVE FOR SELECT TO public
  USING ((beneficiary_shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_orders_parent_read ON public.shop_orders AS PERMISSIVE FOR SELECT TO public
  USING ((parent_shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_orders_select_combined ON public.shop_orders AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_orders.shop_id)))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY "Owners can delete their own payment details" ON public.shop_payment_details AS PERMISSIVE FOR DELETE TO public
  USING ((shop_owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY shop_payment_details_select_combined ON public.shop_payment_details AS PERMISSIVE FOR SELECT TO public
  USING (((shop_owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY shop_pricing_delete_owner_or_admin ON public.shop_pricing AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_pricing.shop_id)))) OR is_admin()));

CREATE POLICY shop_pricing_insert_owner_or_admin ON public.shop_pricing AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_pricing.shop_id)))) OR is_admin()));

CREATE POLICY shop_pricing_select_combined ON public.shop_pricing AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_pricing.shop_id)))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.id = shop_pricing.shop_id) AND (shop_profiles.approval_status = 'approved'::text) AND (shop_profiles.is_active = true))))));

CREATE POLICY shop_pricing_update_owner_or_admin ON public.shop_pricing AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_pricing.shop_id)))) OR is_admin()));

CREATE POLICY "Admins can view shop pricing logs" ON public.shop_pricing_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text]))))));

CREATE POLICY shop_pricing_pending_combined ON public.shop_pricing_pending AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM shop_profiles
  WHERE ((shop_profiles.owner_id = ( SELECT auth.uid() AS uid)) AND (shop_profiles.id = shop_pricing_pending.shop_id)))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY shop_profiles_select_combined ON public.shop_profiles AS PERMISSIVE FOR SELECT TO public
  USING ((((approval_status = 'approved'::text) AND (is_active = true)) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY shop_profiles_update_combined ON public.shop_profiles AS PERMISSIVE FOR UPDATE TO public
  USING (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY rc_markups_owner_all ON public.shop_rc_markups AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_rc_markups.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_rc_markups.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY rc_markups_public_read ON public.shop_rc_markups AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY shop_sender_ids_owner_select ON public.shop_sender_ids AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_sender_ids.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_activations_owner_select ON public.shop_sms_activations AS PERMISSIVE FOR SELECT TO public
  USING ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY sms_bundles_public_read ON public.shop_sms_bundles AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));

CREATE POLICY shop_sms_group_members_admin ON public.shop_sms_group_members AS PERMISSIVE FOR ALL TO public
  USING (is_admin());

CREATE POLICY shop_sms_group_members_select ON public.shop_sms_group_members AS PERMISSIVE FOR SELECT TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_sms_groups_admin ON public.shop_sms_groups AS PERMISSIVE FOR ALL TO public
  USING (is_admin());

CREATE POLICY shop_sms_groups_select ON public.shop_sms_groups AS PERMISSIVE FOR SELECT TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY sms_logs_owner_select ON public.shop_sms_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_sms_logs.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_purchases_owner_select ON public.shop_sms_purchases AS PERMISSIVE FOR SELECT TO public
  USING ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY shop_sms_templates_admin ON public.shop_sms_templates AS PERMISSIVE FOR ALL TO public
  USING (is_admin());

CREATE POLICY shop_sms_templates_delete ON public.shop_sms_templates AS PERMISSIVE FOR DELETE TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_sms_templates_insert ON public.shop_sms_templates AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_sms_templates_select ON public.shop_sms_templates AS PERMISSIVE FOR SELECT TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY shop_sms_templates_update ON public.shop_sms_templates AS PERMISSIVE FOR UPDATE TO public
  USING ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))))
  WITH CHECK ((shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY sms_wallets_owner_select ON public.shop_sms_wallets AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM shop_profiles sp
  WHERE ((sp.id = shop_sms_wallets.shop_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Admins update shop transactions" ON public.shop_wallet_transactions AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin());

CREATE POLICY shop_wallet_transactions_select_combined ON public.shop_wallet_transactions AS PERMISSIVE FOR SELECT TO public
  USING (((shop_wallet_id IN ( SELECT shop_wallets.id
   FROM shop_wallets
  WHERE (shop_wallets.owner_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY shop_wallet_tx_lead_read ON public.shop_wallet_transactions AS PERMISSIVE FOR SELECT TO public
  USING ((shop_wallet_id IN ( SELECT sw.id
   FROM (shop_wallets sw
     JOIN sub_agents sa ON ((sa.user_id = sw.owner_id)))
  WHERE (sa.upline_shop_id IN ( SELECT shop_profiles.id
           FROM shop_profiles
          WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY shop_wallets_select_combined ON public.shop_wallets AS PERMISSIVE FOR SELECT TO public
  USING (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY sms_accounts_owner_select ON public.sms_accounts AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY sms_bundles_public_read ON public.sms_bundles AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));

CREATE POLICY sms_business_profiles_owner_select ON public.sms_business_profiles AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_business_profiles.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_campaigns_owner_select ON public.sms_campaigns AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_campaigns.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_contact_groups_owner_all ON public.sms_contact_groups AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_contact_groups.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_contact_groups.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_contacts_admin_all ON public.sms_contacts AS PERMISSIVE FOR ALL TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY sms_credit_ledger_owner_select ON public.sms_credit_ledger AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_credit_ledger.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_group_contacts_owner_all ON public.sms_group_contacts AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM (sms_contact_groups g
     JOIN sms_accounts a ON ((a.id = g.account_id)))
  WHERE ((g.id = sms_group_contacts.group_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (sms_contact_groups g
     JOIN sms_accounts a ON ((a.id = g.account_id)))
  WHERE ((g.id = sms_group_contacts.group_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_groups_admin_all ON public.sms_groups AS PERMISSIVE FOR ALL TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY sms_messages_owner_select ON public.sms_messages AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_messages.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_purchases_owner_select ON public.sms_purchases AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY sms_sender_ids_owner_select ON public.sms_sender_ids AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_sender_ids.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_templates_admin_all ON public.sms_templates AS PERMISSIVE FOR ALL TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY sms_templates_authenticated_read ON public.sms_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY sms_user_templates_owner_all ON public.sms_user_templates AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_user_templates.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_user_templates.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sms_wallets_owner_select ON public.sms_wallets AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM sms_accounts a
  WHERE ((a.id = sms_wallets.account_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY sub_agent_default_pricing_recruiter_read ON public.sub_agent_default_pricing AS PERMISSIVE FOR SELECT TO public
  USING ((recruiter_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY sub_agent_order_earnings_party_read ON public.sub_agent_order_earnings AS PERMISSIVE FOR SELECT TO public
  USING (((recruiter_id = ( SELECT auth.uid() AS uid)) OR (sub_user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY sub_agent_pricing_party_read ON public.sub_agent_pricing AS PERMISSIVE FOR SELECT TO public
  USING (((recruiter_id = ( SELECT auth.uid() AS uid)) OR (sub_user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY sub_agents_lead_read ON public.sub_agents AS PERMISSIVE FOR SELECT TO public
  USING ((upline_shop_id IN ( SELECT shop_profiles.id
   FROM shop_profiles
  WHERE (shop_profiles.owner_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY sub_agents_self_read ON public.sub_agents AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY support_messages_owner_mark_read ON public.support_messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM support_threads t
  WHERE ((t.id = support_messages.thread_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM support_threads t
  WHERE ((t.id = support_messages.thread_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY support_messages_owner_select ON public.support_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM support_threads t
  WHERE ((t.id = support_messages.thread_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY support_threads_owner_select ON public.support_threads AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY system_announcements_admin_delete ON public.system_announcements AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY system_announcements_admin_insert ON public.system_announcements AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());

CREATE POLICY system_announcements_admin_update ON public.system_announcements AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY system_announcements_select_combined ON public.system_announcements AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY "insert own acceptance" ON public.terms_acceptances AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "read own acceptance" ON public.terms_acceptances AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "read current terms" ON public.terms_versions AS PERMISSIVE FOR SELECT TO public
  USING ((is_current = true));

CREATE POLICY user_payment_references_select_own_or_admin ON public.user_payment_references AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY "Users can insert their own profile" ON public.users AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY users_select_combined ON public.users AS PERMISSIVE FOR SELECT TO public
  USING (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY users_update_combined ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY utility_orders_owner_select ON public.utility_orders AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY usa_owner_all ON public.utility_saved_accounts AS PERMISSIVE FOR ALL TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY wallet_payments_select_combined ON public.wallet_payments AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'sub-admin'::text])))))));

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view own wallet" ON public.wallets AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY website_requests_owner_select ON public.website_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));


-- ============================================================
-- 08 GRANTS
-- ============================================================
GRANT REFERENCES ON TABLE public.admin_audit_log TO anon;
GRANT SELECT ON TABLE public.admin_audit_log TO anon;
GRANT TRIGGER ON TABLE public.admin_audit_log TO anon;
GRANT TRUNCATE ON TABLE public.admin_audit_log TO anon;
GRANT DELETE ON TABLE public.admin_audit_log TO authenticated;
GRANT INSERT ON TABLE public.admin_audit_log TO authenticated;
GRANT REFERENCES ON TABLE public.admin_audit_log TO authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
GRANT TRIGGER ON TABLE public.admin_audit_log TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_audit_log TO authenticated;
GRANT UPDATE ON TABLE public.admin_audit_log TO authenticated;
GRANT DELETE ON TABLE public.admin_audit_log TO service_role;
GRANT INSERT ON TABLE public.admin_audit_log TO service_role;
GRANT REFERENCES ON TABLE public.admin_audit_log TO service_role;
GRANT SELECT ON TABLE public.admin_audit_log TO service_role;
GRANT TRIGGER ON TABLE public.admin_audit_log TO service_role;
GRANT TRUNCATE ON TABLE public.admin_audit_log TO service_role;
GRANT UPDATE ON TABLE public.admin_audit_log TO service_role;
GRANT REFERENCES ON TABLE public.admin_custom_list_users TO anon;
GRANT SELECT ON TABLE public.admin_custom_list_users TO anon;
GRANT TRIGGER ON TABLE public.admin_custom_list_users TO anon;
GRANT TRUNCATE ON TABLE public.admin_custom_list_users TO anon;
GRANT DELETE ON TABLE public.admin_custom_list_users TO authenticated;
GRANT INSERT ON TABLE public.admin_custom_list_users TO authenticated;
GRANT REFERENCES ON TABLE public.admin_custom_list_users TO authenticated;
GRANT SELECT ON TABLE public.admin_custom_list_users TO authenticated;
GRANT TRIGGER ON TABLE public.admin_custom_list_users TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_custom_list_users TO authenticated;
GRANT UPDATE ON TABLE public.admin_custom_list_users TO authenticated;
GRANT DELETE ON TABLE public.admin_custom_list_users TO service_role;
GRANT INSERT ON TABLE public.admin_custom_list_users TO service_role;
GRANT REFERENCES ON TABLE public.admin_custom_list_users TO service_role;
GRANT SELECT ON TABLE public.admin_custom_list_users TO service_role;
GRANT TRIGGER ON TABLE public.admin_custom_list_users TO service_role;
GRANT TRUNCATE ON TABLE public.admin_custom_list_users TO service_role;
GRANT UPDATE ON TABLE public.admin_custom_list_users TO service_role;
GRANT REFERENCES ON TABLE public.admin_custom_lists TO anon;
GRANT SELECT ON TABLE public.admin_custom_lists TO anon;
GRANT TRIGGER ON TABLE public.admin_custom_lists TO anon;
GRANT TRUNCATE ON TABLE public.admin_custom_lists TO anon;
GRANT DELETE ON TABLE public.admin_custom_lists TO authenticated;
GRANT INSERT ON TABLE public.admin_custom_lists TO authenticated;
GRANT REFERENCES ON TABLE public.admin_custom_lists TO authenticated;
GRANT SELECT ON TABLE public.admin_custom_lists TO authenticated;
GRANT TRIGGER ON TABLE public.admin_custom_lists TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_custom_lists TO authenticated;
GRANT UPDATE ON TABLE public.admin_custom_lists TO authenticated;
GRANT DELETE ON TABLE public.admin_custom_lists TO service_role;
GRANT INSERT ON TABLE public.admin_custom_lists TO service_role;
GRANT REFERENCES ON TABLE public.admin_custom_lists TO service_role;
GRANT SELECT ON TABLE public.admin_custom_lists TO service_role;
GRANT TRIGGER ON TABLE public.admin_custom_lists TO service_role;
GRANT TRUNCATE ON TABLE public.admin_custom_lists TO service_role;
GRANT UPDATE ON TABLE public.admin_custom_lists TO service_role;
GRANT REFERENCES ON TABLE public.admin_payment_actions TO anon;
GRANT SELECT ON TABLE public.admin_payment_actions TO anon;
GRANT TRIGGER ON TABLE public.admin_payment_actions TO anon;
GRANT TRUNCATE ON TABLE public.admin_payment_actions TO anon;
GRANT DELETE ON TABLE public.admin_payment_actions TO authenticated;
GRANT INSERT ON TABLE public.admin_payment_actions TO authenticated;
GRANT REFERENCES ON TABLE public.admin_payment_actions TO authenticated;
GRANT SELECT ON TABLE public.admin_payment_actions TO authenticated;
GRANT TRIGGER ON TABLE public.admin_payment_actions TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_payment_actions TO authenticated;
GRANT UPDATE ON TABLE public.admin_payment_actions TO authenticated;
GRANT DELETE ON TABLE public.admin_payment_actions TO service_role;
GRANT INSERT ON TABLE public.admin_payment_actions TO service_role;
GRANT REFERENCES ON TABLE public.admin_payment_actions TO service_role;
GRANT SELECT ON TABLE public.admin_payment_actions TO service_role;
GRANT TRIGGER ON TABLE public.admin_payment_actions TO service_role;
GRANT TRUNCATE ON TABLE public.admin_payment_actions TO service_role;
GRANT UPDATE ON TABLE public.admin_payment_actions TO service_role;
GRANT DELETE ON TABLE public.admin_presence TO service_role;
GRANT INSERT ON TABLE public.admin_presence TO service_role;
GRANT REFERENCES ON TABLE public.admin_presence TO service_role;
GRANT SELECT ON TABLE public.admin_presence TO service_role;
GRANT TRIGGER ON TABLE public.admin_presence TO service_role;
GRANT TRUNCATE ON TABLE public.admin_presence TO service_role;
GRANT UPDATE ON TABLE public.admin_presence TO service_role;
GRANT REFERENCES ON TABLE public.admin_profit_logs TO anon;
GRANT SELECT ON TABLE public.admin_profit_logs TO anon;
GRANT TRIGGER ON TABLE public.admin_profit_logs TO anon;
GRANT TRUNCATE ON TABLE public.admin_profit_logs TO anon;
GRANT DELETE ON TABLE public.admin_profit_logs TO authenticated;
GRANT INSERT ON TABLE public.admin_profit_logs TO authenticated;
GRANT REFERENCES ON TABLE public.admin_profit_logs TO authenticated;
GRANT SELECT ON TABLE public.admin_profit_logs TO authenticated;
GRANT TRIGGER ON TABLE public.admin_profit_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_profit_logs TO authenticated;
GRANT UPDATE ON TABLE public.admin_profit_logs TO authenticated;
GRANT DELETE ON TABLE public.admin_profit_logs TO service_role;
GRANT INSERT ON TABLE public.admin_profit_logs TO service_role;
GRANT REFERENCES ON TABLE public.admin_profit_logs TO service_role;
GRANT SELECT ON TABLE public.admin_profit_logs TO service_role;
GRANT TRIGGER ON TABLE public.admin_profit_logs TO service_role;
GRANT TRUNCATE ON TABLE public.admin_profit_logs TO service_role;
GRANT UPDATE ON TABLE public.admin_profit_logs TO service_role;
GRANT REFERENCES ON TABLE public.admin_settings TO anon;
GRANT SELECT ON TABLE public.admin_settings TO anon;
GRANT TRIGGER ON TABLE public.admin_settings TO anon;
GRANT TRUNCATE ON TABLE public.admin_settings TO anon;
GRANT DELETE ON TABLE public.admin_settings TO authenticated;
GRANT INSERT ON TABLE public.admin_settings TO authenticated;
GRANT REFERENCES ON TABLE public.admin_settings TO authenticated;
GRANT SELECT ON TABLE public.admin_settings TO authenticated;
GRANT TRIGGER ON TABLE public.admin_settings TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_settings TO authenticated;
GRANT UPDATE ON TABLE public.admin_settings TO authenticated;
GRANT DELETE ON TABLE public.admin_settings TO service_role;
GRANT INSERT ON TABLE public.admin_settings TO service_role;
GRANT REFERENCES ON TABLE public.admin_settings TO service_role;
GRANT SELECT ON TABLE public.admin_settings TO service_role;
GRANT TRIGGER ON TABLE public.admin_settings TO service_role;
GRANT TRUNCATE ON TABLE public.admin_settings TO service_role;
GRANT UPDATE ON TABLE public.admin_settings TO service_role;
GRANT REFERENCES ON TABLE public.admin_settings_audit TO anon;
GRANT SELECT ON TABLE public.admin_settings_audit TO anon;
GRANT TRIGGER ON TABLE public.admin_settings_audit TO anon;
GRANT TRUNCATE ON TABLE public.admin_settings_audit TO anon;
GRANT DELETE ON TABLE public.admin_settings_audit TO authenticated;
GRANT INSERT ON TABLE public.admin_settings_audit TO authenticated;
GRANT REFERENCES ON TABLE public.admin_settings_audit TO authenticated;
GRANT SELECT ON TABLE public.admin_settings_audit TO authenticated;
GRANT TRIGGER ON TABLE public.admin_settings_audit TO authenticated;
GRANT TRUNCATE ON TABLE public.admin_settings_audit TO authenticated;
GRANT UPDATE ON TABLE public.admin_settings_audit TO authenticated;
GRANT DELETE ON TABLE public.admin_settings_audit TO service_role;
GRANT INSERT ON TABLE public.admin_settings_audit TO service_role;
GRANT REFERENCES ON TABLE public.admin_settings_audit TO service_role;
GRANT SELECT ON TABLE public.admin_settings_audit TO service_role;
GRANT TRIGGER ON TABLE public.admin_settings_audit TO service_role;
GRANT TRUNCATE ON TABLE public.admin_settings_audit TO service_role;
GRANT UPDATE ON TABLE public.admin_settings_audit TO service_role;
GRANT REFERENCES ON TABLE public.afa_orders TO anon;
GRANT SELECT ON TABLE public.afa_orders TO anon;
GRANT TRIGGER ON TABLE public.afa_orders TO anon;
GRANT TRUNCATE ON TABLE public.afa_orders TO anon;
GRANT REFERENCES ON TABLE public.afa_orders TO authenticated;
GRANT SELECT ON TABLE public.afa_orders TO authenticated;
GRANT TRIGGER ON TABLE public.afa_orders TO authenticated;
GRANT TRUNCATE ON TABLE public.afa_orders TO authenticated;
GRANT DELETE ON TABLE public.afa_orders TO service_role;
GRANT INSERT ON TABLE public.afa_orders TO service_role;
GRANT REFERENCES ON TABLE public.afa_orders TO service_role;
GRANT SELECT ON TABLE public.afa_orders TO service_role;
GRANT TRIGGER ON TABLE public.afa_orders TO service_role;
GRANT TRUNCATE ON TABLE public.afa_orders TO service_role;
GRANT UPDATE ON TABLE public.afa_orders TO service_role;
GRANT REFERENCES ON TABLE public.airtime_fulfillment_batches TO anon;
GRANT SELECT ON TABLE public.airtime_fulfillment_batches TO anon;
GRANT TRIGGER ON TABLE public.airtime_fulfillment_batches TO anon;
GRANT TRUNCATE ON TABLE public.airtime_fulfillment_batches TO anon;
GRANT DELETE ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT INSERT ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT REFERENCES ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT SELECT ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT TRIGGER ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT TRUNCATE ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT UPDATE ON TABLE public.airtime_fulfillment_batches TO authenticated;
GRANT DELETE ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT INSERT ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT REFERENCES ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT SELECT ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT TRIGGER ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT TRUNCATE ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT UPDATE ON TABLE public.airtime_fulfillment_batches TO service_role;
GRANT REFERENCES ON TABLE public.airtime_orders TO anon;
GRANT SELECT ON TABLE public.airtime_orders TO anon;
GRANT TRIGGER ON TABLE public.airtime_orders TO anon;
GRANT TRUNCATE ON TABLE public.airtime_orders TO anon;
GRANT REFERENCES ON TABLE public.airtime_orders TO authenticated;
GRANT SELECT ON TABLE public.airtime_orders TO authenticated;
GRANT TRIGGER ON TABLE public.airtime_orders TO authenticated;
GRANT TRUNCATE ON TABLE public.airtime_orders TO authenticated;
GRANT DELETE ON TABLE public.airtime_orders TO service_role;
GRANT INSERT ON TABLE public.airtime_orders TO service_role;
GRANT REFERENCES ON TABLE public.airtime_orders TO service_role;
GRANT SELECT ON TABLE public.airtime_orders TO service_role;
GRANT TRIGGER ON TABLE public.airtime_orders TO service_role;
GRANT TRUNCATE ON TABLE public.airtime_orders TO service_role;
GRANT UPDATE ON TABLE public.airtime_orders TO service_role;
GRANT REFERENCES ON TABLE public.api_keys TO anon;
GRANT SELECT ON TABLE public.api_keys TO anon;
GRANT TRIGGER ON TABLE public.api_keys TO anon;
GRANT TRUNCATE ON TABLE public.api_keys TO anon;
GRANT REFERENCES ON TABLE public.api_keys TO authenticated;
GRANT SELECT ON TABLE public.api_keys TO authenticated;
GRANT TRIGGER ON TABLE public.api_keys TO authenticated;
GRANT TRUNCATE ON TABLE public.api_keys TO authenticated;
GRANT DELETE ON TABLE public.api_keys TO service_role;
GRANT INSERT ON TABLE public.api_keys TO service_role;
GRANT REFERENCES ON TABLE public.api_keys TO service_role;
GRANT SELECT ON TABLE public.api_keys TO service_role;
GRANT TRIGGER ON TABLE public.api_keys TO service_role;
GRANT TRUNCATE ON TABLE public.api_keys TO service_role;
GRANT UPDATE ON TABLE public.api_keys TO service_role;
GRANT REFERENCES ON TABLE public.api_logs TO anon;
GRANT SELECT ON TABLE public.api_logs TO anon;
GRANT TRIGGER ON TABLE public.api_logs TO anon;
GRANT TRUNCATE ON TABLE public.api_logs TO anon;
GRANT DELETE ON TABLE public.api_logs TO authenticated;
GRANT INSERT ON TABLE public.api_logs TO authenticated;
GRANT REFERENCES ON TABLE public.api_logs TO authenticated;
GRANT SELECT ON TABLE public.api_logs TO authenticated;
GRANT TRIGGER ON TABLE public.api_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.api_logs TO authenticated;
GRANT UPDATE ON TABLE public.api_logs TO authenticated;
GRANT DELETE ON TABLE public.api_logs TO service_role;
GRANT INSERT ON TABLE public.api_logs TO service_role;
GRANT REFERENCES ON TABLE public.api_logs TO service_role;
GRANT SELECT ON TABLE public.api_logs TO service_role;
GRANT TRIGGER ON TABLE public.api_logs TO service_role;
GRANT TRUNCATE ON TABLE public.api_logs TO service_role;
GRANT UPDATE ON TABLE public.api_logs TO service_role;
GRANT REFERENCES ON TABLE public.archived_shop_financial_records TO anon;
GRANT SELECT ON TABLE public.archived_shop_financial_records TO anon;
GRANT TRIGGER ON TABLE public.archived_shop_financial_records TO anon;
GRANT TRUNCATE ON TABLE public.archived_shop_financial_records TO anon;
GRANT REFERENCES ON TABLE public.archived_shop_financial_records TO authenticated;
GRANT SELECT ON TABLE public.archived_shop_financial_records TO authenticated;
GRANT TRIGGER ON TABLE public.archived_shop_financial_records TO authenticated;
GRANT TRUNCATE ON TABLE public.archived_shop_financial_records TO authenticated;
GRANT DELETE ON TABLE public.archived_shop_financial_records TO service_role;
GRANT INSERT ON TABLE public.archived_shop_financial_records TO service_role;
GRANT REFERENCES ON TABLE public.archived_shop_financial_records TO service_role;
GRANT SELECT ON TABLE public.archived_shop_financial_records TO service_role;
GRANT TRIGGER ON TABLE public.archived_shop_financial_records TO service_role;
GRANT TRUNCATE ON TABLE public.archived_shop_financial_records TO service_role;
GRANT UPDATE ON TABLE public.archived_shop_financial_records TO service_role;
GRANT DELETE ON TABLE public.atishare_console_manual_sends TO anon;
GRANT INSERT ON TABLE public.atishare_console_manual_sends TO anon;
GRANT REFERENCES ON TABLE public.atishare_console_manual_sends TO anon;
GRANT SELECT ON TABLE public.atishare_console_manual_sends TO anon;
GRANT TRIGGER ON TABLE public.atishare_console_manual_sends TO anon;
GRANT TRUNCATE ON TABLE public.atishare_console_manual_sends TO anon;
GRANT UPDATE ON TABLE public.atishare_console_manual_sends TO anon;
GRANT DELETE ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT INSERT ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT REFERENCES ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT SELECT ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT TRIGGER ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT TRUNCATE ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT UPDATE ON TABLE public.atishare_console_manual_sends TO authenticated;
GRANT DELETE ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT INSERT ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT REFERENCES ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT SELECT ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT TRIGGER ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT TRUNCATE ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT UPDATE ON TABLE public.atishare_console_manual_sends TO service_role;
GRANT DELETE ON TABLE public.commission_wallet_transactions TO anon;
GRANT INSERT ON TABLE public.commission_wallet_transactions TO anon;
GRANT REFERENCES ON TABLE public.commission_wallet_transactions TO anon;
GRANT SELECT ON TABLE public.commission_wallet_transactions TO anon;
GRANT TRIGGER ON TABLE public.commission_wallet_transactions TO anon;
GRANT TRUNCATE ON TABLE public.commission_wallet_transactions TO anon;
GRANT UPDATE ON TABLE public.commission_wallet_transactions TO anon;
GRANT DELETE ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT INSERT ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT REFERENCES ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT SELECT ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT TRIGGER ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT TRUNCATE ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT UPDATE ON TABLE public.commission_wallet_transactions TO authenticated;
GRANT DELETE ON TABLE public.commission_wallet_transactions TO service_role;
GRANT INSERT ON TABLE public.commission_wallet_transactions TO service_role;
GRANT REFERENCES ON TABLE public.commission_wallet_transactions TO service_role;
GRANT SELECT ON TABLE public.commission_wallet_transactions TO service_role;
GRANT TRIGGER ON TABLE public.commission_wallet_transactions TO service_role;
GRANT TRUNCATE ON TABLE public.commission_wallet_transactions TO service_role;
GRANT UPDATE ON TABLE public.commission_wallet_transactions TO service_role;
GRANT DELETE ON TABLE public.commission_wallets TO anon;
GRANT INSERT ON TABLE public.commission_wallets TO anon;
GRANT REFERENCES ON TABLE public.commission_wallets TO anon;
GRANT SELECT ON TABLE public.commission_wallets TO anon;
GRANT TRIGGER ON TABLE public.commission_wallets TO anon;
GRANT TRUNCATE ON TABLE public.commission_wallets TO anon;
GRANT UPDATE ON TABLE public.commission_wallets TO anon;
GRANT DELETE ON TABLE public.commission_wallets TO authenticated;
GRANT INSERT ON TABLE public.commission_wallets TO authenticated;
GRANT REFERENCES ON TABLE public.commission_wallets TO authenticated;
GRANT SELECT ON TABLE public.commission_wallets TO authenticated;
GRANT TRIGGER ON TABLE public.commission_wallets TO authenticated;
GRANT TRUNCATE ON TABLE public.commission_wallets TO authenticated;
GRANT UPDATE ON TABLE public.commission_wallets TO authenticated;
GRANT DELETE ON TABLE public.commission_wallets TO service_role;
GRANT INSERT ON TABLE public.commission_wallets TO service_role;
GRANT REFERENCES ON TABLE public.commission_wallets TO service_role;
GRANT SELECT ON TABLE public.commission_wallets TO service_role;
GRANT TRIGGER ON TABLE public.commission_wallets TO service_role;
GRANT TRUNCATE ON TABLE public.commission_wallets TO service_role;
GRANT UPDATE ON TABLE public.commission_wallets TO service_role;
GRANT REFERENCES ON TABLE public.complaints TO anon;
GRANT SELECT ON TABLE public.complaints TO anon;
GRANT TRIGGER ON TABLE public.complaints TO anon;
GRANT TRUNCATE ON TABLE public.complaints TO anon;
GRANT DELETE ON TABLE public.complaints TO authenticated;
GRANT INSERT ON TABLE public.complaints TO authenticated;
GRANT REFERENCES ON TABLE public.complaints TO authenticated;
GRANT SELECT ON TABLE public.complaints TO authenticated;
GRANT TRIGGER ON TABLE public.complaints TO authenticated;
GRANT TRUNCATE ON TABLE public.complaints TO authenticated;
GRANT UPDATE ON TABLE public.complaints TO authenticated;
GRANT DELETE ON TABLE public.complaints TO service_role;
GRANT INSERT ON TABLE public.complaints TO service_role;
GRANT REFERENCES ON TABLE public.complaints TO service_role;
GRANT SELECT ON TABLE public.complaints TO service_role;
GRANT TRIGGER ON TABLE public.complaints TO service_role;
GRANT TRUNCATE ON TABLE public.complaints TO service_role;
GRANT UPDATE ON TABLE public.complaints TO service_role;
GRANT REFERENCES ON TABLE public.customer_purchases TO anon;
GRANT SELECT ON TABLE public.customer_purchases TO anon;
GRANT TRIGGER ON TABLE public.customer_purchases TO anon;
GRANT TRUNCATE ON TABLE public.customer_purchases TO anon;
GRANT DELETE ON TABLE public.customer_purchases TO authenticated;
GRANT INSERT ON TABLE public.customer_purchases TO authenticated;
GRANT REFERENCES ON TABLE public.customer_purchases TO authenticated;
GRANT SELECT ON TABLE public.customer_purchases TO authenticated;
GRANT TRIGGER ON TABLE public.customer_purchases TO authenticated;
GRANT TRUNCATE ON TABLE public.customer_purchases TO authenticated;
GRANT UPDATE ON TABLE public.customer_purchases TO authenticated;
GRANT DELETE ON TABLE public.customer_purchases TO service_role;
GRANT INSERT ON TABLE public.customer_purchases TO service_role;
GRANT REFERENCES ON TABLE public.customer_purchases TO service_role;
GRANT SELECT ON TABLE public.customer_purchases TO service_role;
GRANT TRIGGER ON TABLE public.customer_purchases TO service_role;
GRANT TRUNCATE ON TABLE public.customer_purchases TO service_role;
GRANT UPDATE ON TABLE public.customer_purchases TO service_role;
GRANT REFERENCES ON TABLE public.data_packages TO anon;
GRANT SELECT ON TABLE public.data_packages TO anon;
GRANT TRIGGER ON TABLE public.data_packages TO anon;
GRANT TRUNCATE ON TABLE public.data_packages TO anon;
GRANT DELETE ON TABLE public.data_packages TO authenticated;
GRANT INSERT ON TABLE public.data_packages TO authenticated;
GRANT REFERENCES ON TABLE public.data_packages TO authenticated;
GRANT SELECT ON TABLE public.data_packages TO authenticated;
GRANT TRIGGER ON TABLE public.data_packages TO authenticated;
GRANT TRUNCATE ON TABLE public.data_packages TO authenticated;
GRANT UPDATE ON TABLE public.data_packages TO authenticated;
GRANT DELETE ON TABLE public.data_packages TO service_role;
GRANT INSERT ON TABLE public.data_packages TO service_role;
GRANT REFERENCES ON TABLE public.data_packages TO service_role;
GRANT SELECT ON TABLE public.data_packages TO service_role;
GRANT TRIGGER ON TABLE public.data_packages TO service_role;
GRANT TRUNCATE ON TABLE public.data_packages TO service_role;
GRANT UPDATE ON TABLE public.data_packages TO service_role;
GRANT REFERENCES ON TABLE public.download_batches TO anon;
GRANT SELECT ON TABLE public.download_batches TO anon;
GRANT TRIGGER ON TABLE public.download_batches TO anon;
GRANT TRUNCATE ON TABLE public.download_batches TO anon;
GRANT DELETE ON TABLE public.download_batches TO authenticated;
GRANT INSERT ON TABLE public.download_batches TO authenticated;
GRANT REFERENCES ON TABLE public.download_batches TO authenticated;
GRANT SELECT ON TABLE public.download_batches TO authenticated;
GRANT TRIGGER ON TABLE public.download_batches TO authenticated;
GRANT TRUNCATE ON TABLE public.download_batches TO authenticated;
GRANT UPDATE ON TABLE public.download_batches TO authenticated;
GRANT DELETE ON TABLE public.download_batches TO service_role;
GRANT INSERT ON TABLE public.download_batches TO service_role;
GRANT REFERENCES ON TABLE public.download_batches TO service_role;
GRANT SELECT ON TABLE public.download_batches TO service_role;
GRANT TRIGGER ON TABLE public.download_batches TO service_role;
GRANT TRUNCATE ON TABLE public.download_batches TO service_role;
GRANT UPDATE ON TABLE public.download_batches TO service_role;
GRANT REFERENCES ON TABLE public.fulfillment_logs TO anon;
GRANT SELECT ON TABLE public.fulfillment_logs TO anon;
GRANT TRIGGER ON TABLE public.fulfillment_logs TO anon;
GRANT TRUNCATE ON TABLE public.fulfillment_logs TO anon;
GRANT DELETE ON TABLE public.fulfillment_logs TO authenticated;
GRANT INSERT ON TABLE public.fulfillment_logs TO authenticated;
GRANT REFERENCES ON TABLE public.fulfillment_logs TO authenticated;
GRANT SELECT ON TABLE public.fulfillment_logs TO authenticated;
GRANT TRIGGER ON TABLE public.fulfillment_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.fulfillment_logs TO authenticated;
GRANT UPDATE ON TABLE public.fulfillment_logs TO authenticated;
GRANT DELETE ON TABLE public.fulfillment_logs TO service_role;
GRANT INSERT ON TABLE public.fulfillment_logs TO service_role;
GRANT REFERENCES ON TABLE public.fulfillment_logs TO service_role;
GRANT SELECT ON TABLE public.fulfillment_logs TO service_role;
GRANT TRIGGER ON TABLE public.fulfillment_logs TO service_role;
GRANT TRUNCATE ON TABLE public.fulfillment_logs TO service_role;
GRANT UPDATE ON TABLE public.fulfillment_logs TO service_role;
GRANT REFERENCES ON TABLE public.guest_push_subscriptions TO anon;
GRANT SELECT ON TABLE public.guest_push_subscriptions TO anon;
GRANT TRIGGER ON TABLE public.guest_push_subscriptions TO anon;
GRANT TRUNCATE ON TABLE public.guest_push_subscriptions TO anon;
GRANT DELETE ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT INSERT ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT REFERENCES ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT TRIGGER ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT TRUNCATE ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.guest_push_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.guest_push_subscriptions TO service_role;
GRANT INSERT ON TABLE public.guest_push_subscriptions TO service_role;
GRANT REFERENCES ON TABLE public.guest_push_subscriptions TO service_role;
GRANT SELECT ON TABLE public.guest_push_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.guest_push_subscriptions TO service_role;
GRANT TRUNCATE ON TABLE public.guest_push_subscriptions TO service_role;
GRANT UPDATE ON TABLE public.guest_push_subscriptions TO service_role;
GRANT DELETE ON TABLE public.hubtel_receive_charges TO anon;
GRANT INSERT ON TABLE public.hubtel_receive_charges TO anon;
GRANT REFERENCES ON TABLE public.hubtel_receive_charges TO anon;
GRANT SELECT ON TABLE public.hubtel_receive_charges TO anon;
GRANT TRIGGER ON TABLE public.hubtel_receive_charges TO anon;
GRANT TRUNCATE ON TABLE public.hubtel_receive_charges TO anon;
GRANT UPDATE ON TABLE public.hubtel_receive_charges TO anon;
GRANT DELETE ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT INSERT ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT REFERENCES ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT SELECT ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT TRIGGER ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT TRUNCATE ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT UPDATE ON TABLE public.hubtel_receive_charges TO authenticated;
GRANT DELETE ON TABLE public.hubtel_receive_charges TO service_role;
GRANT INSERT ON TABLE public.hubtel_receive_charges TO service_role;
GRANT REFERENCES ON TABLE public.hubtel_receive_charges TO service_role;
GRANT SELECT ON TABLE public.hubtel_receive_charges TO service_role;
GRANT TRIGGER ON TABLE public.hubtel_receive_charges TO service_role;
GRANT TRUNCATE ON TABLE public.hubtel_receive_charges TO service_role;
GRANT UPDATE ON TABLE public.hubtel_receive_charges TO service_role;
GRANT REFERENCES ON TABLE public.momo_claim_attempts TO anon;
GRANT SELECT ON TABLE public.momo_claim_attempts TO anon;
GRANT TRIGGER ON TABLE public.momo_claim_attempts TO anon;
GRANT TRUNCATE ON TABLE public.momo_claim_attempts TO anon;
GRANT DELETE ON TABLE public.momo_claim_attempts TO authenticated;
GRANT INSERT ON TABLE public.momo_claim_attempts TO authenticated;
GRANT REFERENCES ON TABLE public.momo_claim_attempts TO authenticated;
GRANT SELECT ON TABLE public.momo_claim_attempts TO authenticated;
GRANT TRIGGER ON TABLE public.momo_claim_attempts TO authenticated;
GRANT TRUNCATE ON TABLE public.momo_claim_attempts TO authenticated;
GRANT UPDATE ON TABLE public.momo_claim_attempts TO authenticated;
GRANT DELETE ON TABLE public.momo_claim_attempts TO service_role;
GRANT INSERT ON TABLE public.momo_claim_attempts TO service_role;
GRANT REFERENCES ON TABLE public.momo_claim_attempts TO service_role;
GRANT SELECT ON TABLE public.momo_claim_attempts TO service_role;
GRANT TRIGGER ON TABLE public.momo_claim_attempts TO service_role;
GRANT TRUNCATE ON TABLE public.momo_claim_attempts TO service_role;
GRANT UPDATE ON TABLE public.momo_claim_attempts TO service_role;
GRANT REFERENCES ON TABLE public.momo_transactions TO anon;
GRANT SELECT ON TABLE public.momo_transactions TO anon;
GRANT TRIGGER ON TABLE public.momo_transactions TO anon;
GRANT TRUNCATE ON TABLE public.momo_transactions TO anon;
GRANT DELETE ON TABLE public.momo_transactions TO authenticated;
GRANT INSERT ON TABLE public.momo_transactions TO authenticated;
GRANT REFERENCES ON TABLE public.momo_transactions TO authenticated;
GRANT SELECT ON TABLE public.momo_transactions TO authenticated;
GRANT TRIGGER ON TABLE public.momo_transactions TO authenticated;
GRANT TRUNCATE ON TABLE public.momo_transactions TO authenticated;
GRANT UPDATE ON TABLE public.momo_transactions TO authenticated;
GRANT DELETE ON TABLE public.momo_transactions TO service_role;
GRANT INSERT ON TABLE public.momo_transactions TO service_role;
GRANT REFERENCES ON TABLE public.momo_transactions TO service_role;
GRANT SELECT ON TABLE public.momo_transactions TO service_role;
GRANT TRIGGER ON TABLE public.momo_transactions TO service_role;
GRANT TRUNCATE ON TABLE public.momo_transactions TO service_role;
GRANT UPDATE ON TABLE public.momo_transactions TO service_role;
GRANT REFERENCES ON TABLE public.mtn_fulfillment_tracking TO anon;
GRANT SELECT ON TABLE public.mtn_fulfillment_tracking TO anon;
GRANT TRIGGER ON TABLE public.mtn_fulfillment_tracking TO anon;
GRANT TRUNCATE ON TABLE public.mtn_fulfillment_tracking TO anon;
GRANT DELETE ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT INSERT ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT REFERENCES ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT SELECT ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT TRIGGER ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT TRUNCATE ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT UPDATE ON TABLE public.mtn_fulfillment_tracking TO authenticated;
GRANT DELETE ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT INSERT ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT REFERENCES ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT SELECT ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT TRIGGER ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT TRUNCATE ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT UPDATE ON TABLE public.mtn_fulfillment_tracking TO service_role;
GRANT REFERENCES ON TABLE public.mtn_whitelist_server_status TO authenticated;
GRANT SELECT ON TABLE public.mtn_whitelist_server_status TO authenticated;
GRANT TRIGGER ON TABLE public.mtn_whitelist_server_status TO authenticated;
GRANT DELETE ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT INSERT ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT REFERENCES ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT SELECT ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT TRIGGER ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT TRUNCATE ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT UPDATE ON TABLE public.mtn_whitelist_server_status TO service_role;
GRANT DELETE ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT INSERT ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT REFERENCES ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT SELECT ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT TRIGGER ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT TRUNCATE ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT UPDATE ON TABLE public.mtn_whitelist_status TO authenticated;
GRANT DELETE ON TABLE public.mtn_whitelist_status TO service_role;
GRANT INSERT ON TABLE public.mtn_whitelist_status TO service_role;
GRANT REFERENCES ON TABLE public.mtn_whitelist_status TO service_role;
GRANT SELECT ON TABLE public.mtn_whitelist_status TO service_role;
GRANT TRIGGER ON TABLE public.mtn_whitelist_status TO service_role;
GRANT TRUNCATE ON TABLE public.mtn_whitelist_status TO service_role;
GRANT UPDATE ON TABLE public.mtn_whitelist_status TO service_role;
GRANT REFERENCES ON TABLE public.notifications TO anon;
GRANT SELECT ON TABLE public.notifications TO anon;
GRANT TRIGGER ON TABLE public.notifications TO anon;
GRANT TRUNCATE ON TABLE public.notifications TO anon;
GRANT DELETE ON TABLE public.notifications TO authenticated;
GRANT INSERT ON TABLE public.notifications TO authenticated;
GRANT REFERENCES ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT TRIGGER ON TABLE public.notifications TO authenticated;
GRANT TRUNCATE ON TABLE public.notifications TO authenticated;
GRANT UPDATE ON TABLE public.notifications TO authenticated;
GRANT DELETE ON TABLE public.notifications TO service_role;
GRANT INSERT ON TABLE public.notifications TO service_role;
GRANT REFERENCES ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.notifications TO service_role;
GRANT TRIGGER ON TABLE public.notifications TO service_role;
GRANT TRUNCATE ON TABLE public.notifications TO service_role;
GRANT UPDATE ON TABLE public.notifications TO service_role;
GRANT DELETE ON TABLE public.number_registration_batches TO authenticated;
GRANT INSERT ON TABLE public.number_registration_batches TO authenticated;
GRANT REFERENCES ON TABLE public.number_registration_batches TO authenticated;
GRANT SELECT ON TABLE public.number_registration_batches TO authenticated;
GRANT TRIGGER ON TABLE public.number_registration_batches TO authenticated;
GRANT TRUNCATE ON TABLE public.number_registration_batches TO authenticated;
GRANT UPDATE ON TABLE public.number_registration_batches TO authenticated;
GRANT DELETE ON TABLE public.number_registration_batches TO service_role;
GRANT INSERT ON TABLE public.number_registration_batches TO service_role;
GRANT REFERENCES ON TABLE public.number_registration_batches TO service_role;
GRANT SELECT ON TABLE public.number_registration_batches TO service_role;
GRANT TRIGGER ON TABLE public.number_registration_batches TO service_role;
GRANT TRUNCATE ON TABLE public.number_registration_batches TO service_role;
GRANT UPDATE ON TABLE public.number_registration_batches TO service_role;
GRANT DELETE ON TABLE public.number_registrations TO authenticated;
GRANT INSERT ON TABLE public.number_registrations TO authenticated;
GRANT REFERENCES ON TABLE public.number_registrations TO authenticated;
GRANT SELECT ON TABLE public.number_registrations TO authenticated;
GRANT TRIGGER ON TABLE public.number_registrations TO authenticated;
GRANT TRUNCATE ON TABLE public.number_registrations TO authenticated;
GRANT UPDATE ON TABLE public.number_registrations TO authenticated;
GRANT DELETE ON TABLE public.number_registrations TO service_role;
GRANT INSERT ON TABLE public.number_registrations TO service_role;
GRANT REFERENCES ON TABLE public.number_registrations TO service_role;
GRANT SELECT ON TABLE public.number_registrations TO service_role;
GRANT TRIGGER ON TABLE public.number_registrations TO service_role;
GRANT TRUNCATE ON TABLE public.number_registrations TO service_role;
GRANT UPDATE ON TABLE public.number_registrations TO service_role;
GRANT DELETE ON TABLE public.order_retry_attempts TO service_role;
GRANT INSERT ON TABLE public.order_retry_attempts TO service_role;
GRANT REFERENCES ON TABLE public.order_retry_attempts TO service_role;
GRANT SELECT ON TABLE public.order_retry_attempts TO service_role;
GRANT TRIGGER ON TABLE public.order_retry_attempts TO service_role;
GRANT TRUNCATE ON TABLE public.order_retry_attempts TO service_role;
GRANT UPDATE ON TABLE public.order_retry_attempts TO service_role;
GRANT REFERENCES ON TABLE public.orders TO anon;
GRANT SELECT ON TABLE public.orders TO anon;
GRANT TRIGGER ON TABLE public.orders TO anon;
GRANT TRUNCATE ON TABLE public.orders TO anon;
GRANT REFERENCES ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT TRIGGER ON TABLE public.orders TO authenticated;
GRANT TRUNCATE ON TABLE public.orders TO authenticated;
GRANT DELETE ON TABLE public.orders TO service_role;
GRANT INSERT ON TABLE public.orders TO service_role;
GRANT REFERENCES ON TABLE public.orders TO service_role;
GRANT SELECT ON TABLE public.orders TO service_role;
GRANT TRIGGER ON TABLE public.orders TO service_role;
GRANT TRUNCATE ON TABLE public.orders TO service_role;
GRANT UPDATE ON TABLE public.orders TO service_role;
GRANT REFERENCES ON TABLE public.passkey_challenges TO anon;
GRANT SELECT ON TABLE public.passkey_challenges TO anon;
GRANT TRIGGER ON TABLE public.passkey_challenges TO anon;
GRANT TRUNCATE ON TABLE public.passkey_challenges TO anon;
GRANT DELETE ON TABLE public.passkey_challenges TO authenticated;
GRANT INSERT ON TABLE public.passkey_challenges TO authenticated;
GRANT REFERENCES ON TABLE public.passkey_challenges TO authenticated;
GRANT SELECT ON TABLE public.passkey_challenges TO authenticated;
GRANT TRIGGER ON TABLE public.passkey_challenges TO authenticated;
GRANT TRUNCATE ON TABLE public.passkey_challenges TO authenticated;
GRANT UPDATE ON TABLE public.passkey_challenges TO authenticated;
GRANT DELETE ON TABLE public.passkey_challenges TO service_role;
GRANT INSERT ON TABLE public.passkey_challenges TO service_role;
GRANT REFERENCES ON TABLE public.passkey_challenges TO service_role;
GRANT SELECT ON TABLE public.passkey_challenges TO service_role;
GRANT TRIGGER ON TABLE public.passkey_challenges TO service_role;
GRANT TRUNCATE ON TABLE public.passkey_challenges TO service_role;
GRANT UPDATE ON TABLE public.passkey_challenges TO service_role;
GRANT REFERENCES ON TABLE public.passkey_credentials TO anon;
GRANT SELECT ON TABLE public.passkey_credentials TO anon;
GRANT TRIGGER ON TABLE public.passkey_credentials TO anon;
GRANT TRUNCATE ON TABLE public.passkey_credentials TO anon;
GRANT DELETE ON TABLE public.passkey_credentials TO authenticated;
GRANT INSERT ON TABLE public.passkey_credentials TO authenticated;
GRANT REFERENCES ON TABLE public.passkey_credentials TO authenticated;
GRANT SELECT ON TABLE public.passkey_credentials TO authenticated;
GRANT TRIGGER ON TABLE public.passkey_credentials TO authenticated;
GRANT TRUNCATE ON TABLE public.passkey_credentials TO authenticated;
GRANT UPDATE ON TABLE public.passkey_credentials TO authenticated;
GRANT DELETE ON TABLE public.passkey_credentials TO service_role;
GRANT INSERT ON TABLE public.passkey_credentials TO service_role;
GRANT REFERENCES ON TABLE public.passkey_credentials TO service_role;
GRANT SELECT ON TABLE public.passkey_credentials TO service_role;
GRANT TRIGGER ON TABLE public.passkey_credentials TO service_role;
GRANT TRUNCATE ON TABLE public.passkey_credentials TO service_role;
GRANT UPDATE ON TABLE public.passkey_credentials TO service_role;
GRANT REFERENCES ON TABLE public.pending_settlements TO anon;
GRANT SELECT ON TABLE public.pending_settlements TO anon;
GRANT TRIGGER ON TABLE public.pending_settlements TO anon;
GRANT TRUNCATE ON TABLE public.pending_settlements TO anon;
GRANT DELETE ON TABLE public.pending_settlements TO authenticated;
GRANT INSERT ON TABLE public.pending_settlements TO authenticated;
GRANT REFERENCES ON TABLE public.pending_settlements TO authenticated;
GRANT SELECT ON TABLE public.pending_settlements TO authenticated;
GRANT TRIGGER ON TABLE public.pending_settlements TO authenticated;
GRANT TRUNCATE ON TABLE public.pending_settlements TO authenticated;
GRANT UPDATE ON TABLE public.pending_settlements TO authenticated;
GRANT DELETE ON TABLE public.pending_settlements TO service_role;
GRANT INSERT ON TABLE public.pending_settlements TO service_role;
GRANT REFERENCES ON TABLE public.pending_settlements TO service_role;
GRANT SELECT ON TABLE public.pending_settlements TO service_role;
GRANT TRIGGER ON TABLE public.pending_settlements TO service_role;
GRANT TRUNCATE ON TABLE public.pending_settlements TO service_role;
GRANT UPDATE ON TABLE public.pending_settlements TO service_role;
GRANT REFERENCES ON TABLE public.phone_blacklist TO anon;
GRANT TRIGGER ON TABLE public.phone_blacklist TO anon;
GRANT TRUNCATE ON TABLE public.phone_blacklist TO anon;
GRANT DELETE ON TABLE public.phone_blacklist TO authenticated;
GRANT INSERT ON TABLE public.phone_blacklist TO authenticated;
GRANT REFERENCES ON TABLE public.phone_blacklist TO authenticated;
GRANT SELECT ON TABLE public.phone_blacklist TO authenticated;
GRANT TRIGGER ON TABLE public.phone_blacklist TO authenticated;
GRANT TRUNCATE ON TABLE public.phone_blacklist TO authenticated;
GRANT UPDATE ON TABLE public.phone_blacklist TO authenticated;
GRANT DELETE ON TABLE public.phone_blacklist TO service_role;
GRANT INSERT ON TABLE public.phone_blacklist TO service_role;
GRANT REFERENCES ON TABLE public.phone_blacklist TO service_role;
GRANT SELECT ON TABLE public.phone_blacklist TO service_role;
GRANT TRIGGER ON TABLE public.phone_blacklist TO service_role;
GRANT TRUNCATE ON TABLE public.phone_blacklist TO service_role;
GRANT UPDATE ON TABLE public.phone_blacklist TO service_role;
GRANT REFERENCES ON TABLE public.phone_otp_verifications TO anon;
GRANT SELECT ON TABLE public.phone_otp_verifications TO anon;
GRANT TRIGGER ON TABLE public.phone_otp_verifications TO anon;
GRANT TRUNCATE ON TABLE public.phone_otp_verifications TO anon;
GRANT DELETE ON TABLE public.phone_otp_verifications TO authenticated;
GRANT INSERT ON TABLE public.phone_otp_verifications TO authenticated;
GRANT REFERENCES ON TABLE public.phone_otp_verifications TO authenticated;
GRANT SELECT ON TABLE public.phone_otp_verifications TO authenticated;
GRANT TRIGGER ON TABLE public.phone_otp_verifications TO authenticated;
GRANT TRUNCATE ON TABLE public.phone_otp_verifications TO authenticated;
GRANT UPDATE ON TABLE public.phone_otp_verifications TO authenticated;
GRANT DELETE ON TABLE public.phone_otp_verifications TO service_role;
GRANT INSERT ON TABLE public.phone_otp_verifications TO service_role;
GRANT REFERENCES ON TABLE public.phone_otp_verifications TO service_role;
GRANT SELECT ON TABLE public.phone_otp_verifications TO service_role;
GRANT TRIGGER ON TABLE public.phone_otp_verifications TO service_role;
GRANT TRUNCATE ON TABLE public.phone_otp_verifications TO service_role;
GRANT UPDATE ON TABLE public.phone_otp_verifications TO service_role;
GRANT DELETE ON TABLE public.phone_recovery_attempts TO service_role;
GRANT INSERT ON TABLE public.phone_recovery_attempts TO service_role;
GRANT REFERENCES ON TABLE public.phone_recovery_attempts TO service_role;
GRANT SELECT ON TABLE public.phone_recovery_attempts TO service_role;
GRANT TRIGGER ON TABLE public.phone_recovery_attempts TO service_role;
GRANT TRUNCATE ON TABLE public.phone_recovery_attempts TO service_role;
GRANT UPDATE ON TABLE public.phone_recovery_attempts TO service_role;
GRANT REFERENCES ON TABLE public.push_subscriptions TO anon;
GRANT SELECT ON TABLE public.push_subscriptions TO anon;
GRANT TRIGGER ON TABLE public.push_subscriptions TO anon;
GRANT TRUNCATE ON TABLE public.push_subscriptions TO anon;
GRANT DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT INSERT ON TABLE public.push_subscriptions TO authenticated;
GRANT REFERENCES ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.push_subscriptions TO authenticated;
GRANT TRIGGER ON TABLE public.push_subscriptions TO authenticated;
GRANT TRUNCATE ON TABLE public.push_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.push_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.push_subscriptions TO service_role;
GRANT INSERT ON TABLE public.push_subscriptions TO service_role;
GRANT REFERENCES ON TABLE public.push_subscriptions TO service_role;
GRANT SELECT ON TABLE public.push_subscriptions TO service_role;
GRANT TRIGGER ON TABLE public.push_subscriptions TO service_role;
GRANT TRUNCATE ON TABLE public.push_subscriptions TO service_role;
GRANT UPDATE ON TABLE public.push_subscriptions TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_complaints TO anon;
GRANT SELECT ON TABLE public.results_checker_complaints TO anon;
GRANT TRIGGER ON TABLE public.results_checker_complaints TO anon;
GRANT TRUNCATE ON TABLE public.results_checker_complaints TO anon;
GRANT REFERENCES ON TABLE public.results_checker_complaints TO authenticated;
GRANT SELECT ON TABLE public.results_checker_complaints TO authenticated;
GRANT TRIGGER ON TABLE public.results_checker_complaints TO authenticated;
GRANT TRUNCATE ON TABLE public.results_checker_complaints TO authenticated;
GRANT DELETE ON TABLE public.results_checker_complaints TO service_role;
GRANT INSERT ON TABLE public.results_checker_complaints TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_complaints TO service_role;
GRANT SELECT ON TABLE public.results_checker_complaints TO service_role;
GRANT TRIGGER ON TABLE public.results_checker_complaints TO service_role;
GRANT TRUNCATE ON TABLE public.results_checker_complaints TO service_role;
GRANT UPDATE ON TABLE public.results_checker_complaints TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_inventory TO anon;
GRANT SELECT ON TABLE public.results_checker_inventory TO anon;
GRANT TRIGGER ON TABLE public.results_checker_inventory TO anon;
GRANT TRUNCATE ON TABLE public.results_checker_inventory TO anon;
GRANT REFERENCES ON TABLE public.results_checker_inventory TO authenticated;
GRANT SELECT ON TABLE public.results_checker_inventory TO authenticated;
GRANT TRIGGER ON TABLE public.results_checker_inventory TO authenticated;
GRANT TRUNCATE ON TABLE public.results_checker_inventory TO authenticated;
GRANT DELETE ON TABLE public.results_checker_inventory TO service_role;
GRANT INSERT ON TABLE public.results_checker_inventory TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_inventory TO service_role;
GRANT SELECT ON TABLE public.results_checker_inventory TO service_role;
GRANT TRIGGER ON TABLE public.results_checker_inventory TO service_role;
GRANT TRUNCATE ON TABLE public.results_checker_inventory TO service_role;
GRANT UPDATE ON TABLE public.results_checker_inventory TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_orders TO anon;
GRANT SELECT ON TABLE public.results_checker_orders TO anon;
GRANT TRIGGER ON TABLE public.results_checker_orders TO anon;
GRANT TRUNCATE ON TABLE public.results_checker_orders TO anon;
GRANT REFERENCES ON TABLE public.results_checker_orders TO authenticated;
GRANT SELECT ON TABLE public.results_checker_orders TO authenticated;
GRANT TRIGGER ON TABLE public.results_checker_orders TO authenticated;
GRANT TRUNCATE ON TABLE public.results_checker_orders TO authenticated;
GRANT DELETE ON TABLE public.results_checker_orders TO service_role;
GRANT INSERT ON TABLE public.results_checker_orders TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_orders TO service_role;
GRANT SELECT ON TABLE public.results_checker_orders TO service_role;
GRANT TRIGGER ON TABLE public.results_checker_orders TO service_role;
GRANT TRUNCATE ON TABLE public.results_checker_orders TO service_role;
GRANT UPDATE ON TABLE public.results_checker_orders TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_types TO anon;
GRANT SELECT ON TABLE public.results_checker_types TO anon;
GRANT TRIGGER ON TABLE public.results_checker_types TO anon;
GRANT TRUNCATE ON TABLE public.results_checker_types TO anon;
GRANT DELETE ON TABLE public.results_checker_types TO authenticated;
GRANT INSERT ON TABLE public.results_checker_types TO authenticated;
GRANT REFERENCES ON TABLE public.results_checker_types TO authenticated;
GRANT SELECT ON TABLE public.results_checker_types TO authenticated;
GRANT TRIGGER ON TABLE public.results_checker_types TO authenticated;
GRANT TRUNCATE ON TABLE public.results_checker_types TO authenticated;
GRANT UPDATE ON TABLE public.results_checker_types TO authenticated;
GRANT DELETE ON TABLE public.results_checker_types TO service_role;
GRANT INSERT ON TABLE public.results_checker_types TO service_role;
GRANT REFERENCES ON TABLE public.results_checker_types TO service_role;
GRANT SELECT ON TABLE public.results_checker_types TO service_role;
GRANT TRIGGER ON TABLE public.results_checker_types TO service_role;
GRANT TRUNCATE ON TABLE public.results_checker_types TO service_role;
GRANT UPDATE ON TABLE public.results_checker_types TO service_role;
GRANT DELETE ON TABLE public.security_events TO service_role;
GRANT INSERT ON TABLE public.security_events TO service_role;
GRANT REFERENCES ON TABLE public.security_events TO service_role;
GRANT SELECT ON TABLE public.security_events TO service_role;
GRANT TRIGGER ON TABLE public.security_events TO service_role;
GRANT TRUNCATE ON TABLE public.security_events TO service_role;
GRANT UPDATE ON TABLE public.security_events TO service_role;
GRANT DELETE ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT INSERT ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT REFERENCES ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT SELECT ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT TRIGGER ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT TRUNCATE ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT UPDATE ON TABLE public.shop_afa_pending_orders TO service_role;
GRANT REFERENCES ON TABLE public.shop_announcements TO anon;
GRANT SELECT ON TABLE public.shop_announcements TO anon;
GRANT TRIGGER ON TABLE public.shop_announcements TO anon;
GRANT TRUNCATE ON TABLE public.shop_announcements TO anon;
GRANT DELETE ON TABLE public.shop_announcements TO authenticated;
GRANT INSERT ON TABLE public.shop_announcements TO authenticated;
GRANT REFERENCES ON TABLE public.shop_announcements TO authenticated;
GRANT SELECT ON TABLE public.shop_announcements TO authenticated;
GRANT TRIGGER ON TABLE public.shop_announcements TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_announcements TO authenticated;
GRANT UPDATE ON TABLE public.shop_announcements TO authenticated;
GRANT DELETE ON TABLE public.shop_announcements TO service_role;
GRANT INSERT ON TABLE public.shop_announcements TO service_role;
GRANT REFERENCES ON TABLE public.shop_announcements TO service_role;
GRANT SELECT ON TABLE public.shop_announcements TO service_role;
GRANT TRIGGER ON TABLE public.shop_announcements TO service_role;
GRANT TRUNCATE ON TABLE public.shop_announcements TO service_role;
GRANT UPDATE ON TABLE public.shop_announcements TO service_role;
GRANT REFERENCES ON TABLE public.shop_customers TO anon;
GRANT SELECT ON TABLE public.shop_customers TO anon;
GRANT TRIGGER ON TABLE public.shop_customers TO anon;
GRANT TRUNCATE ON TABLE public.shop_customers TO anon;
GRANT REFERENCES ON TABLE public.shop_customers TO authenticated;
GRANT SELECT ON TABLE public.shop_customers TO authenticated;
GRANT TRIGGER ON TABLE public.shop_customers TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_customers TO authenticated;
GRANT DELETE ON TABLE public.shop_customers TO service_role;
GRANT INSERT ON TABLE public.shop_customers TO service_role;
GRANT REFERENCES ON TABLE public.shop_customers TO service_role;
GRANT SELECT ON TABLE public.shop_customers TO service_role;
GRANT TRIGGER ON TABLE public.shop_customers TO service_role;
GRANT TRUNCATE ON TABLE public.shop_customers TO service_role;
GRANT UPDATE ON TABLE public.shop_customers TO service_role;
GRANT REFERENCES ON TABLE public.shop_global_settings TO anon;
GRANT SELECT ON TABLE public.shop_global_settings TO anon;
GRANT TRIGGER ON TABLE public.shop_global_settings TO anon;
GRANT TRUNCATE ON TABLE public.shop_global_settings TO anon;
GRANT DELETE ON TABLE public.shop_global_settings TO authenticated;
GRANT INSERT ON TABLE public.shop_global_settings TO authenticated;
GRANT REFERENCES ON TABLE public.shop_global_settings TO authenticated;
GRANT SELECT ON TABLE public.shop_global_settings TO authenticated;
GRANT TRIGGER ON TABLE public.shop_global_settings TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_global_settings TO authenticated;
GRANT UPDATE ON TABLE public.shop_global_settings TO authenticated;
GRANT DELETE ON TABLE public.shop_global_settings TO service_role;
GRANT INSERT ON TABLE public.shop_global_settings TO service_role;
GRANT REFERENCES ON TABLE public.shop_global_settings TO service_role;
GRANT SELECT ON TABLE public.shop_global_settings TO service_role;
GRANT TRIGGER ON TABLE public.shop_global_settings TO service_role;
GRANT TRUNCATE ON TABLE public.shop_global_settings TO service_role;
GRANT UPDATE ON TABLE public.shop_global_settings TO service_role;
GRANT DELETE ON TABLE public.shop_invites TO anon;
GRANT INSERT ON TABLE public.shop_invites TO anon;
GRANT REFERENCES ON TABLE public.shop_invites TO anon;
GRANT SELECT ON TABLE public.shop_invites TO anon;
GRANT TRIGGER ON TABLE public.shop_invites TO anon;
GRANT TRUNCATE ON TABLE public.shop_invites TO anon;
GRANT UPDATE ON TABLE public.shop_invites TO anon;
GRANT DELETE ON TABLE public.shop_invites TO authenticated;
GRANT INSERT ON TABLE public.shop_invites TO authenticated;
GRANT REFERENCES ON TABLE public.shop_invites TO authenticated;
GRANT SELECT ON TABLE public.shop_invites TO authenticated;
GRANT TRIGGER ON TABLE public.shop_invites TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_invites TO authenticated;
GRANT UPDATE ON TABLE public.shop_invites TO authenticated;
GRANT DELETE ON TABLE public.shop_invites TO service_role;
GRANT INSERT ON TABLE public.shop_invites TO service_role;
GRANT REFERENCES ON TABLE public.shop_invites TO service_role;
GRANT SELECT ON TABLE public.shop_invites TO service_role;
GRANT TRIGGER ON TABLE public.shop_invites TO service_role;
GRANT TRUNCATE ON TABLE public.shop_invites TO service_role;
GRANT UPDATE ON TABLE public.shop_invites TO service_role;
GRANT DELETE ON TABLE public.shop_order_splits TO anon;
GRANT INSERT ON TABLE public.shop_order_splits TO anon;
GRANT REFERENCES ON TABLE public.shop_order_splits TO anon;
GRANT SELECT ON TABLE public.shop_order_splits TO anon;
GRANT TRIGGER ON TABLE public.shop_order_splits TO anon;
GRANT TRUNCATE ON TABLE public.shop_order_splits TO anon;
GRANT UPDATE ON TABLE public.shop_order_splits TO anon;
GRANT DELETE ON TABLE public.shop_order_splits TO authenticated;
GRANT INSERT ON TABLE public.shop_order_splits TO authenticated;
GRANT REFERENCES ON TABLE public.shop_order_splits TO authenticated;
GRANT SELECT ON TABLE public.shop_order_splits TO authenticated;
GRANT TRIGGER ON TABLE public.shop_order_splits TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_order_splits TO authenticated;
GRANT UPDATE ON TABLE public.shop_order_splits TO authenticated;
GRANT DELETE ON TABLE public.shop_order_splits TO service_role;
GRANT INSERT ON TABLE public.shop_order_splits TO service_role;
GRANT REFERENCES ON TABLE public.shop_order_splits TO service_role;
GRANT SELECT ON TABLE public.shop_order_splits TO service_role;
GRANT TRIGGER ON TABLE public.shop_order_splits TO service_role;
GRANT TRUNCATE ON TABLE public.shop_order_splits TO service_role;
GRANT UPDATE ON TABLE public.shop_order_splits TO service_role;
GRANT REFERENCES ON TABLE public.shop_orders TO anon;
GRANT TRIGGER ON TABLE public.shop_orders TO anon;
GRANT TRUNCATE ON TABLE public.shop_orders TO anon;
GRANT REFERENCES ON TABLE public.shop_orders TO authenticated;
GRANT SELECT ON TABLE public.shop_orders TO authenticated;
GRANT TRIGGER ON TABLE public.shop_orders TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_orders TO authenticated;
GRANT DELETE ON TABLE public.shop_orders TO service_role;
GRANT INSERT ON TABLE public.shop_orders TO service_role;
GRANT REFERENCES ON TABLE public.shop_orders TO service_role;
GRANT SELECT ON TABLE public.shop_orders TO service_role;
GRANT TRIGGER ON TABLE public.shop_orders TO service_role;
GRANT TRUNCATE ON TABLE public.shop_orders TO service_role;
GRANT UPDATE ON TABLE public.shop_orders TO service_role;
GRANT DELETE ON TABLE public.shop_orders_effective TO anon;
GRANT INSERT ON TABLE public.shop_orders_effective TO anon;
GRANT REFERENCES ON TABLE public.shop_orders_effective TO anon;
GRANT SELECT ON TABLE public.shop_orders_effective TO anon;
GRANT TRIGGER ON TABLE public.shop_orders_effective TO anon;
GRANT TRUNCATE ON TABLE public.shop_orders_effective TO anon;
GRANT UPDATE ON TABLE public.shop_orders_effective TO anon;
GRANT DELETE ON TABLE public.shop_orders_effective TO authenticated;
GRANT INSERT ON TABLE public.shop_orders_effective TO authenticated;
GRANT REFERENCES ON TABLE public.shop_orders_effective TO authenticated;
GRANT SELECT ON TABLE public.shop_orders_effective TO authenticated;
GRANT TRIGGER ON TABLE public.shop_orders_effective TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_orders_effective TO authenticated;
GRANT UPDATE ON TABLE public.shop_orders_effective TO authenticated;
GRANT DELETE ON TABLE public.shop_orders_effective TO service_role;
GRANT INSERT ON TABLE public.shop_orders_effective TO service_role;
GRANT REFERENCES ON TABLE public.shop_orders_effective TO service_role;
GRANT SELECT ON TABLE public.shop_orders_effective TO service_role;
GRANT TRIGGER ON TABLE public.shop_orders_effective TO service_role;
GRANT TRUNCATE ON TABLE public.shop_orders_effective TO service_role;
GRANT UPDATE ON TABLE public.shop_orders_effective TO service_role;
GRANT REFERENCES ON TABLE public.shop_payment_details TO anon;
GRANT SELECT ON TABLE public.shop_payment_details TO anon;
GRANT TRIGGER ON TABLE public.shop_payment_details TO anon;
GRANT TRUNCATE ON TABLE public.shop_payment_details TO anon;
GRANT DELETE ON TABLE public.shop_payment_details TO authenticated;
GRANT REFERENCES ON TABLE public.shop_payment_details TO authenticated;
GRANT SELECT ON TABLE public.shop_payment_details TO authenticated;
GRANT TRIGGER ON TABLE public.shop_payment_details TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_payment_details TO authenticated;
GRANT DELETE ON TABLE public.shop_payment_details TO service_role;
GRANT INSERT ON TABLE public.shop_payment_details TO service_role;
GRANT REFERENCES ON TABLE public.shop_payment_details TO service_role;
GRANT SELECT ON TABLE public.shop_payment_details TO service_role;
GRANT TRIGGER ON TABLE public.shop_payment_details TO service_role;
GRANT TRUNCATE ON TABLE public.shop_payment_details TO service_role;
GRANT UPDATE ON TABLE public.shop_payment_details TO service_role;
GRANT REFERENCES ON TABLE public.shop_pricing TO anon;
GRANT TRIGGER ON TABLE public.shop_pricing TO anon;
GRANT TRUNCATE ON TABLE public.shop_pricing TO anon;
GRANT DELETE ON TABLE public.shop_pricing TO authenticated;
GRANT INSERT ON TABLE public.shop_pricing TO authenticated;
GRANT REFERENCES ON TABLE public.shop_pricing TO authenticated;
GRANT TRIGGER ON TABLE public.shop_pricing TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_pricing TO authenticated;
GRANT UPDATE ON TABLE public.shop_pricing TO authenticated;
GRANT DELETE ON TABLE public.shop_pricing TO service_role;
GRANT INSERT ON TABLE public.shop_pricing TO service_role;
GRANT REFERENCES ON TABLE public.shop_pricing TO service_role;
GRANT SELECT ON TABLE public.shop_pricing TO service_role;
GRANT TRIGGER ON TABLE public.shop_pricing TO service_role;
GRANT TRUNCATE ON TABLE public.shop_pricing TO service_role;
GRANT UPDATE ON TABLE public.shop_pricing TO service_role;
GRANT REFERENCES ON TABLE public.shop_pricing_logs TO anon;
GRANT SELECT ON TABLE public.shop_pricing_logs TO anon;
GRANT TRIGGER ON TABLE public.shop_pricing_logs TO anon;
GRANT TRUNCATE ON TABLE public.shop_pricing_logs TO anon;
GRANT DELETE ON TABLE public.shop_pricing_logs TO authenticated;
GRANT INSERT ON TABLE public.shop_pricing_logs TO authenticated;
GRANT REFERENCES ON TABLE public.shop_pricing_logs TO authenticated;
GRANT SELECT ON TABLE public.shop_pricing_logs TO authenticated;
GRANT TRIGGER ON TABLE public.shop_pricing_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_pricing_logs TO authenticated;
GRANT UPDATE ON TABLE public.shop_pricing_logs TO authenticated;
GRANT DELETE ON TABLE public.shop_pricing_logs TO service_role;
GRANT INSERT ON TABLE public.shop_pricing_logs TO service_role;
GRANT REFERENCES ON TABLE public.shop_pricing_logs TO service_role;
GRANT SELECT ON TABLE public.shop_pricing_logs TO service_role;
GRANT TRIGGER ON TABLE public.shop_pricing_logs TO service_role;
GRANT TRUNCATE ON TABLE public.shop_pricing_logs TO service_role;
GRANT UPDATE ON TABLE public.shop_pricing_logs TO service_role;
GRANT REFERENCES ON TABLE public.shop_pricing_pending TO anon;
GRANT SELECT ON TABLE public.shop_pricing_pending TO anon;
GRANT TRIGGER ON TABLE public.shop_pricing_pending TO anon;
GRANT TRUNCATE ON TABLE public.shop_pricing_pending TO anon;
GRANT DELETE ON TABLE public.shop_pricing_pending TO authenticated;
GRANT INSERT ON TABLE public.shop_pricing_pending TO authenticated;
GRANT REFERENCES ON TABLE public.shop_pricing_pending TO authenticated;
GRANT SELECT ON TABLE public.shop_pricing_pending TO authenticated;
GRANT TRIGGER ON TABLE public.shop_pricing_pending TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_pricing_pending TO authenticated;
GRANT UPDATE ON TABLE public.shop_pricing_pending TO authenticated;
GRANT DELETE ON TABLE public.shop_pricing_pending TO service_role;
GRANT INSERT ON TABLE public.shop_pricing_pending TO service_role;
GRANT REFERENCES ON TABLE public.shop_pricing_pending TO service_role;
GRANT SELECT ON TABLE public.shop_pricing_pending TO service_role;
GRANT TRIGGER ON TABLE public.shop_pricing_pending TO service_role;
GRANT TRUNCATE ON TABLE public.shop_pricing_pending TO service_role;
GRANT UPDATE ON TABLE public.shop_pricing_pending TO service_role;
GRANT REFERENCES ON TABLE public.shop_profiles TO anon;
GRANT SELECT ON TABLE public.shop_profiles TO anon;
GRANT TRIGGER ON TABLE public.shop_profiles TO anon;
GRANT TRUNCATE ON TABLE public.shop_profiles TO anon;
GRANT DELETE ON TABLE public.shop_profiles TO authenticated;
GRANT INSERT ON TABLE public.shop_profiles TO authenticated;
GRANT REFERENCES ON TABLE public.shop_profiles TO authenticated;
GRANT SELECT ON TABLE public.shop_profiles TO authenticated;
GRANT TRIGGER ON TABLE public.shop_profiles TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_profiles TO authenticated;
GRANT UPDATE ON TABLE public.shop_profiles TO authenticated;
GRANT DELETE ON TABLE public.shop_profiles TO service_role;
GRANT INSERT ON TABLE public.shop_profiles TO service_role;
GRANT REFERENCES ON TABLE public.shop_profiles TO service_role;
GRANT SELECT ON TABLE public.shop_profiles TO service_role;
GRANT TRIGGER ON TABLE public.shop_profiles TO service_role;
GRANT TRUNCATE ON TABLE public.shop_profiles TO service_role;
GRANT UPDATE ON TABLE public.shop_profiles TO service_role;
GRANT REFERENCES ON TABLE public.shop_rc_markups TO anon;
GRANT SELECT ON TABLE public.shop_rc_markups TO anon;
GRANT TRIGGER ON TABLE public.shop_rc_markups TO anon;
GRANT TRUNCATE ON TABLE public.shop_rc_markups TO anon;
GRANT DELETE ON TABLE public.shop_rc_markups TO authenticated;
GRANT INSERT ON TABLE public.shop_rc_markups TO authenticated;
GRANT REFERENCES ON TABLE public.shop_rc_markups TO authenticated;
GRANT SELECT ON TABLE public.shop_rc_markups TO authenticated;
GRANT TRIGGER ON TABLE public.shop_rc_markups TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_rc_markups TO authenticated;
GRANT UPDATE ON TABLE public.shop_rc_markups TO authenticated;
GRANT DELETE ON TABLE public.shop_rc_markups TO service_role;
GRANT INSERT ON TABLE public.shop_rc_markups TO service_role;
GRANT REFERENCES ON TABLE public.shop_rc_markups TO service_role;
GRANT SELECT ON TABLE public.shop_rc_markups TO service_role;
GRANT TRIGGER ON TABLE public.shop_rc_markups TO service_role;
GRANT TRUNCATE ON TABLE public.shop_rc_markups TO service_role;
GRANT UPDATE ON TABLE public.shop_rc_markups TO service_role;
GRANT REFERENCES ON TABLE public.shop_sender_ids TO anon;
GRANT SELECT ON TABLE public.shop_sender_ids TO anon;
GRANT TRIGGER ON TABLE public.shop_sender_ids TO anon;
GRANT REFERENCES ON TABLE public.shop_sender_ids TO authenticated;
GRANT SELECT ON TABLE public.shop_sender_ids TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sender_ids TO authenticated;
GRANT DELETE ON TABLE public.shop_sender_ids TO service_role;
GRANT INSERT ON TABLE public.shop_sender_ids TO service_role;
GRANT REFERENCES ON TABLE public.shop_sender_ids TO service_role;
GRANT SELECT ON TABLE public.shop_sender_ids TO service_role;
GRANT TRIGGER ON TABLE public.shop_sender_ids TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sender_ids TO service_role;
GRANT UPDATE ON TABLE public.shop_sender_ids TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_activations TO anon;
GRANT SELECT ON TABLE public.shop_sms_activations TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_activations TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_activations TO anon;
GRANT DELETE ON TABLE public.shop_sms_activations TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_activations TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_activations TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_activations TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_activations TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_activations TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_activations TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_activations TO service_role;
GRANT INSERT ON TABLE public.shop_sms_activations TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_activations TO service_role;
GRANT SELECT ON TABLE public.shop_sms_activations TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_activations TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_activations TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_activations TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_bundles TO anon;
GRANT SELECT ON TABLE public.shop_sms_bundles TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_bundles TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_bundles TO anon;
GRANT DELETE ON TABLE public.shop_sms_bundles TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_bundles TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_bundles TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_bundles TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_bundles TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_bundles TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_bundles TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_bundles TO service_role;
GRANT INSERT ON TABLE public.shop_sms_bundles TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_bundles TO service_role;
GRANT SELECT ON TABLE public.shop_sms_bundles TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_bundles TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_bundles TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_bundles TO service_role;
GRANT DELETE ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT INSERT ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT REFERENCES ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT SELECT ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT UPDATE ON TABLE public.shop_sms_delivery_receipts TO anon;
GRANT DELETE ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_delivery_receipts TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT INSERT ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT SELECT ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_delivery_receipts TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_group_members TO anon;
GRANT SELECT ON TABLE public.shop_sms_group_members TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_group_members TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_group_members TO anon;
GRANT REFERENCES ON TABLE public.shop_sms_group_members TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_group_members TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_group_members TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_group_members TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_group_members TO service_role;
GRANT INSERT ON TABLE public.shop_sms_group_members TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_group_members TO service_role;
GRANT SELECT ON TABLE public.shop_sms_group_members TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_group_members TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_group_members TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_group_members TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_groups TO anon;
GRANT SELECT ON TABLE public.shop_sms_groups TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_groups TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_groups TO anon;
GRANT REFERENCES ON TABLE public.shop_sms_groups TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_groups TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_groups TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_groups TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_groups TO service_role;
GRANT INSERT ON TABLE public.shop_sms_groups TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_groups TO service_role;
GRANT SELECT ON TABLE public.shop_sms_groups TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_groups TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_groups TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_groups TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_logs TO anon;
GRANT SELECT ON TABLE public.shop_sms_logs TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_logs TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_logs TO anon;
GRANT DELETE ON TABLE public.shop_sms_logs TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_logs TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_logs TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_logs TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_logs TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_logs TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_logs TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_logs TO service_role;
GRANT INSERT ON TABLE public.shop_sms_logs TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_logs TO service_role;
GRANT SELECT ON TABLE public.shop_sms_logs TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_logs TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_logs TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_logs TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_purchases TO anon;
GRANT SELECT ON TABLE public.shop_sms_purchases TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_purchases TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_purchases TO anon;
GRANT DELETE ON TABLE public.shop_sms_purchases TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_purchases TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_purchases TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_purchases TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_purchases TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_purchases TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_purchases TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_purchases TO service_role;
GRANT INSERT ON TABLE public.shop_sms_purchases TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_purchases TO service_role;
GRANT SELECT ON TABLE public.shop_sms_purchases TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_purchases TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_purchases TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_purchases TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_refund_failures TO anon;
GRANT SELECT ON TABLE public.shop_sms_refund_failures TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_refund_failures TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_refund_failures TO anon;
GRANT DELETE ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_refund_failures TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT INSERT ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT SELECT ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_refund_failures TO service_role;
GRANT DELETE ON TABLE public.shop_sms_send_claims TO anon;
GRANT INSERT ON TABLE public.shop_sms_send_claims TO anon;
GRANT REFERENCES ON TABLE public.shop_sms_send_claims TO anon;
GRANT SELECT ON TABLE public.shop_sms_send_claims TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_send_claims TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_send_claims TO anon;
GRANT UPDATE ON TABLE public.shop_sms_send_claims TO anon;
GRANT DELETE ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_send_claims TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_send_claims TO service_role;
GRANT INSERT ON TABLE public.shop_sms_send_claims TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_send_claims TO service_role;
GRANT SELECT ON TABLE public.shop_sms_send_claims TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_send_claims TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_send_claims TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_send_claims TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_templates TO anon;
GRANT SELECT ON TABLE public.shop_sms_templates TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_templates TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_templates TO anon;
GRANT DELETE ON TABLE public.shop_sms_templates TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_templates TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_templates TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_templates TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_templates TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_templates TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_templates TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_templates TO service_role;
GRANT INSERT ON TABLE public.shop_sms_templates TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_templates TO service_role;
GRANT SELECT ON TABLE public.shop_sms_templates TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_templates TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_templates TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_templates TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_wallets TO anon;
GRANT SELECT ON TABLE public.shop_sms_wallets TO anon;
GRANT TRIGGER ON TABLE public.shop_sms_wallets TO anon;
GRANT TRUNCATE ON TABLE public.shop_sms_wallets TO anon;
GRANT DELETE ON TABLE public.shop_sms_wallets TO authenticated;
GRANT INSERT ON TABLE public.shop_sms_wallets TO authenticated;
GRANT REFERENCES ON TABLE public.shop_sms_wallets TO authenticated;
GRANT SELECT ON TABLE public.shop_sms_wallets TO authenticated;
GRANT TRIGGER ON TABLE public.shop_sms_wallets TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_sms_wallets TO authenticated;
GRANT UPDATE ON TABLE public.shop_sms_wallets TO authenticated;
GRANT DELETE ON TABLE public.shop_sms_wallets TO service_role;
GRANT INSERT ON TABLE public.shop_sms_wallets TO service_role;
GRANT REFERENCES ON TABLE public.shop_sms_wallets TO service_role;
GRANT SELECT ON TABLE public.shop_sms_wallets TO service_role;
GRANT TRIGGER ON TABLE public.shop_sms_wallets TO service_role;
GRANT TRUNCATE ON TABLE public.shop_sms_wallets TO service_role;
GRANT UPDATE ON TABLE public.shop_sms_wallets TO service_role;
GRANT REFERENCES ON TABLE public.shop_wallet_transactions TO anon;
GRANT SELECT ON TABLE public.shop_wallet_transactions TO anon;
GRANT TRIGGER ON TABLE public.shop_wallet_transactions TO anon;
GRANT TRUNCATE ON TABLE public.shop_wallet_transactions TO anon;
GRANT REFERENCES ON TABLE public.shop_wallet_transactions TO authenticated;
GRANT SELECT ON TABLE public.shop_wallet_transactions TO authenticated;
GRANT TRIGGER ON TABLE public.shop_wallet_transactions TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_wallet_transactions TO authenticated;
GRANT DELETE ON TABLE public.shop_wallet_transactions TO service_role;
GRANT INSERT ON TABLE public.shop_wallet_transactions TO service_role;
GRANT REFERENCES ON TABLE public.shop_wallet_transactions TO service_role;
GRANT SELECT ON TABLE public.shop_wallet_transactions TO service_role;
GRANT TRIGGER ON TABLE public.shop_wallet_transactions TO service_role;
GRANT TRUNCATE ON TABLE public.shop_wallet_transactions TO service_role;
GRANT UPDATE ON TABLE public.shop_wallet_transactions TO service_role;
GRANT REFERENCES ON TABLE public.shop_wallets TO anon;
GRANT SELECT ON TABLE public.shop_wallets TO anon;
GRANT TRIGGER ON TABLE public.shop_wallets TO anon;
GRANT TRUNCATE ON TABLE public.shop_wallets TO anon;
GRANT REFERENCES ON TABLE public.shop_wallets TO authenticated;
GRANT SELECT ON TABLE public.shop_wallets TO authenticated;
GRANT TRIGGER ON TABLE public.shop_wallets TO authenticated;
GRANT TRUNCATE ON TABLE public.shop_wallets TO authenticated;
GRANT DELETE ON TABLE public.shop_wallets TO service_role;
GRANT INSERT ON TABLE public.shop_wallets TO service_role;
GRANT REFERENCES ON TABLE public.shop_wallets TO service_role;
GRANT SELECT ON TABLE public.shop_wallets TO service_role;
GRANT TRIGGER ON TABLE public.shop_wallets TO service_role;
GRANT TRUNCATE ON TABLE public.shop_wallets TO service_role;
GRANT UPDATE ON TABLE public.shop_wallets TO service_role;
GRANT REFERENCES ON TABLE public.sms_accounts TO anon;
GRANT SELECT ON TABLE public.sms_accounts TO anon;
GRANT TRIGGER ON TABLE public.sms_accounts TO anon;
GRANT REFERENCES ON TABLE public.sms_accounts TO authenticated;
GRANT SELECT ON TABLE public.sms_accounts TO authenticated;
GRANT TRIGGER ON TABLE public.sms_accounts TO authenticated;
GRANT DELETE ON TABLE public.sms_accounts TO service_role;
GRANT INSERT ON TABLE public.sms_accounts TO service_role;
GRANT REFERENCES ON TABLE public.sms_accounts TO service_role;
GRANT SELECT ON TABLE public.sms_accounts TO service_role;
GRANT TRIGGER ON TABLE public.sms_accounts TO service_role;
GRANT TRUNCATE ON TABLE public.sms_accounts TO service_role;
GRANT UPDATE ON TABLE public.sms_accounts TO service_role;
GRANT REFERENCES ON TABLE public.sms_bundles TO anon;
GRANT SELECT ON TABLE public.sms_bundles TO anon;
GRANT TRIGGER ON TABLE public.sms_bundles TO anon;
GRANT REFERENCES ON TABLE public.sms_bundles TO authenticated;
GRANT SELECT ON TABLE public.sms_bundles TO authenticated;
GRANT TRIGGER ON TABLE public.sms_bundles TO authenticated;
GRANT DELETE ON TABLE public.sms_bundles TO service_role;
GRANT INSERT ON TABLE public.sms_bundles TO service_role;
GRANT REFERENCES ON TABLE public.sms_bundles TO service_role;
GRANT SELECT ON TABLE public.sms_bundles TO service_role;
GRANT TRIGGER ON TABLE public.sms_bundles TO service_role;
GRANT TRUNCATE ON TABLE public.sms_bundles TO service_role;
GRANT UPDATE ON TABLE public.sms_bundles TO service_role;
GRANT REFERENCES ON TABLE public.sms_business_profiles TO anon;
GRANT SELECT ON TABLE public.sms_business_profiles TO anon;
GRANT TRIGGER ON TABLE public.sms_business_profiles TO anon;
GRANT REFERENCES ON TABLE public.sms_business_profiles TO authenticated;
GRANT SELECT ON TABLE public.sms_business_profiles TO authenticated;
GRANT TRIGGER ON TABLE public.sms_business_profiles TO authenticated;
GRANT DELETE ON TABLE public.sms_business_profiles TO service_role;
GRANT INSERT ON TABLE public.sms_business_profiles TO service_role;
GRANT REFERENCES ON TABLE public.sms_business_profiles TO service_role;
GRANT SELECT ON TABLE public.sms_business_profiles TO service_role;
GRANT TRIGGER ON TABLE public.sms_business_profiles TO service_role;
GRANT TRUNCATE ON TABLE public.sms_business_profiles TO service_role;
GRANT UPDATE ON TABLE public.sms_business_profiles TO service_role;
GRANT REFERENCES ON TABLE public.sms_campaigns TO anon;
GRANT SELECT ON TABLE public.sms_campaigns TO anon;
GRANT TRIGGER ON TABLE public.sms_campaigns TO anon;
GRANT REFERENCES ON TABLE public.sms_campaigns TO authenticated;
GRANT SELECT ON TABLE public.sms_campaigns TO authenticated;
GRANT TRIGGER ON TABLE public.sms_campaigns TO authenticated;
GRANT DELETE ON TABLE public.sms_campaigns TO service_role;
GRANT INSERT ON TABLE public.sms_campaigns TO service_role;
GRANT REFERENCES ON TABLE public.sms_campaigns TO service_role;
GRANT SELECT ON TABLE public.sms_campaigns TO service_role;
GRANT TRIGGER ON TABLE public.sms_campaigns TO service_role;
GRANT TRUNCATE ON TABLE public.sms_campaigns TO service_role;
GRANT UPDATE ON TABLE public.sms_campaigns TO service_role;
GRANT DELETE ON TABLE public.sms_contact_groups TO anon;
GRANT INSERT ON TABLE public.sms_contact_groups TO anon;
GRANT REFERENCES ON TABLE public.sms_contact_groups TO anon;
GRANT SELECT ON TABLE public.sms_contact_groups TO anon;
GRANT TRIGGER ON TABLE public.sms_contact_groups TO anon;
GRANT TRUNCATE ON TABLE public.sms_contact_groups TO anon;
GRANT UPDATE ON TABLE public.sms_contact_groups TO anon;
GRANT DELETE ON TABLE public.sms_contact_groups TO authenticated;
GRANT INSERT ON TABLE public.sms_contact_groups TO authenticated;
GRANT REFERENCES ON TABLE public.sms_contact_groups TO authenticated;
GRANT SELECT ON TABLE public.sms_contact_groups TO authenticated;
GRANT TRIGGER ON TABLE public.sms_contact_groups TO authenticated;
GRANT TRUNCATE ON TABLE public.sms_contact_groups TO authenticated;
GRANT UPDATE ON TABLE public.sms_contact_groups TO authenticated;
GRANT DELETE ON TABLE public.sms_contact_groups TO service_role;
GRANT INSERT ON TABLE public.sms_contact_groups TO service_role;
GRANT REFERENCES ON TABLE public.sms_contact_groups TO service_role;
GRANT SELECT ON TABLE public.sms_contact_groups TO service_role;
GRANT TRIGGER ON TABLE public.sms_contact_groups TO service_role;
GRANT TRUNCATE ON TABLE public.sms_contact_groups TO service_role;
GRANT UPDATE ON TABLE public.sms_contact_groups TO service_role;
GRANT REFERENCES ON TABLE public.sms_contacts TO anon;
GRANT SELECT ON TABLE public.sms_contacts TO anon;
GRANT TRIGGER ON TABLE public.sms_contacts TO anon;
GRANT TRUNCATE ON TABLE public.sms_contacts TO anon;
GRANT DELETE ON TABLE public.sms_contacts TO authenticated;
GRANT INSERT ON TABLE public.sms_contacts TO authenticated;
GRANT REFERENCES ON TABLE public.sms_contacts TO authenticated;
GRANT SELECT ON TABLE public.sms_contacts TO authenticated;
GRANT TRIGGER ON TABLE public.sms_contacts TO authenticated;
GRANT TRUNCATE ON TABLE public.sms_contacts TO authenticated;
GRANT UPDATE ON TABLE public.sms_contacts TO authenticated;
GRANT DELETE ON TABLE public.sms_contacts TO service_role;
GRANT INSERT ON TABLE public.sms_contacts TO service_role;
GRANT REFERENCES ON TABLE public.sms_contacts TO service_role;
GRANT SELECT ON TABLE public.sms_contacts TO service_role;
GRANT TRIGGER ON TABLE public.sms_contacts TO service_role;
GRANT TRUNCATE ON TABLE public.sms_contacts TO service_role;
GRANT UPDATE ON TABLE public.sms_contacts TO service_role;
GRANT REFERENCES ON TABLE public.sms_credit_ledger TO anon;
GRANT SELECT ON TABLE public.sms_credit_ledger TO anon;
GRANT TRIGGER ON TABLE public.sms_credit_ledger TO anon;
GRANT REFERENCES ON TABLE public.sms_credit_ledger TO authenticated;
GRANT SELECT ON TABLE public.sms_credit_ledger TO authenticated;
GRANT TRIGGER ON TABLE public.sms_credit_ledger TO authenticated;
GRANT DELETE ON TABLE public.sms_credit_ledger TO service_role;
GRANT INSERT ON TABLE public.sms_credit_ledger TO service_role;
GRANT REFERENCES ON TABLE public.sms_credit_ledger TO service_role;
GRANT SELECT ON TABLE public.sms_credit_ledger TO service_role;
GRANT TRIGGER ON TABLE public.sms_credit_ledger TO service_role;
GRANT TRUNCATE ON TABLE public.sms_credit_ledger TO service_role;
GRANT UPDATE ON TABLE public.sms_credit_ledger TO service_role;
GRANT DELETE ON TABLE public.sms_group_contacts TO anon;
GRANT INSERT ON TABLE public.sms_group_contacts TO anon;
GRANT REFERENCES ON TABLE public.sms_group_contacts TO anon;
GRANT SELECT ON TABLE public.sms_group_contacts TO anon;
GRANT TRIGGER ON TABLE public.sms_group_contacts TO anon;
GRANT TRUNCATE ON TABLE public.sms_group_contacts TO anon;
GRANT UPDATE ON TABLE public.sms_group_contacts TO anon;
GRANT DELETE ON TABLE public.sms_group_contacts TO authenticated;
GRANT INSERT ON TABLE public.sms_group_contacts TO authenticated;
GRANT REFERENCES ON TABLE public.sms_group_contacts TO authenticated;
GRANT SELECT ON TABLE public.sms_group_contacts TO authenticated;
GRANT TRIGGER ON TABLE public.sms_group_contacts TO authenticated;
GRANT TRUNCATE ON TABLE public.sms_group_contacts TO authenticated;
GRANT UPDATE ON TABLE public.sms_group_contacts TO authenticated;
GRANT DELETE ON TABLE public.sms_group_contacts TO service_role;
GRANT INSERT ON TABLE public.sms_group_contacts TO service_role;
GRANT REFERENCES ON TABLE public.sms_group_contacts TO service_role;
GRANT SELECT ON TABLE public.sms_group_contacts TO service_role;
GRANT TRIGGER ON TABLE public.sms_group_contacts TO service_role;
GRANT TRUNCATE ON TABLE public.sms_group_contacts TO service_role;
GRANT UPDATE ON TABLE public.sms_group_contacts TO service_role;
GRANT REFERENCES ON TABLE public.sms_groups TO anon;
GRANT SELECT ON TABLE public.sms_groups TO anon;
GRANT TRIGGER ON TABLE public.sms_groups TO anon;
GRANT TRUNCATE ON TABLE public.sms_groups TO anon;
GRANT DELETE ON TABLE public.sms_groups TO authenticated;
GRANT INSERT ON TABLE public.sms_groups TO authenticated;
GRANT REFERENCES ON TABLE public.sms_groups TO authenticated;
GRANT SELECT ON TABLE public.sms_groups TO authenticated;
GRANT TRIGGER ON TABLE public.sms_groups TO authenticated;
GRANT TRUNCATE ON TABLE public.sms_groups TO authenticated;
GRANT UPDATE ON TABLE public.sms_groups TO authenticated;
GRANT DELETE ON TABLE public.sms_groups TO service_role;
GRANT INSERT ON TABLE public.sms_groups TO service_role;
GRANT REFERENCES ON TABLE public.sms_groups TO service_role;
GRANT SELECT ON TABLE public.sms_groups TO service_role;
GRANT TRIGGER ON TABLE public.sms_groups TO service_role;
GRANT TRUNCATE ON TABLE public.sms_groups TO service_role;
GRANT UPDATE ON TABLE public.sms_groups TO service_role;
GRANT REFERENCES ON TABLE public.sms_messages TO anon;
GRANT SELECT ON TABLE public.sms_messages TO anon;
GRANT TRIGGER ON TABLE public.sms_messages TO anon;
GRANT REFERENCES ON TABLE public.sms_messages TO authenticated;
GRANT SELECT ON TABLE public.sms_messages TO authenticated;
GRANT TRIGGER ON TABLE public.sms_messages TO authenticated;
GRANT DELETE ON TABLE public.sms_messages TO service_role;
GRANT INSERT ON TABLE public.sms_messages TO service_role;
GRANT REFERENCES ON TABLE public.sms_messages TO service_role;
GRANT SELECT ON TABLE public.sms_messages TO service_role;
GRANT TRIGGER ON TABLE public.sms_messages TO service_role;
GRANT TRUNCATE ON TABLE public.sms_messages TO service_role;
GRANT UPDATE ON TABLE public.sms_messages TO service_role;
GRANT REFERENCES ON TABLE public.sms_purchases TO anon;
GRANT SELECT ON TABLE public.sms_purchases TO anon;
GRANT TRIGGER ON TABLE public.sms_purchases TO anon;
GRANT REFERENCES ON TABLE public.sms_purchases TO authenticated;
GRANT SELECT ON TABLE public.sms_purchases TO authenticated;
GRANT TRIGGER ON TABLE public.sms_purchases TO authenticated;
GRANT DELETE ON TABLE public.sms_purchases TO service_role;
GRANT INSERT ON TABLE public.sms_purchases TO service_role;
GRANT REFERENCES ON TABLE public.sms_purchases TO service_role;
GRANT SELECT ON TABLE public.sms_purchases TO service_role;
GRANT TRIGGER ON TABLE public.sms_purchases TO service_role;
GRANT TRUNCATE ON TABLE public.sms_purchases TO service_role;
GRANT UPDATE ON TABLE public.sms_purchases TO service_role;
GRANT REFERENCES ON TABLE public.sms_sender_ids TO anon;
GRANT SELECT ON TABLE public.sms_sender_ids TO anon;
GRANT TRIGGER ON TABLE public.sms_sender_ids TO anon;
GRANT REFERENCES ON TABLE public.sms_sender_ids TO authenticated;
GRANT SELECT ON TABLE public.sms_sender_ids TO authenticated;
GRANT TRIGGER ON TABLE public.sms_sender_ids TO authenticated;
GRANT DELETE ON TABLE public.sms_sender_ids TO service_role;
GRANT INSERT ON TABLE public.sms_sender_ids TO service_role;
GRANT REFERENCES ON TABLE public.sms_sender_ids TO service_role;
GRANT SELECT ON TABLE public.sms_sender_ids TO service_role;
GRANT TRIGGER ON TABLE public.sms_sender_ids TO service_role;
GRANT TRUNCATE ON TABLE public.sms_sender_ids TO service_role;
GRANT UPDATE ON TABLE public.sms_sender_ids TO service_role;
GRANT REFERENCES ON TABLE public.sms_templates TO anon;
GRANT SELECT ON TABLE public.sms_templates TO anon;
GRANT TRIGGER ON TABLE public.sms_templates TO anon;
GRANT TRUNCATE ON TABLE public.sms_templates TO anon;
GRANT DELETE ON TABLE public.sms_templates TO authenticated;
GRANT INSERT ON TABLE public.sms_templates TO authenticated;
GRANT REFERENCES ON TABLE public.sms_templates TO authenticated;
GRANT SELECT ON TABLE public.sms_templates TO authenticated;
GRANT TRIGGER ON TABLE public.sms_templates TO authenticated;
GRANT TRUNCATE ON TABLE public.sms_templates TO authenticated;
GRANT UPDATE ON TABLE public.sms_templates TO authenticated;
GRANT DELETE ON TABLE public.sms_templates TO service_role;
GRANT INSERT ON TABLE public.sms_templates TO service_role;
GRANT REFERENCES ON TABLE public.sms_templates TO service_role;
GRANT SELECT ON TABLE public.sms_templates TO service_role;
GRANT TRIGGER ON TABLE public.sms_templates TO service_role;
GRANT TRUNCATE ON TABLE public.sms_templates TO service_role;
GRANT UPDATE ON TABLE public.sms_templates TO service_role;
GRANT DELETE ON TABLE public.sms_user_templates TO anon;
GRANT INSERT ON TABLE public.sms_user_templates TO anon;
GRANT REFERENCES ON TABLE public.sms_user_templates TO anon;
GRANT SELECT ON TABLE public.sms_user_templates TO anon;
GRANT TRIGGER ON TABLE public.sms_user_templates TO anon;
GRANT TRUNCATE ON TABLE public.sms_user_templates TO anon;
GRANT UPDATE ON TABLE public.sms_user_templates TO anon;
GRANT DELETE ON TABLE public.sms_user_templates TO authenticated;
GRANT INSERT ON TABLE public.sms_user_templates TO authenticated;
GRANT REFERENCES ON TABLE public.sms_user_templates TO authenticated;
GRANT SELECT ON TABLE public.sms_user_templates TO authenticated;
GRANT TRIGGER ON TABLE public.sms_user_templates TO authenticated;
GRANT TRUNCATE ON TABLE public.sms_user_templates TO authenticated;
GRANT UPDATE ON TABLE public.sms_user_templates TO authenticated;
GRANT DELETE ON TABLE public.sms_user_templates TO service_role;
GRANT INSERT ON TABLE public.sms_user_templates TO service_role;
GRANT REFERENCES ON TABLE public.sms_user_templates TO service_role;
GRANT SELECT ON TABLE public.sms_user_templates TO service_role;
GRANT TRIGGER ON TABLE public.sms_user_templates TO service_role;
GRANT TRUNCATE ON TABLE public.sms_user_templates TO service_role;
GRANT UPDATE ON TABLE public.sms_user_templates TO service_role;
GRANT REFERENCES ON TABLE public.sms_wallets TO anon;
GRANT SELECT ON TABLE public.sms_wallets TO anon;
GRANT TRIGGER ON TABLE public.sms_wallets TO anon;
GRANT REFERENCES ON TABLE public.sms_wallets TO authenticated;
GRANT SELECT ON TABLE public.sms_wallets TO authenticated;
GRANT TRIGGER ON TABLE public.sms_wallets TO authenticated;
GRANT DELETE ON TABLE public.sms_wallets TO service_role;
GRANT INSERT ON TABLE public.sms_wallets TO service_role;
GRANT REFERENCES ON TABLE public.sms_wallets TO service_role;
GRANT SELECT ON TABLE public.sms_wallets TO service_role;
GRANT TRIGGER ON TABLE public.sms_wallets TO service_role;
GRANT TRUNCATE ON TABLE public.sms_wallets TO service_role;
GRANT UPDATE ON TABLE public.sms_wallets TO service_role;
GRANT DELETE ON TABLE public.sub_agent_default_pricing TO anon;
GRANT INSERT ON TABLE public.sub_agent_default_pricing TO anon;
GRANT REFERENCES ON TABLE public.sub_agent_default_pricing TO anon;
GRANT SELECT ON TABLE public.sub_agent_default_pricing TO anon;
GRANT TRIGGER ON TABLE public.sub_agent_default_pricing TO anon;
GRANT TRUNCATE ON TABLE public.sub_agent_default_pricing TO anon;
GRANT UPDATE ON TABLE public.sub_agent_default_pricing TO anon;
GRANT DELETE ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT INSERT ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT REFERENCES ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT SELECT ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT TRIGGER ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT TRUNCATE ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT UPDATE ON TABLE public.sub_agent_default_pricing TO authenticated;
GRANT DELETE ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT INSERT ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT REFERENCES ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT SELECT ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT TRIGGER ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT TRUNCATE ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT UPDATE ON TABLE public.sub_agent_default_pricing TO service_role;
GRANT DELETE ON TABLE public.sub_agent_order_earnings TO anon;
GRANT INSERT ON TABLE public.sub_agent_order_earnings TO anon;
GRANT REFERENCES ON TABLE public.sub_agent_order_earnings TO anon;
GRANT SELECT ON TABLE public.sub_agent_order_earnings TO anon;
GRANT TRIGGER ON TABLE public.sub_agent_order_earnings TO anon;
GRANT TRUNCATE ON TABLE public.sub_agent_order_earnings TO anon;
GRANT UPDATE ON TABLE public.sub_agent_order_earnings TO anon;
GRANT DELETE ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT INSERT ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT REFERENCES ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT SELECT ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT TRIGGER ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT TRUNCATE ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT UPDATE ON TABLE public.sub_agent_order_earnings TO authenticated;
GRANT DELETE ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT INSERT ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT REFERENCES ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT SELECT ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT TRIGGER ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT TRUNCATE ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT UPDATE ON TABLE public.sub_agent_order_earnings TO service_role;
GRANT DELETE ON TABLE public.sub_agent_pricing TO anon;
GRANT INSERT ON TABLE public.sub_agent_pricing TO anon;
GRANT REFERENCES ON TABLE public.sub_agent_pricing TO anon;
GRANT SELECT ON TABLE public.sub_agent_pricing TO anon;
GRANT TRIGGER ON TABLE public.sub_agent_pricing TO anon;
GRANT TRUNCATE ON TABLE public.sub_agent_pricing TO anon;
GRANT UPDATE ON TABLE public.sub_agent_pricing TO anon;
GRANT DELETE ON TABLE public.sub_agent_pricing TO authenticated;
GRANT INSERT ON TABLE public.sub_agent_pricing TO authenticated;
GRANT REFERENCES ON TABLE public.sub_agent_pricing TO authenticated;
GRANT SELECT ON TABLE public.sub_agent_pricing TO authenticated;
GRANT TRIGGER ON TABLE public.sub_agent_pricing TO authenticated;
GRANT TRUNCATE ON TABLE public.sub_agent_pricing TO authenticated;
GRANT UPDATE ON TABLE public.sub_agent_pricing TO authenticated;
GRANT DELETE ON TABLE public.sub_agent_pricing TO service_role;
GRANT INSERT ON TABLE public.sub_agent_pricing TO service_role;
GRANT REFERENCES ON TABLE public.sub_agent_pricing TO service_role;
GRANT SELECT ON TABLE public.sub_agent_pricing TO service_role;
GRANT TRIGGER ON TABLE public.sub_agent_pricing TO service_role;
GRANT TRUNCATE ON TABLE public.sub_agent_pricing TO service_role;
GRANT UPDATE ON TABLE public.sub_agent_pricing TO service_role;
GRANT DELETE ON TABLE public.sub_agents TO anon;
GRANT INSERT ON TABLE public.sub_agents TO anon;
GRANT REFERENCES ON TABLE public.sub_agents TO anon;
GRANT SELECT ON TABLE public.sub_agents TO anon;
GRANT TRIGGER ON TABLE public.sub_agents TO anon;
GRANT TRUNCATE ON TABLE public.sub_agents TO anon;
GRANT UPDATE ON TABLE public.sub_agents TO anon;
GRANT DELETE ON TABLE public.sub_agents TO authenticated;
GRANT INSERT ON TABLE public.sub_agents TO authenticated;
GRANT REFERENCES ON TABLE public.sub_agents TO authenticated;
GRANT SELECT ON TABLE public.sub_agents TO authenticated;
GRANT TRIGGER ON TABLE public.sub_agents TO authenticated;
GRANT TRUNCATE ON TABLE public.sub_agents TO authenticated;
GRANT UPDATE ON TABLE public.sub_agents TO authenticated;
GRANT DELETE ON TABLE public.sub_agents TO service_role;
GRANT INSERT ON TABLE public.sub_agents TO service_role;
GRANT REFERENCES ON TABLE public.sub_agents TO service_role;
GRANT SELECT ON TABLE public.sub_agents TO service_role;
GRANT TRIGGER ON TABLE public.sub_agents TO service_role;
GRANT TRUNCATE ON TABLE public.sub_agents TO service_role;
GRANT UPDATE ON TABLE public.sub_agents TO service_role;
GRANT SELECT ON TABLE public.support_messages TO authenticated;
GRANT DELETE ON TABLE public.support_messages TO service_role;
GRANT INSERT ON TABLE public.support_messages TO service_role;
GRANT REFERENCES ON TABLE public.support_messages TO service_role;
GRANT SELECT ON TABLE public.support_messages TO service_role;
GRANT TRIGGER ON TABLE public.support_messages TO service_role;
GRANT TRUNCATE ON TABLE public.support_messages TO service_role;
GRANT UPDATE ON TABLE public.support_messages TO service_role;
GRANT SELECT ON TABLE public.support_threads TO authenticated;
GRANT DELETE ON TABLE public.support_threads TO service_role;
GRANT INSERT ON TABLE public.support_threads TO service_role;
GRANT REFERENCES ON TABLE public.support_threads TO service_role;
GRANT SELECT ON TABLE public.support_threads TO service_role;
GRANT TRIGGER ON TABLE public.support_threads TO service_role;
GRANT TRUNCATE ON TABLE public.support_threads TO service_role;
GRANT UPDATE ON TABLE public.support_threads TO service_role;
GRANT REFERENCES ON TABLE public.system_announcements TO anon;
GRANT SELECT ON TABLE public.system_announcements TO anon;
GRANT TRIGGER ON TABLE public.system_announcements TO anon;
GRANT TRUNCATE ON TABLE public.system_announcements TO anon;
GRANT DELETE ON TABLE public.system_announcements TO authenticated;
GRANT INSERT ON TABLE public.system_announcements TO authenticated;
GRANT REFERENCES ON TABLE public.system_announcements TO authenticated;
GRANT SELECT ON TABLE public.system_announcements TO authenticated;
GRANT TRIGGER ON TABLE public.system_announcements TO authenticated;
GRANT TRUNCATE ON TABLE public.system_announcements TO authenticated;
GRANT UPDATE ON TABLE public.system_announcements TO authenticated;
GRANT DELETE ON TABLE public.system_announcements TO service_role;
GRANT INSERT ON TABLE public.system_announcements TO service_role;
GRANT REFERENCES ON TABLE public.system_announcements TO service_role;
GRANT SELECT ON TABLE public.system_announcements TO service_role;
GRANT TRIGGER ON TABLE public.system_announcements TO service_role;
GRANT TRUNCATE ON TABLE public.system_announcements TO service_role;
GRANT UPDATE ON TABLE public.system_announcements TO service_role;
GRANT INSERT ON TABLE public.terms_acceptances TO authenticated;
GRANT SELECT ON TABLE public.terms_acceptances TO authenticated;
GRANT DELETE ON TABLE public.terms_acceptances TO service_role;
GRANT INSERT ON TABLE public.terms_acceptances TO service_role;
GRANT REFERENCES ON TABLE public.terms_acceptances TO service_role;
GRANT SELECT ON TABLE public.terms_acceptances TO service_role;
GRANT TRIGGER ON TABLE public.terms_acceptances TO service_role;
GRANT TRUNCATE ON TABLE public.terms_acceptances TO service_role;
GRANT UPDATE ON TABLE public.terms_acceptances TO service_role;
GRANT SELECT ON TABLE public.terms_versions TO anon;
GRANT SELECT ON TABLE public.terms_versions TO authenticated;
GRANT DELETE ON TABLE public.terms_versions TO service_role;
GRANT INSERT ON TABLE public.terms_versions TO service_role;
GRANT REFERENCES ON TABLE public.terms_versions TO service_role;
GRANT SELECT ON TABLE public.terms_versions TO service_role;
GRANT TRIGGER ON TABLE public.terms_versions TO service_role;
GRANT TRUNCATE ON TABLE public.terms_versions TO service_role;
GRANT UPDATE ON TABLE public.terms_versions TO service_role;
GRANT REFERENCES ON TABLE public.user_payment_references TO anon;
GRANT SELECT ON TABLE public.user_payment_references TO anon;
GRANT TRIGGER ON TABLE public.user_payment_references TO anon;
GRANT TRUNCATE ON TABLE public.user_payment_references TO anon;
GRANT REFERENCES ON TABLE public.user_payment_references TO authenticated;
GRANT SELECT ON TABLE public.user_payment_references TO authenticated;
GRANT TRIGGER ON TABLE public.user_payment_references TO authenticated;
GRANT TRUNCATE ON TABLE public.user_payment_references TO authenticated;
GRANT DELETE ON TABLE public.user_payment_references TO service_role;
GRANT INSERT ON TABLE public.user_payment_references TO service_role;
GRANT REFERENCES ON TABLE public.user_payment_references TO service_role;
GRANT SELECT ON TABLE public.user_payment_references TO service_role;
GRANT TRIGGER ON TABLE public.user_payment_references TO service_role;
GRANT TRUNCATE ON TABLE public.user_payment_references TO service_role;
GRANT UPDATE ON TABLE public.user_payment_references TO service_role;
GRANT REFERENCES ON TABLE public.users TO anon;
GRANT SELECT ON TABLE public.users TO anon;
GRANT TRIGGER ON TABLE public.users TO anon;
GRANT TRUNCATE ON TABLE public.users TO anon;
GRANT DELETE ON TABLE public.users TO authenticated;
GRANT INSERT ON TABLE public.users TO authenticated;
GRANT REFERENCES ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT TRIGGER ON TABLE public.users TO authenticated;
GRANT TRUNCATE ON TABLE public.users TO authenticated;
GRANT UPDATE ON TABLE public.users TO authenticated;
GRANT DELETE ON TABLE public.users TO service_role;
GRANT INSERT ON TABLE public.users TO service_role;
GRANT REFERENCES ON TABLE public.users TO service_role;
GRANT SELECT ON TABLE public.users TO service_role;
GRANT TRIGGER ON TABLE public.users TO service_role;
GRANT TRUNCATE ON TABLE public.users TO service_role;
GRANT UPDATE ON TABLE public.users TO service_role;
GRANT DELETE ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT INSERT ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT REFERENCES ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT SELECT ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT TRIGGER ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT TRUNCATE ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT UPDATE ON TABLE public.ussd_callback_retry_queue TO anon;
GRANT DELETE ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT INSERT ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT REFERENCES ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT SELECT ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT TRIGGER ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT TRUNCATE ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT UPDATE ON TABLE public.ussd_callback_retry_queue TO authenticated;
GRANT DELETE ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT INSERT ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT REFERENCES ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT SELECT ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT TRIGGER ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT TRUNCATE ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT UPDATE ON TABLE public.ussd_callback_retry_queue TO service_role;
GRANT REFERENCES ON TABLE public.ussd_customers TO anon;
GRANT SELECT ON TABLE public.ussd_customers TO anon;
GRANT TRIGGER ON TABLE public.ussd_customers TO anon;
GRANT TRUNCATE ON TABLE public.ussd_customers TO anon;
GRANT DELETE ON TABLE public.ussd_customers TO authenticated;
GRANT INSERT ON TABLE public.ussd_customers TO authenticated;
GRANT REFERENCES ON TABLE public.ussd_customers TO authenticated;
GRANT SELECT ON TABLE public.ussd_customers TO authenticated;
GRANT TRIGGER ON TABLE public.ussd_customers TO authenticated;
GRANT TRUNCATE ON TABLE public.ussd_customers TO authenticated;
GRANT UPDATE ON TABLE public.ussd_customers TO authenticated;
GRANT DELETE ON TABLE public.ussd_customers TO service_role;
GRANT INSERT ON TABLE public.ussd_customers TO service_role;
GRANT REFERENCES ON TABLE public.ussd_customers TO service_role;
GRANT SELECT ON TABLE public.ussd_customers TO service_role;
GRANT TRIGGER ON TABLE public.ussd_customers TO service_role;
GRANT TRUNCATE ON TABLE public.ussd_customers TO service_role;
GRANT UPDATE ON TABLE public.ussd_customers TO service_role;
GRANT REFERENCES ON TABLE public.ussd_pending_orders TO anon;
GRANT SELECT ON TABLE public.ussd_pending_orders TO anon;
GRANT TRIGGER ON TABLE public.ussd_pending_orders TO anon;
GRANT TRUNCATE ON TABLE public.ussd_pending_orders TO anon;
GRANT REFERENCES ON TABLE public.ussd_pending_orders TO authenticated;
GRANT SELECT ON TABLE public.ussd_pending_orders TO authenticated;
GRANT TRIGGER ON TABLE public.ussd_pending_orders TO authenticated;
GRANT TRUNCATE ON TABLE public.ussd_pending_orders TO authenticated;
GRANT DELETE ON TABLE public.ussd_pending_orders TO service_role;
GRANT INSERT ON TABLE public.ussd_pending_orders TO service_role;
GRANT REFERENCES ON TABLE public.ussd_pending_orders TO service_role;
GRANT SELECT ON TABLE public.ussd_pending_orders TO service_role;
GRANT TRIGGER ON TABLE public.ussd_pending_orders TO service_role;
GRANT TRUNCATE ON TABLE public.ussd_pending_orders TO service_role;
GRANT UPDATE ON TABLE public.ussd_pending_orders TO service_role;
GRANT REFERENCES ON TABLE public.ussd_refund_queue TO anon;
GRANT SELECT ON TABLE public.ussd_refund_queue TO anon;
GRANT TRIGGER ON TABLE public.ussd_refund_queue TO anon;
GRANT TRUNCATE ON TABLE public.ussd_refund_queue TO anon;
GRANT DELETE ON TABLE public.ussd_refund_queue TO authenticated;
GRANT INSERT ON TABLE public.ussd_refund_queue TO authenticated;
GRANT REFERENCES ON TABLE public.ussd_refund_queue TO authenticated;
GRANT SELECT ON TABLE public.ussd_refund_queue TO authenticated;
GRANT TRIGGER ON TABLE public.ussd_refund_queue TO authenticated;
GRANT TRUNCATE ON TABLE public.ussd_refund_queue TO authenticated;
GRANT UPDATE ON TABLE public.ussd_refund_queue TO authenticated;
GRANT DELETE ON TABLE public.ussd_refund_queue TO service_role;
GRANT INSERT ON TABLE public.ussd_refund_queue TO service_role;
GRANT REFERENCES ON TABLE public.ussd_refund_queue TO service_role;
GRANT SELECT ON TABLE public.ussd_refund_queue TO service_role;
GRANT TRIGGER ON TABLE public.ussd_refund_queue TO service_role;
GRANT TRUNCATE ON TABLE public.ussd_refund_queue TO service_role;
GRANT UPDATE ON TABLE public.ussd_refund_queue TO service_role;
GRANT REFERENCES ON TABLE public.ussd_sessions TO anon;
GRANT SELECT ON TABLE public.ussd_sessions TO anon;
GRANT TRIGGER ON TABLE public.ussd_sessions TO anon;
GRANT TRUNCATE ON TABLE public.ussd_sessions TO anon;
GRANT DELETE ON TABLE public.ussd_sessions TO authenticated;
GRANT INSERT ON TABLE public.ussd_sessions TO authenticated;
GRANT REFERENCES ON TABLE public.ussd_sessions TO authenticated;
GRANT SELECT ON TABLE public.ussd_sessions TO authenticated;
GRANT TRIGGER ON TABLE public.ussd_sessions TO authenticated;
GRANT TRUNCATE ON TABLE public.ussd_sessions TO authenticated;
GRANT UPDATE ON TABLE public.ussd_sessions TO authenticated;
GRANT DELETE ON TABLE public.ussd_sessions TO service_role;
GRANT INSERT ON TABLE public.ussd_sessions TO service_role;
GRANT REFERENCES ON TABLE public.ussd_sessions TO service_role;
GRANT SELECT ON TABLE public.ussd_sessions TO service_role;
GRANT TRIGGER ON TABLE public.ussd_sessions TO service_role;
GRANT TRUNCATE ON TABLE public.ussd_sessions TO service_role;
GRANT UPDATE ON TABLE public.ussd_sessions TO service_role;
GRANT SELECT ON TABLE public.utility_orders TO authenticated;
GRANT DELETE ON TABLE public.utility_orders TO service_role;
GRANT INSERT ON TABLE public.utility_orders TO service_role;
GRANT REFERENCES ON TABLE public.utility_orders TO service_role;
GRANT SELECT ON TABLE public.utility_orders TO service_role;
GRANT TRIGGER ON TABLE public.utility_orders TO service_role;
GRANT TRUNCATE ON TABLE public.utility_orders TO service_role;
GRANT UPDATE ON TABLE public.utility_orders TO service_role;
GRANT DELETE ON TABLE public.utility_refund_queue TO service_role;
GRANT INSERT ON TABLE public.utility_refund_queue TO service_role;
GRANT REFERENCES ON TABLE public.utility_refund_queue TO service_role;
GRANT SELECT ON TABLE public.utility_refund_queue TO service_role;
GRANT TRIGGER ON TABLE public.utility_refund_queue TO service_role;
GRANT TRUNCATE ON TABLE public.utility_refund_queue TO service_role;
GRANT UPDATE ON TABLE public.utility_refund_queue TO service_role;
GRANT DELETE ON TABLE public.utility_saved_accounts TO authenticated;
GRANT INSERT ON TABLE public.utility_saved_accounts TO authenticated;
GRANT SELECT ON TABLE public.utility_saved_accounts TO authenticated;
GRANT UPDATE ON TABLE public.utility_saved_accounts TO authenticated;
GRANT DELETE ON TABLE public.utility_saved_accounts TO service_role;
GRANT INSERT ON TABLE public.utility_saved_accounts TO service_role;
GRANT REFERENCES ON TABLE public.utility_saved_accounts TO service_role;
GRANT SELECT ON TABLE public.utility_saved_accounts TO service_role;
GRANT TRIGGER ON TABLE public.utility_saved_accounts TO service_role;
GRANT TRUNCATE ON TABLE public.utility_saved_accounts TO service_role;
GRANT UPDATE ON TABLE public.utility_saved_accounts TO service_role;
GRANT DELETE ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT INSERT ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT REFERENCES ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT SELECT ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT TRIGGER ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT TRUNCATE ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT UPDATE ON TABLE public.v_shop_profit_credit_reconciliation TO service_role;
GRANT DELETE ON TABLE public.verified_phone_numbers TO anon;
GRANT INSERT ON TABLE public.verified_phone_numbers TO anon;
GRANT REFERENCES ON TABLE public.verified_phone_numbers TO anon;
GRANT SELECT ON TABLE public.verified_phone_numbers TO anon;
GRANT TRIGGER ON TABLE public.verified_phone_numbers TO anon;
GRANT TRUNCATE ON TABLE public.verified_phone_numbers TO anon;
GRANT UPDATE ON TABLE public.verified_phone_numbers TO anon;
GRANT DELETE ON TABLE public.verified_phone_numbers TO authenticated;
GRANT INSERT ON TABLE public.verified_phone_numbers TO authenticated;
GRANT REFERENCES ON TABLE public.verified_phone_numbers TO authenticated;
GRANT SELECT ON TABLE public.verified_phone_numbers TO authenticated;
GRANT TRIGGER ON TABLE public.verified_phone_numbers TO authenticated;
GRANT TRUNCATE ON TABLE public.verified_phone_numbers TO authenticated;
GRANT UPDATE ON TABLE public.verified_phone_numbers TO authenticated;
GRANT DELETE ON TABLE public.verified_phone_numbers TO service_role;
GRANT INSERT ON TABLE public.verified_phone_numbers TO service_role;
GRANT REFERENCES ON TABLE public.verified_phone_numbers TO service_role;
GRANT SELECT ON TABLE public.verified_phone_numbers TO service_role;
GRANT TRIGGER ON TABLE public.verified_phone_numbers TO service_role;
GRANT TRUNCATE ON TABLE public.verified_phone_numbers TO service_role;
GRANT UPDATE ON TABLE public.verified_phone_numbers TO service_role;
GRANT REFERENCES ON TABLE public.wallet_payments TO anon;
GRANT SELECT ON TABLE public.wallet_payments TO anon;
GRANT TRIGGER ON TABLE public.wallet_payments TO anon;
GRANT TRUNCATE ON TABLE public.wallet_payments TO anon;
GRANT DELETE ON TABLE public.wallet_payments TO authenticated;
GRANT INSERT ON TABLE public.wallet_payments TO authenticated;
GRANT REFERENCES ON TABLE public.wallet_payments TO authenticated;
GRANT SELECT ON TABLE public.wallet_payments TO authenticated;
GRANT TRIGGER ON TABLE public.wallet_payments TO authenticated;
GRANT TRUNCATE ON TABLE public.wallet_payments TO authenticated;
GRANT UPDATE ON TABLE public.wallet_payments TO authenticated;
GRANT DELETE ON TABLE public.wallet_payments TO service_role;
GRANT INSERT ON TABLE public.wallet_payments TO service_role;
GRANT REFERENCES ON TABLE public.wallet_payments TO service_role;
GRANT SELECT ON TABLE public.wallet_payments TO service_role;
GRANT TRIGGER ON TABLE public.wallet_payments TO service_role;
GRANT TRUNCATE ON TABLE public.wallet_payments TO service_role;
GRANT UPDATE ON TABLE public.wallet_payments TO service_role;
GRANT REFERENCES ON TABLE public.wallet_transactions TO anon;
GRANT SELECT ON TABLE public.wallet_transactions TO anon;
GRANT TRIGGER ON TABLE public.wallet_transactions TO anon;
GRANT TRUNCATE ON TABLE public.wallet_transactions TO anon;
GRANT REFERENCES ON TABLE public.wallet_transactions TO authenticated;
GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;
GRANT TRIGGER ON TABLE public.wallet_transactions TO authenticated;
GRANT TRUNCATE ON TABLE public.wallet_transactions TO authenticated;
GRANT DELETE ON TABLE public.wallet_transactions TO service_role;
GRANT INSERT ON TABLE public.wallet_transactions TO service_role;
GRANT REFERENCES ON TABLE public.wallet_transactions TO service_role;
GRANT SELECT ON TABLE public.wallet_transactions TO service_role;
GRANT TRIGGER ON TABLE public.wallet_transactions TO service_role;
GRANT TRUNCATE ON TABLE public.wallet_transactions TO service_role;
GRANT UPDATE ON TABLE public.wallet_transactions TO service_role;
GRANT REFERENCES ON TABLE public.wallets TO anon;
GRANT SELECT ON TABLE public.wallets TO anon;
GRANT TRIGGER ON TABLE public.wallets TO anon;
GRANT TRUNCATE ON TABLE public.wallets TO anon;
GRANT REFERENCES ON TABLE public.wallets TO authenticated;
GRANT SELECT ON TABLE public.wallets TO authenticated;
GRANT TRIGGER ON TABLE public.wallets TO authenticated;
GRANT TRUNCATE ON TABLE public.wallets TO authenticated;
GRANT DELETE ON TABLE public.wallets TO service_role;
GRANT INSERT ON TABLE public.wallets TO service_role;
GRANT REFERENCES ON TABLE public.wallets TO service_role;
GRANT SELECT ON TABLE public.wallets TO service_role;
GRANT TRIGGER ON TABLE public.wallets TO service_role;
GRANT TRUNCATE ON TABLE public.wallets TO service_role;
GRANT UPDATE ON TABLE public.wallets TO service_role;
GRANT DELETE ON TABLE public.website_requests TO service_role;
GRANT INSERT ON TABLE public.website_requests TO service_role;
GRANT REFERENCES ON TABLE public.website_requests TO service_role;
GRANT SELECT ON TABLE public.website_requests TO service_role;
GRANT TRIGGER ON TABLE public.website_requests TO service_role;
GRANT TRUNCATE ON TABLE public.website_requests TO service_role;
GRANT UPDATE ON TABLE public.website_requests TO service_role;


-- ============================================================
-- 09 STORAGE
-- ============================================================
-- ===== storage buckets =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-logos', 'shop-logos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- NOTE: a leftover policy references a 'shop-banners' bucket that does NOT currently
-- exist in storage.buckets on the source project (migration 20260328_create_shop_banners_bucket.sql
-- was applied then the bucket was apparently removed/renamed). Confirm with the user whether
-- Capozy needs a shop-banners bucket before recreating this policy.

-- ===== storage.objects policies =====
CREATE POLICY "Shop Banners Auth Delete" ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'shop-banners'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));

CREATE POLICY shop_logos_delete_user_folder ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'shop-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY shop_logos_insert_user_folder ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'shop-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY shop_logos_update_user_folder ON storage.objects FOR UPDATE TO authenticated
  USING ((bucket_id = 'shop-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));



