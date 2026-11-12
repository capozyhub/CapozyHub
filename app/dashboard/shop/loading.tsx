// Scoped Suspense fallback for ALL /dashboard/shop/* navigations. Without this,
// the force-dynamic dashboard has no close loading boundary, so taps show no
// feedback until the new page's server render returns (the "ghost button" delay).
export default function ShopLoading() {
    return (
        <div className="space-y-5 pb-20 md:pb-6" aria-busy="true" aria-label="Loading your shop">
            <div className="neu-raised-sm h-56 rounded-3xl" />
            <div className="grid grid-cols-4 gap-2.5 md:grid-cols-8">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="neu-raised-sm h-20 rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="neu-raised-sm h-20 rounded-2xl" />
                ))}
            </div>
            <div className="neu-raised-sm h-64 rounded-3xl" />
        </div>
    )
}
