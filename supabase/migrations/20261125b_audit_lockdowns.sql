-- Security audit 2026-11-25 (docs/security-audits/2026-11-25-money-db-residue-sweep.md).
--
-- 1. users: a signed-in user could rewrite their own suspended_until / suspension_reason /
--    suspended_at / suspended_by through PostgREST. Setting suspended_until to a past date
--    lifted a permanent suspension (dashboard gate + auto-unsuspend cron). Lock them the same
--    way role/status already are. Admin routes and crons use the service role
--    (auth.uid() IS NULL) and are unaffected.
-- 2. shop_pricing: owners could INSERT/UPDATE rows directly, skipping the profit cap and
--    sub_price bounds enforced in app/api/shop/pricing/route.ts (which writes with the service
--    role). Drop the owner write policies; SELECT and DELETE are left as they were.
-- 3. shop_profiles: pin the remaining admin-owned columns (pricing review, USSD, sender ID) in
--    protect_shop_admin_columns so a direct PATCH cannot set them.

begin;

create or replace function public.guard_users_privilege_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      raise exception 'SECURITY: changing account role is not permitted for this session';
    end if;
    if new.agent_expires_at is distinct from old.agent_expires_at
       or new.dealer_expires_at is distinct from old.dealer_expires_at then
      raise exception 'SECURITY: changing reseller expiry is not permitted for this session';
    end if;
    if new.status is distinct from old.status
       or new.suspended_until is distinct from old.suspended_until
       or new.suspension_reason is distinct from old.suspension_reason
       or new.suspended_at is distinct from old.suspended_at
       or new.suspended_by is distinct from old.suspended_by then
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
$function$;

drop policy if exists shop_pricing_insert_owner_or_admin on public.shop_pricing;
drop policy if exists shop_pricing_update_owner_or_admin on public.shop_pricing;

create or replace function public.protect_shop_admin_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  -- Only enforce for signed-in owners. Server code uses the service role and is not
  -- subject to this guard.
  IF auth.role() = 'authenticated' THEN
    NEW.paystack_fee_percent      := OLD.paystack_fee_percent;
    NEW.withdrawal_fee_percent    := OLD.withdrawal_fee_percent;
    NEW.withdrawal_fee_flat       := OLD.withdrawal_fee_flat;
    NEW.min_withdrawal_amount     := OLD.min_withdrawal_amount;
    NEW.approval_status           := OLD.approval_status;
    NEW.approval_note             := OLD.approval_note;
    NEW.fulfillment_mode          := OLD.fulfillment_mode;
    NEW.is_active                 := OLD.is_active;
    NEW.approved_by               := OLD.approved_by;
    NEW.approved_at               := OLD.approved_at;
    NEW.utilities_enabled         := OLD.utilities_enabled;
    -- Owner pricing: only app/api/shop/pricing/route.ts (service role) may change these.
    NEW.airtime_fee_mtn                   := OLD.airtime_fee_mtn;
    NEW.airtime_fee_telecel               := OLD.airtime_fee_telecel;
    NEW.airtime_fee_at                    := OLD.airtime_fee_at;
    NEW.mashup_fee_percent                := OLD.mashup_fee_percent;
    NEW.results_checker_markup_customer   := OLD.results_checker_markup_customer;
    NEW.results_checker_markup_agent      := OLD.results_checker_markup_agent;
    NEW.results_checker_markup_dealer     := OLD.results_checker_markup_dealer;
    NEW.afa_fee_percent                   := OLD.afa_fee_percent;
    NEW.afa_selling_price                 := OLD.afa_selling_price;
    -- Pricing review state is set by the pricing route and the admin review only.
    -- (pricing_rejection_acknowledged stays owner-writable: the pricing page sets it.)
    NEW.pricing_status            := OLD.pricing_status;
    NEW.pricing_note              := OLD.pricing_note;
    NEW.pricing_submitted_at      := OLD.pricing_submitted_at;
    NEW.pricing_approved_at       := OLD.pricing_approved_at;
    NEW.pricing_approved_by       := OLD.pricing_approved_by;
    -- Admin-assigned identifiers.
    NEW.ussd_code                 := OLD.ussd_code;
    NEW.ussd_active               := OLD.ussd_active;
    NEW.ussd_activated_at         := OLD.ussd_activated_at;
    NEW.sms_sender_id             := OLD.sms_sender_id;
    NEW.sms_sender_status         := OLD.sms_sender_status;
    NEW.sms_sender_reviewed_at    := OLD.sms_sender_reviewed_at;
  END IF;
  RETURN NEW;
END;
$function$;

commit;
