/** Theme-independent layout rules. Colors live in themes.ts. */
export const tokens = {
  fontFamily: 'Segoe UI, Inter, Helvetica Neue, Arial, sans-serif',
  size: { title: 34, subtitle: 17, heading: 19, stat: 30, body: 15, small: 13 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, page: 48 },
  radius: { sm: 6, md: 12 },
  stroke: { base: 1.5, icon: 2 },
  icon: { sm: 16, md: 22, lg: 28 },
  canvas: { width: 1200 },
} as const
