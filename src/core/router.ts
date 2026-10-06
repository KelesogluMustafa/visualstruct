import { D2_TYPES, type Engine, type VisualType } from '../types.js'

const d2Types: ReadonlySet<string> = new Set(D2_TYPES)

export function routeEngine(type: VisualType): Engine {
  return d2Types.has(type) ? 'd2' : 'svgjs'
}
