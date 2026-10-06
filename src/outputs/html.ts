import { fileURLToPath } from 'node:url'
import { Eta } from 'eta'
import { readViewBox, responsiveCss } from '../design/responsive.js'
import type { Theme } from '../design/themes.js'

const eta = new Eta({ views: fileURLToPath(new URL('../templates/', import.meta.url)) })

/** Wraps an optimized SVG in a standalone page: inline SVG, inline CSS, no external requests. */
export function svgToHtml(svg: string, options: { title: string; theme: Theme; responsive: boolean }): string {
  const width = readViewBox(svg)?.width ?? 1200
  return eta.render('basic', {
    title: options.title,
    css: responsiveCss({ width, background: options.theme.colors.bg, responsive: options.responsive }),
    svg,
  })
}
