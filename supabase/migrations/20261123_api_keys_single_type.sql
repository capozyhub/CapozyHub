-- Retire every API key that is not a standard, cs_live_ or cz_live_-format key.
--
-- Capozy has exactly one key type ('standard', prefix cs_live_; older cz_live_ keys stay valid,
-- see lib/api-key-format.ts). validateApiKey and the middleware
-- both reject any other shape, so rows carried over from the previous product (kf_live_, commission,
-- sms) can never authenticate. Revoke them so owners and admins do not see them as usable, and
-- tighten the constraint so the database refuses any other type from now on.
--
-- Not applied automatically. Apply with: node scripts/apply-sql.js supabase/migrations/20261123_api_keys_single_type.sql

BEGIN;

UPDATE public.api_keys
SET status = 'revoked',
    updated_at = now()
WHERE (key_type <> 'standard' OR key_prefix !~ '^c[sz]_live_')
  AND status <> 'revoked';

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_key_type_check;
ALTER TABLE public.api_keys
    ADD CONSTRAINT api_keys_key_type_check CHECK (key_type = 'standard') NOT VALID;

-- NOT VALID leaves already-revoked legacy rows alone; validate once they have been cleaned up.

COMMIT;