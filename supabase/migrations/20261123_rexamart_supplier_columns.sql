-- Adds Rexamart as a data-bundle + AFA supplier. Generic column names this time
-- (per the stage-1-5 plan's original intent) rather than one differently-named
-- column per supplier: `supplier_reference` holds whichever supplier's own
-- order/transaction identifier, keyed off orders.fulfillment_method /
-- afa_orders.fulfillment_method to say which supplier it belongs to. A future
-- second supplier reuses this same column, no new migration needed for that part.
--
-- Not yet applied to the live Capozy Supabase project (per project convention,
-- DB work here is code + migration files only until Stage 4).

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS supplier_reference text;

-- afa_orders never had a supplier-dispatch path before (AFA registrations were
-- always completed manually) — these three are new, not a rename of anything
-- removed in the supplier wipe.
ALTER TABLE public.afa_orders
    ADD COLUMN IF NOT EXISTS fulfillment_method text DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS dispatch_claimed_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS supplier_reference text;

CREATE INDEX IF NOT EXISTS idx_orders_supplier_reference ON public.orders (supplier_reference) WHERE (supplier_reference IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_afa_orders_supplier_reference ON public.afa_orders (supplier_reference) WHERE (supplier_reference IS NOT NULL);
