# Source project env vars (names only — no values)

Pulled from the KiNG FLEXY GH Vercel project (`kingflexygh`, prj_Owe7v9ICR4rZivLBcKj8PAAv0Rof)
on 2026-10-07, read-only, for building the Capozy Hub Stage 4 checklist. Values were never
read into the assistant session — Vercel's API only returned them because `decrypt` was not
requested is irrelevant here; the raw response that *did* include some values was never opened,
only `key`/`type`/`target` were extracted via script. 63 of 72 variable names below; 9 entries
were unrecoverable from that extraction pass (duplicates of names likely already listed here
across dev/preview/production, not unique secrets).

**None of these values apply to Capozy Hub.** Every one must be freshly generated or newly
issued for Capozy's own accounts — see Stage 4 checklist.

- AGENTPORTAL_API_BASE_URL
- AGENTPORTAL_API_KEY
- AGENTPORTAL_WEBHOOK_SECRET
- API_RATE_LIMIT_SALT
- ATISHARE_CONSOLE_API_KEY
- ATISHARE_CONSOLE_BASE_URL
- BUNDLEPORTAL_API_BASE_URL
- BUNDLEPORTAL_API_KEY
- BUNDLEPORTAL_WEBHOOK_SECRET
- CODECRAFT_API_KEY
- CRON_SECRET
- DAKAZINA_WEBHOOK_SECRET
- DATAGOD_API_KEY
- DATAKAZINA_API_BASE_URL
- DATAKAZINA_API_KEY
- ENABLE_AUTO_FULFILLMENT
- GHDATA_API_BASE_URL
- GHDATA_API_KEY
- GHDATA_WEBHOOK_SECRET
- HENDYLINKS_API_BASE_URL
- HENDYLINKS_API_KEY
- HUBTEL_API_ID
- HUBTEL_API_KEY
- HUBTEL_CLIENT_ID
- HUBTEL_CLIENT_SECRET
- HUBTEL_COLLECTION_ACCOUNT
- HUBTEL_COMMISSION_STATUSCHECK_AUTO
- HUBTEL_COMMISSION_WEBHOOK_SECRET
- HUBTEL_DISBURSEMENT_ACCOUNT
- HUBTEL_PROXY_URL
- HUBTEL_SENDER_ID
- KV_REST_API_READ_ONLY_TOKEN
- KV_REST_API_TOKEN
- KV_REST_API_URL
- KV_URL
- MAILERSEND_API_KEY
- MNOTIFY_API_KEY
- MNOTIFY_SENDER_ID
- MOOLRE_ACCOUNT_NUMBER
- MOOLRE_API_KEY
- MOOLRE_SENDER_ID
- MOOLRE_TRANSFER_API_KEY
- MOOLRE_TRANSFER_API_USER
- NEXT_PUBLIC_COOKIE_DOMAIN
- NEXT_PUBLIC_GOOGLE_CLIENT_ID
- NEXT_PUBLIC_MARKET_URL
- NEXT_PUBLIC_STORE_URL
- NEXT_PUBLIC_USSD_SHORTCODE
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- REDIS_URL
- RESEND_API_KEY
- SMS_FORWARD_SECRET
- SPFASTIT_API_KEY
- SPFASTIT_BASE_URL
- SPFASTIT_WEBHOOK_SECRET
- UPSTASH_REDIS_REST_TOKEN
- UPSTASH_REDIS_REST_URL
- USSD_SERVICE_CODE
- USSD_STATE_SECRET
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT
- XPRESS_KEY
- XPRESS_WEBHOOK_SECRET

Also present but not in this project-level list (found via code scan of `process.env.*` in the
source repo, so likely set some other way — team-level shared env, or missing): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`,
`NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `KF_WEBHOOK_SECRET`, `USSD_CALLBACK_SECRET`,
`HUBTEL_RECEIVE_WEBHOOK_SECRET`, `HUBTEL_SMS_DLR_SECRET`, `HUBTEL_SMS_STATUS_URL`,
`HUBTEL_AIRTIME_SERVICEID_MTN/AT/TELECEL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`,
`NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE`, `NEXT_PUBLIC_AGENT_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `TEST_ADMIN_USER_ID`.

## Project domains (source project, for reference — none apply to Capozy)
kingflexygh.com, www.kingflexygh.com, api.kingflexygh.com, shop.kingflexygh.com,
agent.kingflexygh.com, preview.kingflexygh.com, king-flexy-gh.vercel.app

## Deployment protection on source project
SSO protection enabled (`all_except_custom_domains`) — Capozy should decide this independently in Stage 4.
