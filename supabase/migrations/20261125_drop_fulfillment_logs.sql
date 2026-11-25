-- Drops public.fulfillment_logs: an empty pre-Capozy relic (0 rows) whose only
-- supplier-specific column was codecraft_reference. Nothing in the app reads or writes it.
-- Verified before dropping: no code references, no inbound foreign keys.
DROP TABLE IF EXISTS public.fulfillment_logs;