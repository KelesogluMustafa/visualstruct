import { ICON_PATTERN } from '../core/schema.js'

export type IconNode = [tag: string, attrs: Record<string, string>, children?: IconNode[]]

export interface IconData {
  name: string
  node: IconNode[]
}

export type IconMap = ReadonlyMap<string, IconData>

/** Lucide's native grid; icons are scaled from this size. */
export const ICON_GRID = 24

const cache = new Map<string, IconData | null>()

async function loadIcon(name: string): Promise<IconData | null> {
  if (!ICON_PATTERN.test(name)) return null
  if (!cache.has(name)) {
    const data = await import(`@lucide/icons/icons/${name}`).then(
      (module) => ({ name, node: module.default.node as IconNode[] }),
      () => null,
    )
    cache.set(name, data)
  }
  return cache.get(name) ?? null
}

export async function resolveIcons(names: Iterable<string>): Promise<{ icons: IconMap; missing: string[] }> {
  const icons = new Map<string, IconData>()
  const missing: string[] = []
  for (const name of new Set(names)) {
    const data = await loadIcon(name)
    if (data) icons.set(name, data)
    else missing.push(name)
  }
  return { icons, missing }
}

function nodeToSvg([tag, attrs, children]: IconNode): string {
  const attributes = Object.entries(attrs)
    .filter(([key]) => key !== 'key')
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('')
  return `<${tag}${attributes}>${(children ?? []).map(nodeToSvg).join('')}</${tag}>`
}

/** Standalone icon document, for engines that take icons as files (D2). */
export function iconToSvg(icon: IconData, color: string, size: number = ICON_GRID): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}" ` +
    `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `${icon.node.map(nodeToSvg).join('')}</svg>`
  )
}
