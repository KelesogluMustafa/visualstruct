import type { Edge, Node, NormalizedSpec, ThemeName } from '../types.js'
import { parseFlow, type VisualSpecInput } from './schema.js'

export const DEFAULT_THEME: ThemeName = 'technical-light'

export function normalize(input: VisualSpecInput, overrides: { theme?: ThemeName } = {}): NormalizedSpec {
  const warnings: string[] = []

  const nodes = new Map<string, Node>()
  for (const [id, value] of Object.entries(input.nodes ?? {})) {
    nodes.set(id, typeof value === 'string' ? { id, label: value } : { id, ...value, label: value.label ?? id })
  }

  const edges: Edge[] = []
  for (const entry of input.flow ?? []) {
    const { ids, label } = parseFlow(entry)
    for (const id of ids) {
      if (nodes.has(id)) continue
      nodes.set(id, { id, label: id })
      warnings.push(`flow references undeclared node "${id}"; created it with a default label`)
    }
    ids.slice(1).forEach((to, i) => edges.push({ from: ids[i]!, to, ...(label ? { label } : {}) }))
  }

  return {
    v: 1,
    type: input.type,
    title: input.title,
    subtitle: input.subtitle,
    footer: input.footer,
    theme: overrides.theme ?? input.theme ?? DEFAULT_THEME,
    responsive: input.responsive ?? true,
    direction: input.direction ?? 'right',
    nodes: [...nodes.values()],
    groups: Object.entries(input.groups ?? {}).map(([id, value]) =>
      typeof value === 'string' ? { id, label: value } : { id, ...value, label: value.label ?? id },
    ),
    edges,
    stats: (input.stats ?? []).map((stat) => ({ ...stat, value: String(stat.value) })),
    sections: (input.sections ?? []).map((section) => ({
      title: section.title,
      icon: section.icon,
      text: section.text,
      items: (section.items ?? []).map((item) =>
        typeof item === 'string'
          ? { label: item }
          : { label: item.label, icon: item.icon, value: item.value === undefined ? undefined : String(item.value) },
      ),
      tags: section.tags ?? [],
    })),
    cols: input.cols,
    columns: (input.columns ?? []).map((column) =>
      typeof column === 'string'
        ? { title: column, highlight: false }
        : { title: column.title, icon: column.icon, highlight: column.highlight ?? false },
    ),
    rows: (input.rows ?? []).map((row) => {
      const [label, values] = Array.isArray(row) ? [row[0], row.slice(1)] : [row.label, row.values]
      return { label, values: values.map((value) => (typeof value === 'number' ? String(value) : value)) }
    }),
    output: {
      formats: [...new Set(input.output?.formats ?? (['svg', 'png', 'html'] as const))],
      dir: input.output?.dir,
      name: input.output?.name,
    },
    warnings,
  }
}
