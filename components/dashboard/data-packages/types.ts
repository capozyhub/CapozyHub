/**
 * A bundle as the dashboard sees it. This is deliberately NOT the data_packages row: supplier
 * cost and the agent and dealer tiers stay on the server. `your_price` is what the signed-in
 * member pays; `price` is the public customer price.
 */
export interface Bundle {
    id: string
    network: string
    size: string
    description: string | null
    category: string | null
    sort_order: number | null
    price: number
    your_price: number
}
