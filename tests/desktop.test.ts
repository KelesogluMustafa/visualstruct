import { existsSync, realpathSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findD2 } from '../src/engines/d2.js'

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))
const { version } = await readJson('package.json')
const manifest = await readJson('desktop-extension/manifest.json')

const runtime = join(homedir(), '.local', 'visualstruct', `v${version}`)
const launcher = join(runtime, 'desktop-launch.mjs')
const repo = resolve('.')

describe('Desktop Extension manifest', () => {
  it('targets the versioned runtime in the user profile, not a checkout', () => {
    expect(manifest.version).toBe(version)
    expect(manifest.server.mcp_config.command).toBe('node')
    expect(manifest.server.mcp_config.args).toEqual([`\${HOME}\${/}.local\${/}visualstruct\${/}v${version}\${/}desktop-launch.mjs`])
    expect(JSON.stringify(manifest)).not.toMatch(/Users[\\/]|Projects|npm link|\.cmd"\s*,\s*"args/i)
  })

  it('declares exactly the one MCP tool', () => {
    expect(manifest.tools.map((tool: { name: string }) => tool.name)).toEqual(['visual_render'])
  })

  it('ships a manual launcher for the same runtime version', async () => {
    const cmd = await readFile(join('desktop-extension', manifest.server.entry_point), 'utf8')
    expect(cmd).toContain(`\\.local\\visualstruct\\v${version}\\desktop-launch.mjs`)
  })
})

// Needs `npm run desktop:runtime` for the current version; skipped on machines without it.
describe.skipIf(!existsSync(launcher))('stable runtime', () => {
  let home: string
  let client: Client
  let stderr = ''

  const call = async (args: Record<string, unknown>) => {
    const response = await client.callTool({ name: 'visual_render', arguments: args })
    const text = (response.content as { text: string }[])[0]!.text
    expect(text).not.toMatch(/<svg|<html|base64/i)
    expect(text.length).toBeLessThan(700)
    return JSON.parse(text) as { ok: boolean; engine: string; files: string[] }
  }

  beforeAll(async () => {
    // A throwaway profile, so the default output folder is not the real Documents folder.
    home = await mkdtemp(join(tmpdir(), 'visualstruct-home-'))
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [launcher],
      cwd: tmpdir(),
      env: { ...(process.env as Record<string, string>), USERPROFILE: home, HOME: home },
      stderr: 'pipe',
    })
    transport.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    client = new Client({ name: 'desktop-test', version: '0.0.0' })
    await client.connect(transport)
  }, 90_000) // a freshly installed runtime can be slow to start the first time
  afterAll(async () => {
    await client?.close()
    await rm(home, { recursive: true, force: true })
  })

  it('is a real install that does not point back at the development checkout', () => {
    const installed = realpathSync(join(runtime, 'node_modules', 'visualstruct'))
    expect(installed.toLowerCase().startsWith(runtime.toLowerCase())).toBe(true)
    expect(installed.toLowerCase().startsWith(repo.toLowerCase())).toBe(false)
    expect(existsSync(join(installed, 'src'))).toBe(false)
    expect(stderr).toContain(`VisualStruct runtime: ${runtime}`)
  })

  it('completes the MCP handshake and lists only visual_render', async () => {
    expect(client.getServerVersion()).toEqual({ name: 'visualstruct', version })
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['visual_render'])
  })

  it('renders an infographic PNG into Documents/VisualStruct/output when no out_dir is given', async () => {
    const result = await call({ spec_path: join(repo, 'examples', 'infographic.yaml'), formats: ['png'] })
    expect(result).toMatchObject({ ok: true, engine: 'svgjs' })
    const expected = join(home, 'Documents', 'VisualStruct', 'output', 'infographic.png')
    expect(realpathSync(result.files[0]!)).toBe(realpathSync(expected))
    expect((await readFile(expected)).subarray(1, 4).toString()).toBe('PNG')
  })

  it.skipIf(!findD2())('renders a D2 architecture diagram to SVG and PNG', async () => {
    const result = await call({ spec_path: join(repo, 'examples', 'architecture.yaml'), formats: ['svg', 'png'] })
    expect(result).toMatchObject({ ok: true, engine: 'd2' })
    expect(await readFile(result.files[0]!, 'utf8')).toMatch(/^<svg\b/)
  })

  it('exports a PDF', async () => {
    const result = await call({ spec_path: join(repo, 'examples', 'comparison.yaml'), formats: ['pdf'] })
    expect(result.ok).toBe(true)
    expect((await readFile(result.files[0]!)).subarray(0, 5).toString()).toBe('%PDF-')
    expect((await stat(result.files[0]!)).size).toBeGreaterThan(5_000)
  })
})
