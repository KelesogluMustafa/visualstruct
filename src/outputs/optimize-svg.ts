import { optimize } from 'svgo'
import type { Engine } from '../types.js'

/**
 * D2 output relies on its embedded stylesheet and generated ids, so the passes
 * that rewrite those are disabled for it.
 */
export function optimizeSvg(svg: string, engine: Engine): string {
  const d2Safe = { cleanupIds: false, inlineStyles: false, minifyStyles: false } as const
  return optimize(svg, {
    multipass: true,
    plugins: [{ name: 'preset-default', params: { overrides: engine === 'd2' ? d2Safe : {} } }],
  }).data
}
