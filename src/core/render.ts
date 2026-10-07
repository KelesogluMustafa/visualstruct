import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { ensureViewBox, readViewBox } from '../design/responsive.js'
import { themes } from '../design/themes.js'
import { renderWithD2 } from '../engines/d2.js'
import { renderWithSvgJs } from '../engines/svgjs.js'
import { resolveIcons } from '../icons/lucide.js'
import { pngToDocx } from '../outputs/docx.js'
import { svgToHtml } from '../outputs/html.js'
import { optimizeSvg } from '../outputs/optimize-svg.js'
import { svgToPdf } from '../outputs/pdf.js'
import { svgToPng } from '../outputs/png.js'
import { pngToPptx } from '../outputs/pptx.js'
import { basicQa } from '../qa/basic.js'
import { VisualStructError, type Format, type NormalizedSpec, type RenderResult, type ThemeName } from '../types.js'
import { loadSpec } from './load-spec.js'
import { normalize } from './normalize.js'
import { routeEngine } from './router.js'
import { validateSpec } from './schema.js'

export interface RenderOptions {
  formats?: Format[]
  outDir?: string
  theme?: ThemeName
  name?: string
}

export function prepareSpec(input: unknown, overrides: { theme?: ThemeName } = {}): NormalizedSpec {
  return normalize(validateSpec(input), overrides)
}

function iconNames(spec: NormalizedSpec): string[] {
  const names = [
    ...spec.nodes.map((node) => node.icon),
    ...spec.groups.map((group) => group.icon),
    ...spec.stats.map((stat) => stat.icon),
    ...spec.sections.flatMap((section) => [section.icon, ...section.items.map((item) => item.icon)]),
    ...spec.columns.map((column) => column.icon),
  ]
  if (spec.rows.some((row) => row.values.some((value) => typeof value === 'boolean'))) names.push('check', 'x')
  return names.filter((name): name is string => Boolean(name))
}

/** VisualSpec in, files out. Returns paths and warnings only; never the SVG itself. */
export async function renderSpec(input: unknown, options: RenderOptions = {}): Promise<RenderResult> {
  const spec = prepareSpec(input, { theme: options.theme })
  const theme = themes[spec.theme]
  const engine = routeEngine(spec.type)
  const warnings = [...spec.warnings]

  const { icons, missing } = await resolveIcons(iconNames(spec))
  warnings.push(...missing.map((name) => `unknown Lucide icon "${name}"; rendered without it`))

  const raw = engine === 'd2' ? await renderWithD2(spec, theme, icons) : renderWithSvgJs(spec, theme, icons)
  const svg = ensureViewBox(optimizeSvg(raw, engine))

  const qa = basicQa(svg)
  if (qa.errors.length) throw new VisualStructError('QA_FAILED', 'Rendered SVG failed basic QA', qa.errors)
  warnings.push(...qa.warnings)

  const outDir = resolve(options.outDir ?? spec.output.dir ?? 'output')
  const name = options.name ?? spec.output.name ?? 'visual'
  // Every exporter works from the same master SVG; the PNG is rasterized at most once.
  const size = readViewBox(svg) ?? { width: 1200, height: 800 }
  let png: Buffer | undefined
  const getPng = () => (png ??= svgToPng(svg))
  const produce: Record<Format, () => string | Buffer | Promise<Buffer>> = {
    svg: () => svg,
    png: getPng,
    html: () => svgToHtml(svg, { title: spec.title, theme, responsive: spec.responsive }),
    pdf: () => svgToPdf(svg, { title: spec.title }),
    pptx: () => pngToPptx(getPng(), { title: spec.title, ...size, background: theme.colors.bg }),
    docx: () => pngToDocx(getPng(), { title: spec.title, subtitle: spec.subtitle, ...size }),
  }

  await mkdir(outDir, { recursive: true })
  const files: string[] = []
  for (const format of new Set(options.formats ?? spec.output.formats)) {
    const file = join(outDir, `${name}.${format}`)
    await writeFile(file, await produce[format]())
    files.push(file)
  }
  return { ok: true, engine, files, warnings }
}

export async function renderFile(specPath: string, options: RenderOptions = {}): Promise<RenderResult> {
  const input = await loadSpec(specPath)
  const fileName = basename(specPath, extname(specPath))
  // A name set in the spec wins over the file name; an explicit option wins over both.
  const specName = (input as { output?: { name?: unknown } } | null)?.output?.name
  return renderSpec(input, { ...options, name: options.name ?? (typeof specName === 'string' ? specName : fileName) })
}
