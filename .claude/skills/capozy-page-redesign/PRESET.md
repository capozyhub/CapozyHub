# The Capozy UI preset

Source of truth: the landing page (`components/home-client.tsx`) and the account pages (`components/auth/auth-shell.tsx`, `components/auth/fields.tsx`, `app/auth/page.tsx`). Already converted and good references for app screens: `app/dashboard/shop/*`, `app/dashboard/upgrade`, `app/dashboard/data-packages`, the sidebar (`components/dashboard/sidebar.tsx`). **Every page should read as the same product as those.** The preset is soft, tactile, black-and-gold: neumorphic surfaces, clay buttons, big confident display type.

## Surfaces (defined in `app/globals.css`)
| Use | Class |
|---|---|
| Page background | `bg-neu` (`#E8E8E8` light, `#141414` dark) |
| Main card / panel | `neu-raised` with `rounded-[2rem]` (large) or `rounded-3xl` |
| Small card, row, chip, tile | `neu-raised-sm` with `rounded-2xl` / `rounded-3xl` |
| Inputs, wells, pressed/selected state, meters | `neu-inset` with `rounded-xl` (selected nav row, active tab, search box) |
| Tappable raised element | add `neu-press` |
| Dark stage (hero, side panel, feature band) | `bg-black text-white`; raised blocks on it use `neu-night`, wells use `neu-night-in` |
| Floating popover / menu | `surface-pop` |

## Buttons and icon blocks
- Primary action: `clay-gold` pill (`rounded-full`, `min-h-[3.25rem]`, `text-base font-semibold`, black text). Use `ClayButton` from `components/auth/fields.tsx` where it fits.
- Secondary: `clay-black` (on light) or `clay-silver` (on black). Destructive: `clay-red`.
- Round icon/status badges: `clay-gold flex h-N w-N items-center justify-center rounded-full` (the done tick, the section icon).
- One primary action per view. Do not use `bg-violet-*`, `bg-emerald-*`, `bg-blue-*` or `bg-gradient-to-*` buttons.

## Type
- Headings: `font-display font-bold tracking-tight text-balance`, tight leading. Page title scale on app screens: `text-2xl sm:text-3xl`; marketing/section titles `text-3xl sm:text-4xl lg:text-5xl leading-[1.05]` (`SectionHeading`).
- Body: default `font-body`; secondary text `text-muted-foreground`; on black stages `text-silver-200` (lead) and `text-silver-100`.
- Gold accent text: `text-brand-500`/`text-brand-400` on black; `text-brand-700`/`text-brand-800` on light (never light gold on light, it fails contrast).
- Copy: short, plain, specific sentences ("Register for AFA without leaving your phone."). Sentence case. No shouting, no filler.

## Layout rhythm
- Marketing sections: `py-20 sm:py-28`, alternate light and black bands, `scroll-mt-24` on anchored sections.
- App screens: stack of `neu-raised` cards with `space-y-5`/`gap-5`, stat tiles in a 2- or 4-column grid of `neu-raised-sm`, generous padding (`p-4 sm:p-5`).
- Forms: `TextField`, `PasswordField`, `Notice` from `components/auth/fields.tsx` (label above, input inside a `neu-inset` well, hint/error below). Multi-step flows show progress (`AuthShell` draws the brand swoosh).
- The brand swoosh (`components/brand-swoosh.tsx`) is the signature graphic for hero/stage areas; use sparingly.

## States and accessibility (non-negotiable)
- Focus: visible outline, `outline-brand-600` on light and `outline-brand-500` on dark (the shared `FOCUS` constant). Icon-only buttons need `aria-label`.
- Errors/notices: `Notice` (`neu-inset`, `role="alert"` for errors). Loading, empty, error and success states all exist. Confirm destructive or money actions in an in-page dialog, never `window.confirm`.
- Honour `motion-reduce`. Contrast holds in both themes. Works at 360px.

## What reads as the OLD (KiNG FLEXY) look: remove it
`bg-white dark:bg-slate-900` cards with `border-slate-200` and `rounded-2xl shadow-*`; `violet-*`/`emerald-*`/`orange-*`/`sky-*` accents and tinted info boxes; `bg-gradient-to-*` headers; `glass-card`, `village-card`, `gradient-primary|success|warning|danger`; tiny `text-[10px] uppercase tracking-wider` section labels everywhere; stacks of identical bordered boxes. Replace the **structure** (grouping, hierarchy, density), not just the colours.

## Network brand colours are the one exception
MTN gold, Telecel red and AirtelTigo blue/purple (`mtn`, `telecel`, `clay-red/blue/purple`, `NetworkIcon`) stay, but only on the network badge or its price chip, never as page chrome.
