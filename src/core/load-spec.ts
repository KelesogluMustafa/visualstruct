import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { VisualStructError } from '../types.js'

/** Parses VisualSpec text. YAML is a superset of JSON, so only ".json" is parsed strictly as JSON. */
export function parseSpec(source: string, format: 'yaml' | 'json' = 'yaml'): unknown {
  try {
    return format === 'json' ? JSON.parse(source) : parseYaml(source)
  } catch (error) {
    throw new VisualStructError('SPEC_PARSE', `Could not parse ${format.toUpperCase()} spec`, [(error as Error).message])
  }
}

export async function loadSpec(path: string): Promise<unknown> {
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch {
    throw new VisualStructError('SPEC_NOT_FOUND', `Spec file not found: ${path}`)
  }
  return parseSpec(source, extname(path).toLowerCase() === '.json' ? 'json' : 'yaml')
}
