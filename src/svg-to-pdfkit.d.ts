declare module 'svg-to-pdfkit' {
  interface Options {
    width?: number
    height?: number
    preserveAspectRatio?: string
    assumePt?: boolean
  }
  export default function SVGtoPDF(doc: PDFKit.PDFDocument, svg: string, x?: number, y?: number, options?: Options): void
}
