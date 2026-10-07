import pptxgen from 'pptxgenjs'

// The package's typings describe a CommonJS default export, but under Node ESM the import is the class itself.
const PptxGenJS = pptxgen as unknown as typeof pptxgen.default

// 16:9 widescreen slide, in inches.
const SLIDE = { width: 13.333, height: 7.5, margin: 0.35 }

/**
 * One 16:9 slide with the visual centered and scaled to fit. The visual is embedded as PNG:
 * SVG pictures only render in recent PowerPoint versions, PNG opens everywhere.
 */
export async function pngToPptx(
  png: Buffer,
  options: { title: string; width: number; height: number; background: string },
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = options.title
  pptx.company = 'VisualStruct'

  const maxW = SLIDE.width - 2 * SLIDE.margin
  const maxH = SLIDE.height - 2 * SLIDE.margin
  const scale = Math.min(maxW / options.width, maxH / options.height)
  const w = options.width * scale
  const h = options.height * scale

  const slide = pptx.addSlide()
  slide.background = { color: options.background.replace('#', '') }
  slide.addImage({
    data: `image/png;base64,${png.toString('base64')}`,
    x: (SLIDE.width - w) / 2,
    y: (SLIDE.height - h) / 2,
    w,
    h,
    altText: options.title,
  })
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}
