// Single source of truth for what a membership gives. Every line here is backed by a role check
// or a role-based price in the code; do not add marketing claims that nothing enforces
// (there is no role-based order queue, support routing or API rate limit).

/** What Agent gives over a customer account. */
export const AGENT_BENEFITS = [
    'Lower data bundle prices than customers pay',
    'Lower airtime and mashup fees, with higher order limits',
    'Lower results-checker prices',
    'Bulk orders: buy many bundles in one go',
    'Recruit sub-agents and set their prices',
    'Developer API access',
    'Bigger shop margins, because your cost drops to the agent price',
]

/** What Dealer adds on top of Agent. */
export const DEALER_BENEFITS = [
    'Everything in Agent',
    'Dealer-tier data prices, lower than Agent',
    'The lowest airtime and mashup fees and the highest order limits',
    'Dealer prices on results checker',
    'Even bigger shop margins, from the lower dealer cost',
]
