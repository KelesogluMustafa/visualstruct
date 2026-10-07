#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { loadSpec } from './core/load-spec.js'
import { prepareSpec, renderFile } from './core/render.js'
import { routeEngine } from './core/router.js'
import { D2_INSTALL_HINT, findD2 } from './engines/d2.js'
import { DEFAULT_FORMATS, FORMATS, THEME_NAMES, VisualStructError, type Format, type ThemeName } from './types.js'

const USAGE = `VisualStruct - local visual compiler

Usage:
  visualstruct render <spec>      Render a VisualSpec to SVG/PNG/HTML
  visualstruct validate <spec>    Check a VisualSpec without rendering
  visualstruct doctor             Check the local environment
  visualstruct mcp                Serve the visual_render tool over MCP (stdio)

Options:
  --format <list>   Comma-separated formats, or "all": ${FORMATS.join(', ')}
                    (default: ${DEFAULT_FORMATS.join(', ')})
  --out <dir>       Output directory (default: ./output)
  --theme <name>    ${THEME_NAMES.join(' | ')}
  -h, --help        Show this help`

const MIN_NODE_MAJOR = 22

const display = (path: string) => relative(process.cwd(), path).replaceAll('\\', '/') || '.'

function parseFormats(value: string | undefined): Format[] | undefined {
  if (value === undefined) return undefined
  if (value.trim() === 'all') return [...FORMATS]
  const formats = value.split(',').map((part) => part.trim()).filter(Boolean)
  const unknown = formats.filter((format) => !(FORMATS as readonly string[]).includes(format))
  if (!formats.length || unknown.length) {
    throw new VisualStructError('USAGE', `Invalid --format "${value}"; use any of: ${FORMATS.join(', ')}`)
  }
  return formats as Format[]
}

function parseTheme(value: string | undefined): ThemeName | undefined {
  if (value === undefined || (THEME_NAMES as readonly string[]).includes(value)) return value as ThemeName | undefined
  throw new VisualStructError('USAGE', `Unknown --theme "${value}"; use one of: ${THEME_NAMES.join(', ')}`)
}

function requireSpecPath(path: string | undefined, command: string): string {
  if (!path) throw new VisualStructError('USAGE', `Missing spec path. Usage: visualstruct ${command} <spec>`)
  return path
}

async function doctor(outDir: string): Promise<number> {
  const row = (label: string, status: string) => console.log(`${label.padEnd(18)}${status}`)
  console.log('VisualStruct Doctor')

  const nodeOk = Number(process.versions.node.split('.')[0]) >= MIN_NODE_MAJOR
  row(`Node ${process.versions.node}`, nodeOk ? 'OK' : `FAIL (needs ${MIN_NODE_MAJOR}+)`)

  const d2 = findD2()
  row(d2 ? `D2 ${d2.version}` : 'D2', d2 ? 'OK' : 'MISSING')

  let outputOk = true
  const probe = join(outDir, `.doctor-${process.pid}`)
  try {
    await mkdir(outDir, { recursive: true })
    await writeFile(probe, '')
    await rm(probe)
  } catch {
    outputOk = false
  }
  row('Output', outputOk ? 'OK' : `FAIL (cannot write to ${display(outDir)})`)

  if (!d2) console.log(`\nD2 diagram types (architecture, flow, ...) are unavailable. ${D2_INSTALL_HINT}`)
  return nodeOk && outputOk ? 0 : 1
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: 'string' },
      out: { type: 'string' },
      theme: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const [command, specPath] = positionals

  if (values.help || !command) {
    console.log(USAGE)
    return values.help ? 0 : 2
  }

  switch (command) {
    case 'render': {
      const result = await renderFile(requireSpecPath(specPath, command), {
        formats: parseFormats(values.format),
        outDir: values.out,
        theme: parseTheme(values.theme),
      })
      console.log(`OK ${specPath} (${result.engine})`)
      for (const file of result.files) console.log(`  ${display(file)}`)
      for (const warning of result.warnings) console.warn(`warning: ${warning}`)
      return 0
    }
    case 'validate': {
      const path = requireSpecPath(specPath, command)
      const spec = prepareSpec(await loadSpec(path), { theme: parseTheme(values.theme) })
      console.log(`OK ${path} (type: ${spec.type}, engine: ${routeEngine(spec.type)}, theme: ${spec.theme})`)
      for (const warning of spec.warnings) console.warn(`warning: ${warning}`)
      return 0
    }
    case 'doctor':
      return doctor(resolve(values.out ?? 'output'))
    case 'mcp': {
      const { runMcpServer } = await import('./mcp.js')
      await runMcpServer()
      return 0
    }
    default:
      throw new VisualStructError('USAGE', `Unknown command "${command}"`, [USAGE])
  }
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  if (error instanceof VisualStructError) {
    console.error(`error [${error.code}]: ${error.message}`)
    for (const detail of error.details) console.error(`  - ${detail}`)
    process.exitCode = error.code === 'USAGE' ? 2 : 1
  } else if ((error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
    console.error(`error [USAGE]: ${(error as Error).message}`)
    process.exitCode = 2
  } else {
    throw error
  }
}
