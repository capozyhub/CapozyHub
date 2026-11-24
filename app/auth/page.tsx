import { signupsPaused } from '@/lib/signup-gate'
import AuthClient from './auth-client'

// The pause is an env switch, so this page must be rendered per request, never prerendered
// with whatever the value was at build time.
export const dynamic = 'force-dynamic'

export default function AuthPage() {
    return <AuthClient signupsPaused={signupsPaused()} />
}
