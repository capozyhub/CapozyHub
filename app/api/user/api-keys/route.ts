import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { parseAllowedRoles } from '@/lib/role-parser'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// ============================================================================
// API Key Management — User Endpoints (cookie-based auth, NOT API key auth)
// GET  — View the current key (prefix + status only, never the full key),
//        returned as api_keys.standard.
// POST — Generate a new key (deletes the OLD key and returns the full key ONCE)
// ============================================================================

// ── GET: View the current API key ─────────────────────────────────────────

export async function GET() {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createServerClient()

        // Check if user's role is allowed for API access
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        const userRole = (userData as any)?.role

        // Get allowed roles from admin_settings
        const { data: rolesSetting } = await (supabase
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'api_allowed_roles')
            .single()

        const allowedRoles = parseAllowedRoles(rolesSetting?.value)

        const isEligible = allowedRoles.includes(userRole)

        // Get the user's current API key rows.
        const { data: apiKeys, error: keyError } = await (supabase
            .from('api_keys') as any)
            .select('id, key_prefix, name, status, key_type, last_used_at, created_at, updated_at')
            .eq('user_id', authUser.id)

        if (keyError) {
            console.error('[API Keys GET] DB error:', keyError.message)
            return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
        }

        const mapKey = (k: any) => k ? {
            id: k.id,
            prefix: k.key_prefix,
            name: k.name,
            status: k.status,
            key_type: k.key_type,
            last_used_at: k.last_used_at,
            created_at: k.created_at,
        } : null

        const standardKey = (apiKeys || []).find((k: any) => k.key_type === 'standard') || null

        // Check if API feature is enabled
        const { data: featureSetting } = await (supabase
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'api_feature_enabled')
            .single()

        const featureEnabled = featureSetting?.value !== 'false' && featureSetting?.value !== false

        return NextResponse.json({
            feature_enabled: featureEnabled,
            is_eligible: isEligible,
            allowed_roles: allowedRoles,
            user_role: userRole,
            api_keys: {
                standard: mapKey(standardKey),
            },
        })
    } catch (error: any) {
        console.error('[API Keys GET] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── POST: Generate a new API key ──────────────────────────────────────────
// An existing key is deleted (revoked permanently). The new full key is returned
// ONCE in this response — never stored in plaintext.

export async function POST(request: NextRequest) {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createServerClient()

        // ── Check feature toggle ──────────────────────────────────────────
        const { data: featureSetting } = await (supabase
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'api_feature_enabled')
            .single()

        if (featureSetting?.value === 'false' || featureSetting?.value === false) {
            return NextResponse.json({ error: 'API feature is currently disabled' }, { status: 503 })
        }

        // ── Check role eligibility ────────────────────────────────────────
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        const userRole = (userData as any)?.role

        const { data: rolesSetting } = await (supabase
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'api_allowed_roles')
            .single()

        const allowedRoles = parseAllowedRoles(rolesSetting?.value)

        if (!allowedRoles.includes(userRole)) {
            return NextResponse.json({
                error: 'API access is not available for your account type',
            }, { status: 403 })
        }

        // ── Parse optional key name from body ─────────────────────────────
        // There is exactly one key type ('standard'); anything else is rejected.
        let keyName = 'My API Key'
        try {
            const body = await request.json()
            if (body?.name && typeof body.name === 'string' && body.name.trim().length > 0) {
                keyName = body.name.trim().substring(0, 50) // Max 50 chars
            }
            if (body?.key_type !== undefined && body.key_type !== null && body.key_type !== 'standard') {
                return NextResponse.json({ error: "key_type must be 'standard'" }, { status: 400 })
            }
        } catch {
            // No body or invalid JSON — use defaults
        }

        // ── Delete the user's existing key ────────────────────────────────
        // This permanently revokes the old key. The user was warned in the UI.
        await (supabase.from('api_keys') as any)
            .delete()
            .eq('user_id', authUser.id)
            .eq('key_type', 'standard')

        // ── Generate new key ──────────────────────────────────────────────
        // cz_live_ + 32 hex = 40 chars. The prefix is ALWAYS the first 16 chars
        // (must match lib/api-auth.ts's lookup).
        const randomPart = randomBytes(16).toString('hex') // 32 hex chars
        const fullKey = `cz_live_${randomPart}`
        const keyPrefix = fullKey.substring(0, 16)

        // Hash for storage (bcrypt, 10 salt rounds)
        const keyHash = await bcrypt.hash(fullKey, 10)

        // ── Insert new key (pending until an admin approves it) ───────────
        const { data: newKey, error: insertError } = await (supabase
            .from('api_keys') as any)
            .insert({
                user_id: authUser.id,
                key_hash: keyHash,
                key_prefix: keyPrefix,
                name: keyName,
                key_type: 'standard',
                status: 'pending',
            })
            .select('id, key_prefix, name, status, key_type, created_at')
            .single()

        if (insertError) {
            console.error('[API Keys POST] Insert error:', insertError)
            return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
        }

        // ── Return the full key ONCE ──────────────────────────────────────
        // This is the ONLY time the plaintext key is visible.
        // After this response, only the hash exists in the database.
        return NextResponse.json({
            success: true,
            message: 'API key generated successfully. Save this key now — it will NOT be shown again.',
            api_key: {
                key: fullKey, // ← Shown ONCE, then never again
                prefix: newKey.key_prefix,
                name: newKey.name,
                status: newKey.status,
                key_type: newKey.key_type,
                created_at: newKey.created_at,
            },
            warning: 'Your API key requires admin approval before it can be used. Status: pending.',
        })
    } catch (error: any) {
        console.error('[API Keys POST] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
