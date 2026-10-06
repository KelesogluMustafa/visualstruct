/**
 * Deterministic text metrics. Layout must not depend on which fonts the host has,
 * so widths are estimated from character classes instead of measured.
 */
const NARROW = new Set("iljtfrI.,:;'|!()[] ")
const WIDE = new Set('mwMW@%')

export function textWidth(text: string, size: number, weight = 400): number {
  let units = 0
  for (const char of text) {
    if (NARROW.has(char)) units += 0.32
    else if (WIDE.has(char)) units += 0.88
    else if (char >= 'A' && char <= 'Z') units += 0.66
    else units += 0.55
  }
  return units * size * (weight >= 600 ? 1.05 : 1)
}

export function lineHeight(size: number): number {
  return Math.round(size * 1.4)
}

export function wrapText(text: string, maxWidth: number, size: number, weight = 400): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (current && textWidth(candidate, size, weight) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}
