import { Resvg } from '@resvg/resvg-js'

/** Rasterizes at 2x so text stays crisp on high-density screens. */
export function svgToPng(svg: string, scale = 2): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' },
  })
  return resvg.render().asPng()
}
