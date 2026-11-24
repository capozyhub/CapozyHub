/**
 * Kill switch for new accounts. Set SIGNUPS_PAUSED=true in the environment (a plain
 * server-side variable, deliberately not NEXT_PUBLIC_) and redeploy: nobody can create an
 * account, the auth page shows a "come back later" note, and existing users sign in as usual.
 *
 * It is read on every call, never at module load, so it follows the deployment's env.
 * Only the public signup route and the auth page use it. Accounts a signed-in agent creates
 * for their own sub-agents (lib/sub-agent-create.ts) are not covered.
 */
export function signupsPaused(): boolean {
    return process.env.SIGNUPS_PAUSED?.trim().toLowerCase() === 'true'
}
