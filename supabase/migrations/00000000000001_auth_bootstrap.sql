-- Capozy Hub: auth bootstrap
--
-- Apply after 00000000000000_baseline.sql.
--
-- 1. The baseline was introspected from the public schema only, so it contains
--    public.handle_new_user() but NOT the trigger on auth.users that calls it.
--    Without this trigger a sign-up gets an auth.users row but no public.users row.
--
-- 2. Every new account is a customer, and no client can say otherwise.
--      - handle_new_user() already hard-codes role 'customer' and ignores any
--        role in raw_user_meta_data (which a client controls on direct sign-up).
--      - The baseline also let any signed-in client INSERT its own public.users row
--        with ANY role (policy "Users can insert their own profile" checked only
--        id = auth.uid(), and the privilege guard trigger only covers UPDATE).
--        Nothing legitimate inserts into public.users except handle_new_user(), so
--        that policy and the INSERT grants are removed.
--      - As defence in depth, a BEFORE INSERT trigger forces customer/active with no
--        reseller expiry on every insert, whoever the caller is. Sub-agents and
--        admins are created as customers and then promoted by a server-side
--        (service role) UPDATE, which the existing UPDATE guard still allows.
--
-- 3. Phone numbers are collected unverified now, so they are no longer unique
--    (a unique unverified number lets anyone squat a victim's number).

-- 1. auth.users -> public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Customer-only sign-up
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
REVOKE INSERT ON public.users FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.force_customer_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  NEW.role := 'customer';
  NEW.status := 'active';
  NEW.agent_expires_at := NULL;
  NEW.dealer_expires_at := NULL;
  NEW.phone_verified := false;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.force_customer_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_force_customer_on_insert ON public.users;
CREATE TRIGGER trg_force_customer_on_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.force_customer_on_insert();

-- 3. Unverified phone numbers are not unique
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_number_key;
