import { existsSync, realpathSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import JSZip from 'jszip'
import YAML from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findD2 } from '../src/engines/d2.js'

const archivePath = resolve('build/visualstruct-chatgpt-plugin.zip')
const pluginSource = resolve('chatgpt-plugin')
const repo = resolve('.')
const corePackage = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
const runtime = join(homedir(), '.local', 'visualstruct', `v${corePackage.version}`)

describe('ChatGPT/Codex plugin package', () => {
  let zip: JSZip

  beforeAll(async () => {
    expect(existsSync(archivePath), 'run npm run chatgpt:pack first').toBe(true)
    zip = await JSZip.loadAsync(await readFile(archivePath))
  })

  it('validates the Agent Plugins 1.0 manifest and MCP layout', async () => {
    const manifest = JSON.parse(await zip.file('visualstruct/plugin.json')!.async('text'))
    const mcp = JSON.parse(await zip.file('visualstruct/mcp.json')!.async('text'))

    expect(manifest.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
    expect(manifest.name).toBe('visualstruct')
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(manifest.extensions['com.openai'].interface.shortDescription.length).toBeLessThanOrEqual(30)
    expect(mcp.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/mcp.schema.json')
    expect(Object.keys(mcp)).toEqual(['$schema', 'mcpServers'])
    expect(Object.keys(mcp.mcpServers)).toEqual(['visualstruct'])
    expect(mcp.mcpServers.visualstruct).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['${PLUGIN_ROOT}/runtime-launch.mjs'],
      cwd: '${PLUGIN_ROOT}',
    })
  })

  it('discovers exactly one Skill and no duplicate legacy MCP registration', async () => {
    const files = Object.keys(zip.files).filter((path) => !zip.files[path]!.dir)
    const skills = files.filter((path) => /\/skills\/[^/]+\/SKILL\.md$/.test(path))
    expect(skills).toEqual(['visualstruct/skills/visualstruct/SKILL.md'])
    expect(files.filter((path) => path.endsWith('/mcp.json'))).toEqual(['visualstruct/mcp.json'])
    expect(files.some((path) => path.endsWith('/.mcp.json') || path.includes('/.claude-plugin/'))).toBe(false)

    const skill = await zip.file(skills[0]!)!.async('text')
    const frontmatter = YAML.parse(skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!)
    expect(frontmatter.name).toBe('visualstruct')
    expect(skill).toBe(await readFile('plugin/skills/visualstruct/SKILL.md', 'utf8'))
  })

  it('contains no hardcoded user or development-checkout dependency', async () => {
    const launcher = await zip.file('visualstruct/runtime-launch.mjs')!.async('text')
    expect(launcher).toContain(`const runtimeVersion = '${corePackage.version}'`)
    expect(launcher).toContain("join(homedir(), '.local', 'visualstruct', `v${runtimeVersion}`)")
    expect(launcher).not.toMatch(/C:\\Users\\|Projects[\\/]|npm link/i)
    expect(realpathSync(join(runtime, 'node_modules', 'visualstruct')).toLowerCase().startsWith(runtime.toLowerCase())).toBe(true)
    expect(realpathSync(join(runtime, 'node_modules', 'visualstruct')).toLowerCase().startsWith(repo.toLowerCase())).toBe(false)
  })
})

describe.skipIf(!existsSync(join(runtime, 'desktop-launch.mjs')))('ChatGPT/Codex plugin stable runtime', () => {
  let temp: string
  let client: Client
  let stderr = ''

  const call = async (args: Record<string, unknown>) => {
    const response = await client.callTool({ name: 'visual_render', arguments: args })
    const text = (response.content as { text: string }[])[0]!.text
    expect(text).not.toMatch(/<svg|<html|base64/i)
    expect(text.length).toBeLessThan(700)
    return JSON.parse(text) as { ok: boolean; engine: string; files: string[]; warnings: string[] }
  }

  beforeAll(async () => {
    temp = await mkdtemp(join(tmpdir(), 'visualstruct-chatgpt-plugin-'))
    const zip = await JSZip.loadAsync(await readFile(archivePath))
    const launcher = await zip.file('visualstruct/runtime-launch.mjs')!.async('nodebuffer')
    const launcherPath = join(temp, 'runtime-launch.mjs')
    await writeFile(launcherPath, launcher)

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [launcherPath],
      cwd: temp,
      env: { ...(process.env as Record<string, string>), VISUALSTRUCT_OUTPUT_HOME: temp },
      stderr: 'pipe',
    })
    transport.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    client = new Client({ name: 'chatgpt-plugin-test', version: '0.0.0' })
    await client.connect(transport)
  }, 90_000)

  afterAll(async () => {
    await client?.close()
    await rm(temp, { recursive: true, force: true })
  })

  it('starts the installed runtime and exposes exactly one visual_render tool', async () => {
    expect(client.getServerVersion()).toEqual({ name: 'visualstruct', version: corePackage.version })
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['visual_render'])
    expect(stderr).toContain(`VisualStruct runtime: ${runtime}`)
  })

  it('renders a PNG and returns a compact path-only result', async () => {
    const result = await call({
      spec: 'v: 1\ntype: infographic\ntitle: Plugin PNG\nsections:\n  - title: Ready\n    items: [Local runtime]',
      out_dir: temp,
      name: 'plugin-png',
      formats: ['png'],
    })
    expect(result).toMatchObject({ ok: true, engine: 'svgjs', warnings: [] })
    expect((await readFile(result.files[0]!)).subarray(1, 4).toString()).toBe('PNG')
  })

  it.skipIf(!findD2())('renders a D2 visual to SVG and PNG', async () => {
    const result = await call({
      spec: 'v: 1\ntype: architecture\ntitle: Plugin D2\nnodes:\n  web: Web\n  api: API\nflow:\n  - web>api',
      out_dir: temp,
      name: 'plugin-d2',
      formats: ['svg', 'png'],
    })
    expect(result).toMatchObject({ ok: true, engine: 'd2' })
    expect(await readFile(result.files[0]!, 'utf8')).toMatch(/^<svg\b/)
    expect((await readFile(result.files[1]!)).subarray(1, 4).toString()).toBe('PNG')
  })

  it('renders PDF only', async () => {
    const result = await call({
      spec: 'v: 1\ntype: comparison\ntitle: Plugin PDF\ncolumns: [A, B]\nrows:\n  - [Choice, true, false]',
      out_dir: temp,
      name: 'plugin-pdf',
      formats: ['pdf'],
    })
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatch(/plugin-pdf\.pdf$/)
    expect((await readFile(result.files[0]!)).subarray(0, 5).toString()).toBe('%PDF-')
    expect((await stat(result.files[0]!)).size).toBeGreaterThan(5_000)
  })
})

describe('ChatGPT/Codex plugin source isolation', () => {
  it('keeps the portable package separate from the Claude integration', () => {
    expect(pluginSource).not.toBe(resolve('plugin'))
    expect(existsSync('plugin/.claude-plugin/plugin.json')).toBe(true)
    expect(existsSync('chatgpt-plugin/.claude-plugin')).toBe(false)
  })
})
