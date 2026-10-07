import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, PageOrientation, Paragraph } from 'docx'

// A4 at 96 px/in with 0.75 in margins. The heading block is reserved so the visual stays on page one.
const PX_PER_INCH = 96
const PAGE = { short: 8.27, long: 11.69, margin: 0.75, heading: 1.1 }

/**
 * Title, optional subtitle and the visual as a PNG scaled to fit one A4 page.
 * Wide visuals get a landscape page so they are not shrunk more than necessary.
 */
export function pngToDocx(
  png: Buffer,
  options: { title: string; subtitle?: string; width: number; height: number },
): Promise<Buffer> {
  const landscape = options.width > options.height
  const pageW = landscape ? PAGE.long : PAGE.short
  const pageH = landscape ? PAGE.short : PAGE.long
  const maxW = (pageW - 2 * PAGE.margin) * PX_PER_INCH
  const maxH = (pageH - 2 * PAGE.margin - PAGE.heading) * PX_PER_INCH
  const scale = Math.min(maxW / options.width, maxH / options.height, 1)
  const margin = PAGE.margin * 1440 // twips

  const document = new Document({
    title: options.title,
    creator: 'VisualStruct',
    sections: [
      {
        properties: {
          page: {
            size: { orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: margin, right: margin, bottom: margin, left: margin },
          },
        },
        children: [
          new Paragraph({ text: options.title, heading: HeadingLevel.HEADING_1 }),
          ...(options.subtitle ? [new Paragraph({ text: options.subtitle })] : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [
              new ImageRun({
                type: 'png',
                data: png,
                transformation: { width: Math.round(options.width * scale), height: Math.round(options.height * scale) },
                altText: { name: options.title, title: options.title, description: options.title },
              }),
            ],
          }),
        ],
      },
    ],
  })
  return Packer.toBuffer(document)
}
