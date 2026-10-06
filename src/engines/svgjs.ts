import { registerWindow, SVG, type Container, type Dom, type Svg } from '@svgdotjs/svg.js'
import { createSVGWindow } from 'svgdom'
import type { Theme } from '../design/themes.js'
import { tokens as T } from '../design/tokens.js'
import { lineHeight, textWidth, wrapText } from '../design/typography.js'
import { ICON_GRID, type IconData, type IconMap, type IconNode } from '../icons/lucide.js'
import type { NormalizedSpec, Section, Stat } from '../types.js'

interface Ctx {
  draw: Svg
  theme: Theme
  icons: IconMap
}

interface TextStyle {
  size: number
  fill: string
  weight?: number
  anchor?: 'start' | 'middle' | 'end'
}

const round = (value: number) => Math.round(value * 100) / 100

/** Draws wrapped lines starting at `top`; returns the height they occupy. */
function drawLines(parent: Container, lines: string[], x: number, top: number, style: TextStyle): number {
  const lh = lineHeight(style.size)
  lines.forEach((line, i) => {
    parent
      .element('text')
      .attr({
        x: round(x),
        y: round(top + i * lh + (lh + style.size * 0.7) / 2),
        'font-size': style.size,
        'font-weight': style.weight ?? 400,
        'text-anchor': style.anchor ?? 'start',
        fill: style.fill,
      })
      .words(line)
  })
  return lines.length * lh
}

function addIconNodes(parent: Dom, nodes: IconNode[]): void {
  for (const [tag, { key: _key, ...attrs }, children] of nodes) {
    const element = parent.element(tag).attr(attrs)
    if (children) addIconNodes(element, children)
  }
}

function drawIcon(parent: Container, icon: IconData, x: number, y: number, size: number, color: string): void {
  const group = parent.group().attr({
    transform: `translate(${round(x)} ${round(y)}) scale(${round(size / ICON_GRID)})`,
    fill: 'none',
    stroke: color,
    'stroke-width': T.stroke.icon,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })
  addIconNodes(group, icon.node)
}

function drawSurface(c: Ctx, x: number, y: number, w: number, h: number): void {
  const { colors } = c.theme
  c.draw
    .rect(round(w), round(h))
    .radius(T.radius.md)
    .move(round(x), round(y))
    .fill(colors.surface)
    .stroke({ color: colors.border, width: T.stroke.base })
}

function drawHeader(c: Ctx, spec: NormalizedSpec, x: number, y: number, w: number): number {
  const { colors } = c.theme
  c.draw.rect(56, 6).radius(3).move(x, y).fill(colors.accent)
  y += 6 + T.space.md
  y += drawLines(c.draw, wrapText(spec.title, w, T.size.title, 700), x, y, {
    size: T.size.title,
    weight: 700,
    fill: colors.text,
  })
  if (spec.subtitle) {
    y += T.space.xs
    y += drawLines(c.draw, wrapText(spec.subtitle, w, T.size.subtitle), x, y, {
      size: T.size.subtitle,
      fill: colors.muted,
    })
  }
  return y + T.space.lg
}

function drawStats(c: Ctx, stats: Stat[], x: number, y: number, w: number): number {
  const { colors } = c.theme
  const perRow = Math.min(stats.length, 4)
  const gap = T.space.md
  const pad = 20
  const tileW = (w - gap * (perRow - 1)) / perRow
  const tileH = 104
  stats.forEach((stat, i) => {
    const tx = x + (i % perRow) * (tileW + gap)
    const ty = y + Math.floor(i / perRow) * (tileH + gap)
    drawSurface(c, tx, ty, tileW, tileH)
    drawLines(c.draw, [stat.value], tx + pad, ty + pad - 4, { size: T.size.stat, weight: 700, fill: colors.text })
    drawLines(c.draw, [stat.label], tx + pad, ty + tileH - pad - lineHeight(T.size.small), {
      size: T.size.small,
      fill: colors.muted,
    })
    const icon = stat.icon && c.icons.get(stat.icon)
    if (icon) drawIcon(c.draw, icon, tx + tileW - pad - T.icon.lg, ty + pad, T.icon.lg, colors.accent)
  })
  const rowCount = Math.ceil(stats.length / perRow)
  return y + rowCount * tileH + (rowCount - 1) * gap + T.space.lg
}

const CARD_PAD = 24
const CHIP = 40
const MARKER = 26
const ITEM_GAP = 8
const TAG_H = 28

interface CardLayout {
  hasChip: boolean
  title: string[]
  headH: number
  text: string[]
  items: { lines: string[]; value?: string }[]
  tagRows: { label: string; width: number }[][]
  height: number
}

function layoutCard(section: Section, w: number, hasChip: boolean): CardLayout {
  const inner = w - 2 * CARD_PAD
  const title = wrapText(section.title, inner - (hasChip ? CHIP + 12 : 0), T.size.heading, 700)
  const headH = Math.max(hasChip ? CHIP : 0, title.length * lineHeight(T.size.heading))
  const text = section.text ? wrapText(section.text, inner, T.size.body) : []
  const items = section.items.map((item) => {
    const valueW = item.value ? textWidth(item.value, T.size.body, 600) + T.space.md : 0
    return { lines: wrapText(item.label, inner - MARKER - valueW, T.size.body), value: item.value }
  })

  const tagRows: CardLayout['tagRows'] = []
  let rowW = 0
  for (const label of section.tags) {
    const width = textWidth(label, T.size.small, 600) + 22
    if (!tagRows.length || rowW + width > inner) {
      tagRows.push([])
      rowW = 0
    }
    tagRows.at(-1)!.push({ label, width })
    rowW += width + T.space.sm
  }

  const bodyLh = lineHeight(T.size.body)
  let height = CARD_PAD + headH
  if (text.length) height += 12 + text.length * bodyLh
  if (items.length) {
    height += T.space.md + items.reduce((sum, item) => sum + item.lines.length * bodyLh, 0) + (items.length - 1) * ITEM_GAP
  }
  if (tagRows.length) height += T.space.md + tagRows.length * TAG_H + (tagRows.length - 1) * T.space.sm
  return { hasChip, title, headH, text, items, tagRows, height: height + CARD_PAD }
}

function drawCard(c: Ctx, section: Section, layout: CardLayout, index: number, x: number, y: number, w: number, h: number): void {
  const { colors } = c.theme
  const bodyLh = lineHeight(T.size.body)
  const left = x + CARD_PAD
  const right = x + w - CARD_PAD
  drawSurface(c, x, y, w, h)

  let cy = y + CARD_PAD
  let titleX = left
  if (layout.hasChip) {
    c.draw.rect(CHIP, CHIP).radius(10).move(round(left), round(cy)).fill(colors.accentSoft)
    const icon = section.icon && c.icons.get(section.icon)
    if (icon) {
      drawIcon(c.draw, icon, left + (CHIP - T.icon.md) / 2, cy + (CHIP - T.icon.md) / 2, T.icon.md, colors.accent)
    } else {
      drawLines(c.draw, [String(index + 1)], left + CHIP / 2, cy + (CHIP - lineHeight(T.size.heading)) / 2, {
        size: T.size.heading,
        weight: 700,
        fill: colors.accent,
        anchor: 'middle',
      })
    }
    titleX += CHIP + 12
  }
  const titleH = layout.title.length * lineHeight(T.size.heading)
  drawLines(c.draw, layout.title, titleX, cy + (layout.headH - titleH) / 2, {
    size: T.size.heading,
    weight: 700,
    fill: colors.text,
  })
  cy += layout.headH

  if (layout.text.length) {
    cy += 12
    cy += drawLines(c.draw, layout.text, left, cy, { size: T.size.body, fill: colors.muted })
  }

  if (layout.items.length) {
    cy += T.space.md
    layout.items.forEach((item, i) => {
      const icon = section.items[i]?.icon
      const iconData = icon && c.icons.get(icon)
      if (iconData) drawIcon(c.draw, iconData, left, cy + (bodyLh - T.icon.sm) / 2, T.icon.sm, colors.accent)
      else c.draw.circle(6).center(round(left + T.icon.sm / 2), round(cy + bodyLh / 2)).fill(colors.accent)
      drawLines(c.draw, item.lines, left + MARKER, cy, { size: T.size.body, fill: colors.text })
      if (item.value) {
        drawLines(c.draw, [item.value], right, cy, { size: T.size.body, weight: 600, fill: colors.text, anchor: 'end' })
      }
      cy += item.lines.length * bodyLh + ITEM_GAP
    })
    cy -= ITEM_GAP
  }

  if (layout.tagRows.length) {
    cy += T.space.md
    for (const row of layout.tagRows) {
      let tx = left
      for (const tag of row) {
        c.draw.rect(round(tag.width), TAG_H).radius(TAG_H / 2).move(round(tx), round(cy)).fill(colors.surfaceAlt)
        drawLines(c.draw, [tag.label], tx + tag.width / 2, cy + (TAG_H - lineHeight(T.size.small)) / 2, {
          size: T.size.small,
          weight: 600,
          fill: colors.muted,
          anchor: 'middle',
        })
        tx += tag.width + T.space.sm
      }
      cy += TAG_H + T.space.sm
    }
  }
}

function drawCards(c: Ctx, spec: NormalizedSpec, x: number, y: number, w: number): number {
  const numbered = spec.type === 'timeline' || spec.type === 'roadmap'
  const count = spec.sections.length
  const cols = spec.cols ?? (numbered ? Math.min(count, 4) : count === 1 ? 1 : count === 2 || count === 4 ? 2 : 3)
  const gap = T.space.md
  const cardW = (w - gap * (cols - 1)) / cols
  const layouts = spec.sections.map((section) => layoutCard(section, cardW, numbered || Boolean(section.icon)))

  for (let start = 0; start < count; start += cols) {
    const rowH = Math.max(...layouts.slice(start, start + cols).map((layout) => layout.height))
    for (let i = start; i < Math.min(start + cols, count); i++) {
      drawCard(c, spec.sections[i]!, layouts[i]!, i, x + (i - start) * (cardW + gap), y, cardW, rowH)
    }
    y += rowH + gap
  }
  return y - gap + T.space.lg
}

function drawTable(c: Ctx, spec: NormalizedSpec, x: number, y: number, w: number): number {
  const { colors } = c.theme
  const pad = T.space.md
  const headH = 64
  const bodyLh = lineHeight(T.size.body)
  const labelW = Math.min(300, w * 0.3)
  const colW = (w - labelW) / spec.columns.length

  const rows = spec.rows.map((row) => {
    const label = wrapText(row.label, labelW - 2 * pad, T.size.body, 600)
    const cells = row.values.map((value) =>
      typeof value === 'boolean' ? value : wrapText(value, colW - 2 * pad, T.size.body),
    )
    const lines = Math.max(label.length, ...cells.map((cell) => (typeof cell === 'boolean' ? 1 : cell.length)))
    return { label, cells, height: lines * bodyLh + 2 * pad }
  })
  const totalH = headH + rows.reduce((sum, row) => sum + row.height, 0)

  const clip = c.draw.clip()
  clip.rect(round(w), round(totalH)).radius(T.radius.md).move(x, y)
  const table = c.draw.group().clipWith(clip)
  table.rect(round(w), round(totalH)).move(x, y).fill(colors.surface)
  table.rect(round(w), headH).move(x, y).fill(colors.surfaceAlt)

  spec.columns.forEach((column, i) => {
    const cx = x + labelW + i * colW
    if (column.highlight) {
      table.rect(round(colW), round(totalH)).move(round(cx), y).fill(colors.accentSoft)
      table.rect(round(colW), headH).move(round(cx), y).fill(colors.accent)
    }
    const fill = column.highlight ? colors.onAccent : colors.text
    const icon = column.icon && c.icons.get(column.icon)
    const contentW = textWidth(column.title, T.size.heading, 700) + (icon ? T.icon.md + T.space.sm : 0)
    let tx = cx + (colW - contentW) / 2
    if (icon) {
      drawIcon(table, icon, tx, y + (headH - T.icon.md) / 2, T.icon.md, fill)
      tx += T.icon.md + T.space.sm
    }
    drawLines(table, [column.title], tx, y + (headH - lineHeight(T.size.heading)) / 2, {
      size: T.size.heading,
      weight: 700,
      fill,
    })
  })

  let ry = y + headH
  for (const row of rows) {
    table.line(x, round(ry), x + w, round(ry)).stroke({ color: colors.border, width: 1 })
    drawLines(table, row.label, x + pad, ry + (row.height - row.label.length * bodyLh) / 2, {
      size: T.size.body,
      weight: 600,
      fill: colors.text,
    })
    row.cells.forEach((cell, i) => {
      const center = x + labelW + (i + 0.5) * colW
      if (typeof cell !== 'boolean') {
        drawLines(table, cell, center, ry + (row.height - cell.length * bodyLh) / 2, {
          size: T.size.body,
          fill: colors.text,
          anchor: 'middle',
        })
        return
      }
      const icon = c.icons.get(cell ? 'check' : 'x')
      const color = cell ? colors.success : colors.danger
      if (icon) drawIcon(table, icon, center - T.icon.md / 2, ry + (row.height - T.icon.md) / 2, T.icon.md, color)
    })
    ry += row.height
  }

  c.draw
    .rect(round(w), round(totalH))
    .radius(T.radius.md)
    .move(x, y)
    .fill('none')
    .stroke({ color: colors.border, width: T.stroke.base })
  return y + totalH + T.space.lg
}

/** Renders infographic-family specs. All layout is computed here; the spec carries no coordinates. */
export function renderWithSvgJs(spec: NormalizedSpec, theme: Theme, icons: IconMap): string {
  const window = createSVGWindow()
  registerWindow(window, window.document)
  const draw = SVG(window.document.documentElement) as Svg
  const c: Ctx = { draw, theme, icons }

  const width = T.canvas.width
  const x = T.space.page
  const inner = width - 2 * x

  let y = drawHeader(c, spec, x, T.space.page, inner)
  if (spec.stats.length) y = drawStats(c, spec.stats, x, y, inner)
  if (spec.type === 'comparison') y = drawTable(c, spec, x, y, inner)
  else if (spec.sections.length) y = drawCards(c, spec, x, y, inner)
  if (spec.footer) {
    y += drawLines(draw, wrapText(spec.footer, inner, T.size.small), x, y, { size: T.size.small, fill: theme.colors.muted })
    y += T.space.lg
  }

  const height = Math.ceil(y - T.space.lg + T.space.page)
  draw.size(width, height).viewbox(0, 0, width, height).attr('font-family', T.fontFamily)
  draw.rect(width, height).fill(theme.colors.bg).back()
  return draw.svg()
}
