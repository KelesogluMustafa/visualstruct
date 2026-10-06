import { execFile, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Theme } from '../design/themes.js'
import { tokens } from '../design/tokens.js'
import { iconToSvg, type IconMap } from '../icons/lucide.js'
import { VisualStructError, type NormalizedSpec } from '../types.js'

const execFileAsync = promisify(execFile)

export const D2_INSTALL_HINT = 'Install D2 with: winget install Terrastruct.D2 (then open a new terminal)'

export interface D2Info {
  path: string
  version: string
}

let detected: D2Info | null | undefined

/** Locates the D2 executable: VISUALSTRUCT_D2, then PATH, then the default Windows install dir. */
export function findD2(): D2Info | null {
  if (detected !== undefined) return detected
  const candidates = [process.env.VISUALSTRUCT_D2, 'd2']
  if (process.platform === 'win32') {
    candidates.push(join(process.env.ProgramFiles ?? 'C:\\Program Files', 'D2', 'd2.exe'))
  }
  for (const candidate of candidates) {
    if (!candidate) continue
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true })
    if (result.status === 0) return (detected = { path: candidate, version: result.stdout.trim() })
  }
  return (detected = null)
}

const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`

// Spec ids are prefixed so they can never collide with D2 keywords such as "label" or "link".
const nodeKey = (id: string) => `n_${id}`
const groupKey = (id: string) => `g_${id}`

/** Builds the internal D2 source for a spec. `iconFiles` maps icon names to files next to the .d2 file. */
export function toD2(spec: NormalizedSpec, theme: Theme, iconFiles: ReadonlyMap<string, string> = new Map()): string {
  const { colors } = theme
  const sequence = spec.type === 'sequence'
  const groupIds = new Set(sequence ? [] : spec.groups.map((group) => group.id))
  const iconProp = (icon?: string) => {
    const file = icon && iconFiles.get(icon)
    return file ? [`icon: ${quote(`./${file}`)}`] : []
  }
  const nodePath = new Map(
    spec.nodes.map((node) => [
      node.id,
      node.group && groupIds.has(node.group) ? `${groupKey(node.group)}.${nodeKey(node.id)}` : nodeKey(node.id),
    ]),
  )
  const nodeLine = (node: NormalizedSpec['nodes'][number], indent = '') => {
    const label = node.tech ? `${node.label}\n${node.tech}` : node.label
    return `${indent}${nodeKey(node.id)}: ${quote(label)} { ${['class: node', ...iconProp(node.icon)].join('; ')} }`
  }

  const lines = [
    sequence ? 'shape: sequence_diagram' : `direction: ${spec.direction}`,
    `style.fill: ${quote(colors.bg)}`,
    'classes: {',
    `  node: { style: { fill: ${quote(colors.surface)}; stroke: ${quote(colors.border)}; font-color: ${quote(colors.text)}; border-radius: 8; stroke-width: 2 } }`,
    `  group: { style: { fill: ${quote(colors.surfaceAlt)}; stroke: ${quote(colors.border)}; font-color: ${quote(colors.muted)}; border-radius: 12 } }`,
    `  edge: { style: { stroke: ${quote(colors.muted)}; font-color: ${quote(colors.muted)} } }`,
    '}',
  ]
  if (!sequence) {
    lines.push(
      `vs_title: ${quote(spec.title)} { near: top-center; shape: text; style: { font-size: 28; bold: true; font-color: ${quote(colors.text)} } }`,
    )
  }

  for (const group of spec.groups) {
    if (!groupIds.has(group.id)) continue
    lines.push(`${groupKey(group.id)}: ${quote(group.label)} {`)
    lines.push(...['class: group', ...iconProp(group.icon)].map((prop) => `  ${prop}`))
    lines.push(...spec.nodes.filter((node) => node.group === group.id).map((node) => nodeLine(node, '  ')))
    lines.push('}')
  }
  lines.push(...spec.nodes.filter((node) => !node.group || !groupIds.has(node.group)).map((node) => nodeLine(node)))

  for (const edge of spec.edges) {
    const label = edge.label ? `: ${quote(edge.label)}` : ''
    lines.push(`${nodePath.get(edge.from)} -> ${nodePath.get(edge.to)}${label} { class: edge }`)
  }
  return `${lines.join('\n')}\n`
}

export async function renderWithD2(spec: NormalizedSpec, theme: Theme, icons: IconMap): Promise<string> {
  const d2 = findD2()
  if (!d2) {
    throw new VisualStructError('D2_MISSING', `D2 is required for type "${spec.type}" but was not found`, [D2_INSTALL_HINT])
  }

  const dir = await mkdtemp(join(tmpdir(), 'visualstruct-'))
  try {
    const iconFiles = new Map<string, string>()
    for (const [name, icon] of icons) {
      const file = `icon-${name}.svg`
      await writeFile(join(dir, file), iconToSvg(icon, theme.colors.accent, 48))
      iconFiles.set(name, file)
    }
    await writeFile(join(dir, 'diagram.d2'), toD2(spec, theme, iconFiles))
    const args = ['--theme', String(theme.d2Theme), '--pad', String(tokens.space.page), 'diagram.d2', 'diagram.svg']
    await execFileAsync(d2.path, args, { cwd: dir, timeout: 60_000, windowsHide: true })
    return await readFile(join(dir, 'diagram.svg'), 'utf8')
  } catch (error) {
    const { stderr, message } = error as { stderr?: string; message: string }
    throw new VisualStructError('D2_FAILED', 'D2 could not render the diagram', [stderr?.trim() || message])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
