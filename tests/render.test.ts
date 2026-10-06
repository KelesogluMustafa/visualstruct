import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prepareSpec, renderFile, renderSpec } from '../src/core/render.js'
import { readViewBox } from '../src/design/responsive.js'
import { themes } from '../src/design/themes.js'
import { findD2, toD2 } from '../src/engines/d2.js'
import { renderWithSvgJs } from '../src/engines/svgjs.js'
import { resolveIcons } from '../src/icons/lucide.js'
import { optimizeSvg } from '../src/outputs/optimize-svg.js'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const theme = themes['technical-light']

let outDir: string
beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'visualstruct-test-'))
})
afterAll(async () => {
  await rm(outDir, { recursive: true, force: true })
})

describe('SVG.js engine', () => {
  const spec = prepareSpec({
    v: 1,
    type: 'infographic',
    title: 'Demo',
    sections: [{ title: 'Storage', icon: 'database', items: ['One', { label: 'Two', value: 2 }] }],
  })

  it('renders a card layout with a resolved Lucide icon', async () => {
    const { icons, missing } = await resolveIcons(['database', 'not-a-real-icon'])
    expect(missing).toEqual(['not-a-real-icon'])
    const raw = renderWithSvgJs(spec, theme, icons)
    expect(raw).toMatch(/^<svg\b/)
    expect(raw).toContain('<ellipse') // the database icon body
    expect(raw).toContain('>Storage</text>')
    expect(readViewBox(raw)).toMatchObject({ x: 0, y: 0, width: 1200 })
  })

  it('is deterministic and SVGO makes the output smaller without losing the viewBox', async () => {
    const { icons } = await resolveIcons(['database'])
    const raw = renderWithSvgJs(spec, theme, icons)
    expect(renderWithSvgJs(spec, theme, icons)).toBe(raw)
    const optimized = optimizeSvg(raw, 'svgjs')
    expect(optimized.length).toBeLessThan(raw.length)
    expect(readViewBox(optimized)).toEqual(readViewBox(raw))
    expect(optimized).toContain('Storage')
  })
})

describe('render pipeline', () => {
  it('writes SVG, PNG and HTML for the infographic example', async () => {
    const result = await renderFile('examples/infographic.yaml', { outDir })
    expect(result.engine).toBe('svgjs')
    expect(result.warnings).toEqual([])
    expect(result.files).toEqual(['svg', 'png', 'html'].map((ext) => join(outDir, `infographic.${ext}`)))

    const svg = await readFile(join(outDir, 'infographic.svg'), 'utf8')
    expect(readViewBox(svg)).not.toBeNull()

    const png = await readFile(join(outDir, 'infographic.png'))
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE)
    expect(png.readUInt32BE(16)).toBe(2400) // IHDR width: 1200 at 2x

    const html = await readFile(join(outDir, 'infographic.html'), 'utf8')
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<title>VisualStruct</title>')
    expect(html).toContain(svg)
    expect(html).toContain('overflow: auto')
    expect(html).not.toMatch(/(src|href)="https?:/) // standalone: no CDN or remote assets
  })

  it('renders the comparison example and honours format and theme options', async () => {
    const result = await renderFile('examples/comparison.yaml', { outDir, formats: ['svg'], theme: 'technical-dark' })
    expect(result.files).toEqual([join(outDir, 'comparison.svg')])
    const svg = await readFile(result.files[0]!, 'utf8')
    expect(svg).toContain(themes['technical-dark'].colors.bg)
    expect(svg).toContain('clip-path')
  })

  it('rejects an invalid spec before writing anything', async () => {
    await expect(renderSpec({ v: 1, type: 'infographic', title: 'T' }, { outDir, name: 'bad' })).rejects.toMatchObject({
      code: 'SPEC_INVALID',
    })
    await expect(readFile(join(outDir, 'bad.svg'))).rejects.toThrow()
  })
})

describe('D2 engine', () => {
  const spec = prepareSpec({
    v: 1,
    type: 'architecture',
    title: 'Shop "v2"',
    groups: { backend: 'Backend' },
    nodes: { web: { label: 'Web', tech: 'Vite', icon: 'monitor' }, api: { label: 'API', group: 'backend' } },
    flow: ['web>api: calls'],
  })

  it('generates D2 source internally from the spec', () => {
    const source = toD2(spec, theme, new Map([['monitor', 'icon-monitor.svg']]))
    expect(source).toContain('direction: right')
    expect(source).toContain('n_web: "Web\\nVite" { class: node; icon: "./icon-monitor.svg" }')
    expect(source).toContain('g_backend: "Backend" {')
    expect(source).toContain('n_web -> g_backend.n_api: "calls" { class: edge }')
    expect(source).toContain('vs_title: "Shop \\"v2\\""')
  })

  it.skipIf(!findD2())('renders the architecture example through the D2 CLI', async () => {
    const result = await renderFile('examples/architecture.yaml', { outDir })
    expect(result.engine).toBe('d2')
    expect(result.files).toHaveLength(3)
    const svg = await readFile(join(outDir, 'architecture.svg'), 'utf8')
    expect(readViewBox(svg)).not.toBeNull()
    expect(svg).toContain('SaveFold')
    expect((await readFile(join(outDir, 'architecture.png'))).subarray(0, 8)).toEqual(PNG_SIGNATURE)
  })

  it.skipIf(Boolean(findD2()))('fails cleanly when D2 is not installed', async () => {
    await expect(renderFile('examples/architecture.yaml', { outDir })).rejects.toMatchObject({ code: 'D2_MISSING' })
  })
})
