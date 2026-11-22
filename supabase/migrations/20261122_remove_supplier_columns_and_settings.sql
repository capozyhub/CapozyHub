-- Removes every data-bundle supplier's DB footprint. Capozy runs with no supplier
-- wired up (see docs/stage-1-5-scope-down.md, "Suppliers") -- all the app code that
-- wrote these columns/rows/functions was removed in the same pass as this migration.
-- Not yet applied to the live Capozy Supabase project (per project convention, DB
-- work here is code + migration files only until Stage 4) -- this just keeps a
-- fresh apply of the full migration chain from ever creating this footprint.
--
-- Deliberately NOT touched:
--   - orders.fulfillment_method, orders.dispatch_claimed_at, orders.fulfillment_note,
--     orders.error_message, shop_orders.fulfillment_reference -- generic dispatch
--     plumbing (lib/dispatch-claim.ts), not named after any one supplier.
--   - airtime_orders.fulfilled_by (uuid, FK to users) -- records which admin/agent
--     fulfilled an airtime order by hand; unrelated to the data-bundle suppliers
--     below despite the similar name.

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

-- ---- AT-iShare Console manual-send ledger (supplier-specific table) ----
DROP TABLE IF EXISTS public.atishare_console_manual_sends;

-- ---- Supplier connect/disconnect RPC -- no suppliers left to toggle ----
DROP FUNCTION IF EXISTS public.toggle_fulfillment_supplier_network(text, text, boolean);

-- ---- admin_settings rows a fresh apply would otherwise seed/accumulate ----
DELETE FROM public.admin_settings WHERE key IN (
    'fulfillment_settings',
    'mtn_codecraft_fallback',
    'mtn_agentportal_fallback',
    'mtn_bundleportal_fallback',
    'mtn_hendylinks_fallback',
    'mtn_express_delivery_enabled'
);
