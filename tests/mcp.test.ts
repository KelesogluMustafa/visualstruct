import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpServer, type VisualRenderResult } from '../src/mcp.js'

const INLINE_SPEC = `
v: 1
type: infographic
title: MCP demo
sections:
  - title: Storage
    icon: database
    items: [One, Two]
`

let outDir: string
beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'visualstruct-mcp-'))
})
afterAll(async () => {
  await rm(outDir, { recursive: true, force: true })
})

async function call(client: Client, args: Record<string, unknown>) {
  const response = await client.callTool({ name: 'visual_render', arguments: args })
  const text = (response.content as { type: string; text: string }[])[0]!.text
  return { text, isError: Boolean(response.isError), result: JSON.parse(text) as VisualRenderResult }
}

describe('MCP adapter', () => {
  let client: Client
  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await createMcpServer().connect(serverTransport)
    client = new Client({ name: 'test', version: '0.0.0' })
    await client.connect(clientTransport)
  })
  afterAll(() => client.close())

  it('exposes exactly one small tool', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).toEqual(['visual_render'])
    expect(Object.keys(tools[0]!.inputSchema.properties ?? {})).toEqual([
      'spec',
      'spec_path',
      'out_dir',
      'name',
      'formats',
      'theme',
      'validate_only',
    ])
    expect(JSON.stringify(tools[0]).length).toBeLessThan(1500)
  })

  it('renders an inline spec and returns paths only, never content', async () => {
    const { text, isError, result } = await call(client, { spec: INLINE_SPEC, out_dir: outDir, name: 'inline' })
    expect(isError).toBe(false)
    expect(result).toMatchObject({ ok: true, engine: 'svgjs', warnings: [] })
    const files = (result as { files: string[] }).files
    expect(files.map((file) => file.split('/').pop())).toEqual(['inline.svg', 'inline.png', 'inline.html'])
    for (const file of files) expect((await stat(file)).size).toBeGreaterThan(0)
    expect(text).not.toMatch(/<svg|<html|base64/i)
    expect(text.length).toBeLessThan(600)
  })

  it('renders from spec_path with format and theme options', async () => {
    const { result } = await call(client, {
      spec_path: 'examples/comparison.yaml',
      out_dir: outDir,
      formats: ['svg'],
      theme: 'technical-dark',
    })
    expect(result).toMatchObject({ ok: true, files: [`${outDir.replaceAll('\\', '/')}/comparison.svg`] })
  })

  it('validates without writing files', async () => {
    const { result } = await call(client, { spec: INLINE_SPEC, out_dir: outDir, name: 'unwritten', validate_only: true })
    expect(result).toEqual({ ok: true, valid: true, type: 'infographic', engine: 'svgjs', warnings: [] })
    expect(await readdir(outDir)).not.toContain('unwritten.svg')
  })

  it('reports spec and usage problems as small structured errors', async () => {
    const invalid = await call(client, { spec: 'v: 1\ntype: pie\ntitle: X\nx: 3', out_dir: outDir })
    expect(invalid.isError).toBe(true)
    expect(invalid.result).toMatchObject({ ok: false, code: 'SPEC_INVALID' })
    expect((invalid.result as { errors: string[] }).errors.join('\n')).toContain('Unrecognized key')

    expect((await call(client, { out_dir: outDir })).result).toMatchObject({ ok: false, code: 'USAGE' })
    expect((await call(client, { spec: INLINE_SPEC, spec_path: 'a.yaml' })).result).toMatchObject({ code: 'USAGE' })
    expect((await call(client, { spec_path: 'missing.yaml' })).result).toMatchObject({ code: 'SPEC_NOT_FOUND' })
  })

  it('rejects output names that could escape the output directory', async () => {
    const response = await client.callTool({
      name: 'visual_render',
      arguments: { spec: INLINE_SPEC, out_dir: outDir, name: '../escape' },
    })
    expect(response.isError).toBe(true)
  })
})

describe('MCP over stdio', () => {
  it('serves `visualstruct mcp` to a client working in another project directory', async () => {
    const require = createRequire(import.meta.url)
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [require.resolve('tsx/cli'), resolve('src/cli.ts'), 'mcp'],
      cwd: outDir,
    })
    const client = new Client({ name: 'stdio-test', version: '0.0.0' })
    await client.connect(transport)
    try {
      expect(client.getServerVersion()?.name).toBe('visualstruct')
      expect((await client.listTools()).tools).toHaveLength(1)
      // A relative out_dir resolves against the consumer project, not the VisualStruct repo.
      const { result } = await call(client, { spec: INLINE_SPEC, out_dir: 'docs/visuals', name: 'stdio', formats: ['svg'] })
      expect(result).toMatchObject({ ok: true })
      expect(await readFile(join(outDir, 'docs', 'visuals', 'stdio.svg'), 'utf8')).toMatch(/^<svg\b/)
    } finally {
      await client.close()
    }
  }, 30_000)
})
