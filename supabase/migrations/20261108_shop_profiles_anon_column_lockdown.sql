-- ============================================================================
-- MIGRATION: shop_profiles — restrict anonymous column access
-- Date:      2026-11-08
--
-- Problem: `anon` held table-level SELECT on shop_profiles, and RLS only filters ROWS
-- (approved + active shops). Anyone with the public anon key could therefore read EVERY
-- column of every live shop through /rest/v1/shop_profiles — including ussd_code,
-- approval/pricing notes, approver ids, SMS sender state and fee settings. That undid the
-- anti-enumeration design in /api/shop-domain/search (which deliberately never returns
-- ussd_code).
--
-- Fix: revoke the table-level grant from anon and re-grant ONLY the columns a logged-out
-- visitor legitimately needs. All storefront pages/APIs read via the service role, and the
-- one anon-session page (results-checker retrieve) only selects columns kept below.
-- `authenticated` and `service_role` are untouched.
-- ============================================================================

REVOKE SELECT ON public.shop_profiles FROM anon;

GRANT SELECT (
    id,
    owner_id,          -- referenced by the RLS policies
    shop_name,
    shop_slug,
    description,
    owner_phone,
    owner_email,
    whatsapp_number,
    logo_url,
    banner_url,
    brand_color,
    brand_accent,
    community_link,
    divider_style,
    banner_pos_x,
    banner_pos_y,
    banner_zoom,
    approval_status,
    is_active
) ON public.shop_profiles TO anon;

NOTIFY pgrst, 'reload schema';
