// lib/pricing/sub-agent-cost.ts
// =============================================================================
// Sub-agent cost resolution (spec §4). One level, one hop: a recruiter can
// never themselves be a sub, so there is no recursion here, unlike the
// abandoned 2026-08-19 two-level design this replaces.
//
// recruiterEarns depends ONLY on recruiterCost and markup — never on a sale's
// selling price. This is what makes the storefront case (spec §8.1) safe: the
// same number applies whether the sub buys from their own dashboard or a guest
// buys from the sub's shop. There is no split to compute at sale time, only a
// number to look up and not forget to persist.
// =============================================================================

import { r2 } from '@/lib/pricing/cost-basis'

export interface SubAgentCostInput {
  /** What the RECRUITER pays: their role price, or (never, here) a further-nested cost. */
  recruiterCost: number
  /** The recruiter's markup for this sub on this product. 0 is legal. */
  markup: number
  /** Standard customer price — the hard ceiling (spec §4.3). */
  customerPrice: number
}

export interface SubAgentCostResult {
  ok: boolean
  reason?: string
  /** What the sub pays. 0 on rejection — never charge on !ok. */
  subCost: number
  /** What the recruiter earns. 0 on rejection — never credit on !ok. */
  recruiterEarns: number
}

const REJECT = (reason: string): SubAgentCostResult => ({ ok: false, reason, subCost: 0, recruiterEarns: 0 })

export function computeSubAgentCost(input: SubAgentCostInput): SubAgentCostResult {
  const { recruiterCost, markup, customerPrice } = input

  if (!Number.isFinite(recruiterCost) || recruiterCost <= 0) {
    return REJECT('Pricing is not available for this package')
  }
  if (!Number.isFinite(markup) || markup < 0) {
    return REJECT('Pricing is not available for this package')
  }
  if (!Number.isFinite(customerPrice) || customerPrice <= 0) {
    return REJECT('Pricing is not available for this package')
  }

  const subCost = r2(recruiterCost + markup)

  // A sub-agent never pays more than the public retail price (re-enabled 2026-11-25 after
  // being switched off for testing on 2026-09-14). The pricing-config routes reject such a
  // markup when it is saved (buildValidatedWrites' ceiling), so this charge-time check only
  // catches drift, e.g. an admin lowering the retail price below an existing sub price.
  if (subCost > customerPrice) {
    return REJECT('Pricing exceeds the allowed maximum for this package')
  }

  return { ok: true, subCost, recruiterEarns: r2(markup) }
}
