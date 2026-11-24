/** Where a complaint came from, worked out from the order it is linked to. */
export type ComplaintOrigin = 'shop' | 'website' | 'api' | 'general'

export const ORDER_COLUMNS =
    'reference_code, network, size, status, price, phone_number, created_at, shop_name, shop_order_id, source'

export function originOf(
    order: { shop_order_id?: string | null; shop_name?: string | null; source?: string | null } | null | undefined,
): ComplaintOrigin {
    if (!order) return 'general'
    if (order.shop_order_id || order.shop_name) return 'shop'
    if (order.source === 'api') return 'api'
    return 'website'
}
