import { BRAND } from '@/lib/brand'
import { OfflineScreen } from '@/components/offline-screen'

// Precached document fallback for the service worker (next.config.ts, withPWAInit
// `fallbacks.document`). It is served when a navigation fails for lack of network, and it
// renders the same screen as the live overlay so the hand-off after hydration is seamless.
export default function OfflinePage() {
    return <OfflineScreen name={BRAND.name} />
}
