-- Capozy Hub: stop data_packages leaking wholesale cost and the agent/dealer price tiers
--
-- Apply after 00000000000004_place_results_checker_order.sql.
--
-- The "Anyone can view packages" policy (USING true) plus a table-wide SELECT grant meant
-- that anyone holding the public key, signed in or not, could read cost_price (what we pay
-- the supplier), agent_price and dealer_price for every bundle. The dashboard even cached
-- that raw row in localStorage.
--
-- From here:
--   * the browser may read ONLY the customer-facing columns below (the customer price is
--     already shown on the storefronts);
--   * cost_price, agent_price, dealer_price, ussd_* and the timestamps are server-only. The
--     dashboard gets its own tier price, already resolved for the signed-in member, from
--     GET /api/dashboard/packages;
--   * no browser role can write the table or run TRUNCATE / TRIGGER / REFERENCES on it. Every
--     write goes through the admin API routes, which use the service role.
--
-- RLS stays on and the SELECT policy stays as it is; this only narrows what the roles may
-- touch. service_role is unaffected.

REVOKE ALL ON TABLE public.data_packages FROM anon, authenticated;

GRANT SELECT (id, network, size, price, description, is_available, sort_order, category)
    ON public.data_packages TO anon, authenticated;
