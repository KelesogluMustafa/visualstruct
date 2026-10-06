import { readViewBox } from '../design/responsive.js'

const MAX_BYTES = 2_000_000

/** Cheap structural checks on a final SVG. Errors block output; warnings are reported. */
export function basicQa(svg: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!/^\s*(<\?xml[^>]*\?>\s*)?<svg\b/.test(svg)) errors.push('output does not start with an <svg> element')
  if (!svg.trimEnd().endsWith('</svg>')) errors.push('output is not a closed <svg> document')
  if (!readViewBox(svg)) errors.push('root <svg> has no valid viewBox')
  if (/="[^"]*\b(NaN|undefined)\b[^"]*"/.test(svg)) errors.push('output contains NaN/undefined attribute values')
  if (Buffer.byteLength(svg) > MAX_BYTES) warnings.push('SVG is larger than 2 MB')

  return { errors, warnings }
}
