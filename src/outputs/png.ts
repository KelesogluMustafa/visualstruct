import { Resvg } from '@resvg/resvg-js'

export const RESVG_FONT = { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' }

/** Rasterizes at 2x so text stays crisp on high-density screens. */
export function svgToPng(svg: string, scale = 2): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: RESVG_FONT,
  })
  return resvg.render().asPng()
}
