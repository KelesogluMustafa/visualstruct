import { VisualStructError } from '../types.js'

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

const ROOT_TAG = /<svg\b[^>]*>/

function rootAttr(svg: string, name: string): string | undefined {
  return ROOT_TAG.exec(svg)?.[0].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

export function readViewBox(svg: string): ViewBox | null {
  const parts = rootAttr(svg, 'viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null
  const [x, y, width, height] = parts as [number, number, number, number]
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

/** Every VisualStruct SVG must scale, so a missing viewBox is derived from width/height. */
export function ensureViewBox(svg: string): string {
  if (readViewBox(svg)) return svg
  const width = Number.parseFloat(rootAttr(svg, 'width') ?? '')
  const height = Number.parseFloat(rootAttr(svg, 'height') ?? '')
  if (!(width > 0 && height > 0)) {
    throw new VisualStructError('QA_FAILED', 'Rendered SVG has neither a viewBox nor a usable width/height')
  }
  return svg.replace(ROOT_TAG, (tag) => tag.replace(/^<svg/, `<svg viewBox="0 0 ${width} ${height}"`))
}

/** Below this width the page scrolls horizontally instead of shrinking the visual further. */
export function minReadableWidth(viewBoxWidth: number): number {
  return Math.round(Math.min(viewBoxWidth, Math.max(480, viewBoxWidth * 0.6)))
}

export function responsiveCss(options: { width: number; background: string; responsive: boolean }): string {
  const { width, background, responsive } = options
  const sizing = responsive
    ? `width: 100%; height: auto; max-width: ${Math.round(width)}px; min-width: ${minReadableWidth(width)}px;`
    : `width: ${Math.round(width)}px; height: auto;`
  return [
    `html, body { margin: 0; }`,
    `body { background: ${background}; }`,
    `.visualstruct { width: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }`,
    `.visualstruct svg { display: block; margin: 0 auto; ${sizing} }`,
  ].join('\n')
}
