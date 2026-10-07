import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderFile } from '../src/core/render.js'
import { findD2 } from '../src/engines/d2.js'
import { visualRender } from '../src/mcp.js'
import { FORMATS } from '../src/types.js'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const EXAMPLES = ['infographic', 'comparison', ...(findD2() ? ['architecture'] : [])]

let outDir: string
beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'visualstruct-export-'))
  for (const name of EXAMPLES) {
    await renderFile(`examples/${name}.yaml`, { outDir, formats: ['pdf', 'pptx', 'docx'] })
  }
}, 60_000)
afterAll(async () => {
  await rm(outDir, { recursive: true, force: true })
})

const openZip = async (file: string) => JSZip.loadAsync(await readFile(join(outDir, file)))
const text = (zip: JSZip, path: string) => zip.file(path)!.async('string')

describe.each(EXAMPLES)('%s exports', (name) => {
  it('writes a single-page vector PDF', async () => {
    const pdf = await readFile(join(outDir, `${name}.pdf`))
    const body = pdf.toString('latin1')
    expect(body.startsWith('%PDF-')).toBe(true)
    expect(body.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(body.match(/\/Type \/Page\b/g)).toHaveLength(1)
    expect(body).not.toContain('/Subtype /Image') // vector content, no rasterized fallback
    expect(pdf.length).toBeGreaterThan(5_000)
    expect(pdf.length).toBeLessThan(2_000_000)
  })

  it('writes a PPTX with one slide holding the visual', async () => {
    const zip = await openZip(`${name}.pptx`)
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
    expect(zip.file('ppt/presentation.xml')).not.toBeNull()
    expect(zip.file(/^ppt\/slides\/slide\d+\.xml$/)).toHaveLength(1)

    expect(await text(zip, 'ppt/presentation.xml')).toContain('cx="12192000" cy="6858000"') // 16:9
    const rels = await text(zip, 'ppt/slides/_rels/slide1.xml.rels')
    const target = /Type="[^"]*\/image" Target="\.\.\/media\/([^"]+)"/.exec(rels)?.[1]
    expect(target).toMatch(/\.png$/)
    const media = await zip.file(`ppt/media/${target}`)!.async('nodebuffer')
    expect(media.subarray(0, 4)).toEqual(PNG_SIGNATURE)
    expect(await text(zip, 'ppt/slides/slide1.xml')).toContain('<p:pic>')
  })

  it('writes a DOCX with a heading and the visual', async () => {
    const zip = await openZip(`${name}.docx`)
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
    const document = await text(zip, 'word/document.xml')
    expect(document).toContain('w:val="Heading1"')
    expect(document).toContain('<w:drawing>')
    expect(document).toContain('w:orient="landscape"') // every example is wider than tall

    const media = zip.file(/^word\/media\/.+\.png$/)
    expect(media).toHaveLength(1)
    expect((await media[0]!.async('nodebuffer')).subarray(0, 4)).toEqual(PNG_SIGNATURE)
    expect(await text(zip, 'word/_rels/document.xml.rels')).toMatch(/Type="[^"]*\/image"/)
  })
})

describe('format selection', () => {
  it('keeps SVG, PNG and HTML as the default set', async () => {
    const result = await renderFile('examples/comparison.yaml', { outDir, name: 'defaults' })
    expect(result.files.map((file) => file.split('.').pop())).toEqual(['svg', 'png', 'html'])
  })

  it('renders every format through the MCP tool and still returns paths only', async () => {
    const result = await visualRender({ spec_path: 'examples/infographic.yaml', out_dir: outDir, name: 'mcp', formats: [...FORMATS] })
    expect(result).toMatchObject({ ok: true, engine: 'svgjs', warnings: [] })
    expect((result as { files: string[] }).files.map((file) => file.split('.').pop())).toEqual([...FORMATS])
    expect(JSON.stringify(result).length).toBeLessThan(900)
    expect(JSON.stringify(result)).not.toMatch(/<svg|<html|base64/i)
  })
})
