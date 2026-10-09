/**
 * Geometry shared by the dashboard and admin shells. The sidebar floats 0.75rem in from the
 * viewport edge, so the content column and the sticky header both start past it.
 *
 *   expanded:  0.75 + 17    + 0.75 = 18.5rem
 *   collapsed: 0.75 + 4.75  + 0.75 = 6.25rem
 */
export const sidebarWidth = (collapsed: boolean) => (collapsed ? 'w-[4.75rem]' : 'w-[17rem]')
export const contentOffset = (collapsed: boolean) => (collapsed ? 'lg:pl-[6.25rem]' : 'lg:pl-[18.5rem]')
export const headerOffset = (collapsed: boolean) => (collapsed ? 'lg:left-[6.25rem]' : 'lg:left-[18.5rem]')

/** Reserves the space the fixed header takes so page content starts below it. */
export const HEADER_SPACER = 'h-14 lg:h-20 flex-shrink-0'
