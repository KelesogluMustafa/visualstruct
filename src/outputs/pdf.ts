import { Resvg } from '@resvg/resvg-js'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import { readViewBox } from '../design/responsive.js'
import { RESVG_FONT } from './png.js'

const SVG_IMAGE = /<image\b([^>]*?)\/?>(?:\s*<\/image>)?/g
const SVG_DATA_URI = /href="data:image\/svg\+xml;base64,\s*([^"]+)"/

/** D2 embeds icons as SVG data-URI images, which PDFKit cannot open; they become nested <svg> elements. */
function inlineSvgImages(svg: string): string {
  return svg.replace(SVG_IMAGE, (image, attrs: string) => {
    const data = SVG_DATA_URI.exec(attrs)?.[1]
    if (!data) return image
    const box = ['x', 'y', 'width', 'height'].map((name) => `${name}="${new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? 0}"`)
    return Buffer.from(data, 'base64')
      .toString('utf8')
      .replace(/<\?xml[^>]*\?>/, '')
      .replace(/<svg\b([^>]*)>/, (_tag, inner: string) => `<svg ${box.join(' ')}${inner.replace(/\s(x|y|width|height)="[^"]*"/g, '')}>`)
  })
}

/**
 * Resolves CSS and converts text to outlines, leaving plain paths. The PDF then needs no fonts
 * and matches the PNG exactly; the trade-off is that text in the PDF is not selectable.
 */
function flattenSvg(svg: string): string {
  return inlineSvgImages(new Resvg(svg, { font: RESVG_FONT }).toString())
}

/** Vector PDF with a single page sized to the visual. */
export function svgToPdf(svg: string, options: { title: string }): Promise<Buffer> {
  const { width, height } = readViewBox(svg) ?? { width: 1200, height: 800 }
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, height], margin: 0, info: { Title: options.title, Creator: 'VisualStruct' } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    SVGtoPDF(doc, flattenSvg(svg), 0, 0, { width, height, preserveAspectRatio: 'xMidYMid meet', assumePt: true })
    doc.end()
  })
}
