export const D2_TYPES = ['architecture', 'flow', 'system-map', 'data-flow', 'sequence'] as const
export const SVGJS_TYPES = ['infographic', 'project-overview', 'stack', 'comparison', 'timeline', 'roadmap'] as const
export const VISUAL_TYPES = [...D2_TYPES, ...SVGJS_TYPES] as const
export const FORMATS = ['svg', 'png', 'html', 'pdf', 'pptx', 'docx'] as const
export const DEFAULT_FORMATS = ['svg', 'png', 'html'] as const satisfies readonly (typeof FORMATS)[number][]
export const THEME_NAMES = ['technical-light', 'technical-dark', 'minimal-light', 'portfolio'] as const

export type VisualType = (typeof VISUAL_TYPES)[number]
export type Format = (typeof FORMATS)[number]
export type ThemeName = (typeof THEME_NAMES)[number]
export type Engine = 'd2' | 'svgjs'

export interface Node {
  id: string
  label: string
  tech?: string
  icon?: string
  group?: string
}

export interface Group {
  id: string
  label: string
  icon?: string
}

export interface Edge {
  from: string
  to: string
  label?: string
}

export interface Stat {
  label: string
  value: string
  icon?: string
}

export interface Item {
  label: string
  value?: string
  icon?: string
}

export interface Section {
  title: string
  icon?: string
  text?: string
  items: Item[]
  tags: string[]
}

export interface Column {
  title: string
  icon?: string
  highlight: boolean
}

export interface Row {
  label: string
  values: (string | boolean)[]
}

/** Fully defaulted spec: the only shape the engines ever see. */
export interface NormalizedSpec {
  v: 1
  type: VisualType
  title: string
  subtitle?: string
  footer?: string
  theme: ThemeName
  responsive: boolean
  direction: 'right' | 'down'
  nodes: Node[]
  groups: Group[]
  edges: Edge[]
  stats: Stat[]
  sections: Section[]
  cols?: number
  columns: Column[]
  rows: Row[]
  output: { formats: Format[]; dir?: string; name?: string }
  warnings: string[]
}

export interface RenderResult {
  ok: true
  engine: Engine
  files: string[]
  warnings: string[]
}

export type ErrorCode =
  | 'SPEC_NOT_FOUND'
  | 'SPEC_PARSE'
  | 'SPEC_INVALID'
  | 'D2_MISSING'
  | 'D2_FAILED'
  | 'QA_FAILED'
  | 'USAGE'

export class VisualStructError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message)
    this.name = 'VisualStructError'
  }
}
