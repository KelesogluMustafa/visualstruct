import { z } from 'zod'
import { D2_TYPES, FORMATS, THEME_NAMES, VISUAL_TYPES, VisualStructError } from '../types.js'

export const ID_PATTERN = /^[A-Za-z][\w-]*$/
export const ICON_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const id = z.string().regex(ID_PATTERN, 'must be a semantic id like "api" or "auth-service"')
const icon = z.string().regex(ICON_PATTERN, 'must be a Lucide icon name like "database"')
const text = z.string().min(1)
const scalar = z.union([z.string(), z.number()])
const cell = z.union([z.string(), z.number(), z.boolean()])

const node = z.union([
  text,
  z.strictObject({ label: text.optional(), tech: text.optional(), icon: icon.optional(), group: id.optional() }),
])
const group = z.union([text, z.strictObject({ label: text.optional(), icon: icon.optional() })])
const stat = z.strictObject({ label: text, value: scalar, icon: icon.optional() })
const item = z.union([text, z.strictObject({ label: text, value: scalar.optional(), icon: icon.optional() })])
const section = z.strictObject({
  title: text,
  icon: icon.optional(),
  text: text.optional(),
  items: z.array(item).optional(),
  tags: z.array(text).optional(),
})
const column = z.union([text, z.strictObject({ title: text, icon: icon.optional(), highlight: z.boolean().optional() })])
const row = z.union([
  z.tuple([text]).rest(cell), // compact form: [label, value, value, ...]
  z.strictObject({ label: text, values: z.array(cell) }),
])

/** Splits one flow entry ("web>api>db: label") into its node ids and optional label. */
export function parseFlow(entry: string): { ids: string[]; label?: string } {
  const colon = entry.indexOf(':')
  const chain = colon === -1 ? entry : entry.slice(0, colon)
  const label = colon === -1 ? '' : entry.slice(colon + 1).trim()
  const ids = chain.split('>').map((part) => part.trim())
  return label ? { ids, label } : { ids }
}

export const visualSpecSchema = z
  .strictObject({
    v: z.literal(1),
    type: z.enum(VISUAL_TYPES),
    title: text,
    subtitle: text.optional(),
    footer: text.optional(),
    theme: z.enum(THEME_NAMES).optional(),
    responsive: z.boolean().optional(),
    direction: z.enum(['right', 'down']).optional(),
    nodes: z.record(id, node).optional(),
    groups: z.record(id, group).optional(),
    flow: z.array(text).optional(),
    stats: z.array(stat).optional(),
    sections: z.array(section).optional(),
    cols: z.number().int().min(1).max(4).optional(),
    columns: z.array(column).optional(),
    rows: z.array(row).optional(),
    output: z
      .strictObject({
        formats: z.array(z.enum(FORMATS)).min(1).optional(),
        dir: text.optional(),
        name: z
          .string()
          .regex(/^[\w.-]+$/, 'must be a plain file name without extension')
          .optional(),
      })
      .optional(),
  })
  .superRefine((spec, ctx) => {
    const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    spec.flow?.forEach((entry, i) => {
      const { ids } = parseFlow(entry)
      if (ids.length < 2 || ids.some((part) => !ID_PATTERN.test(part))) {
        fail(['flow', i], `"${entry}" is not a valid flow; expected "a>b" or "a>b>c: label"`)
      }
    })
    for (const [key, value] of Object.entries(spec.nodes ?? {})) {
      const groupId = typeof value === 'string' ? undefined : value.group
      if (groupId && !spec.groups?.[groupId]) fail(['nodes', key, 'group'], `unknown group "${groupId}"`)
    }

    if ((D2_TYPES as readonly string[]).includes(spec.type)) {
      if (!Object.keys(spec.nodes ?? {}).length && !spec.flow?.length) {
        fail(['nodes'], `type "${spec.type}" needs "nodes" and/or "flow"`)
      }
    } else if (spec.type === 'comparison') {
      const count = spec.columns?.length ?? 0
      if (count < 1) fail(['columns'], 'type "comparison" needs at least one column')
      if (!spec.rows?.length) fail(['rows'], 'type "comparison" needs at least one row')
      spec.rows?.forEach((r, i) => {
        const values = Array.isArray(r) ? r.length - 1 : r.values.length
        if (count && values !== count) fail(['rows', i], `has ${values} values but there are ${count} columns`)
      })
    } else if (!spec.sections?.length && !spec.stats?.length) {
      fail(['sections'], `type "${spec.type}" needs "sections" and/or "stats"`)
    }
  })

export type VisualSpecInput = z.infer<typeof visualSpecSchema>

export function validateSpec(input: unknown): VisualSpecInput {
  const result = visualSpecSchema.safeParse(input)
  if (result.success) return result.data
  const details = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  throw new VisualStructError('SPEC_INVALID', 'VisualSpec is invalid', details)
}
