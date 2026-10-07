// Builds one portable Agent Plugins 1.0 archive for ChatGPT/Codex Desktop.
// The archive contains only metadata, the existing VisualStruct Skill, and a
// thin launcher for the installed stable runtime. No render implementation or
// development-checkout path is bundled.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import JSZip from 'jszip'
import YAML from 'yaml'

const root = fileURLToPath(new URL('..', import.meta.url))
const archiveRoot = 'visualstruct'
const pluginSchema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const mcpSchema = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8')
const readJson = (...parts) => JSON.parse(read(...parts))

function assert(condition, message) {
  if (!condition) throw new Error(`ChatGPT plugin validation failed: ${message}`)
}

const corePackage = readJson('package.json')
const manifest = readJson('chatgpt-plugin', 'plugin.json')
const mcp = readJson('chatgpt-plugin', 'mcp.json')
const manifestSchema = readJson('scripts', 'schemas', 'agent-plugins-1.0.0-plugin.schema.json')
const mcpConfigSchema = readJson('scripts', 'schemas', 'agent-plugins-1.0.0-mcp.schema.json')
const skill = read('plugin', 'skills', 'visualstruct', 'SKILL.md')
const launcherTemplate = read('chatgpt-plugin', 'runtime-launch.mjs')

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateManifest = ajv.compile(manifestSchema)
const validateMcp = ajv.compile(mcpConfigSchema)
assert(validateManifest(manifest), `plugin.json does not match the official schema: ${ajv.errorsText(validateManifest.errors)}`)
assert(validateMcp(mcp), `mcp.json does not match the official schema: ${ajv.errorsText(validateMcp.errors)}`)
assert(manifest.$schema === pluginSchema, 'plugin.json must target Agent Plugins 1.0.0')
assert(/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(manifest.name), 'plugin name is invalid')
assert(/^\d+\.\d+\.\d+$/.test(manifest.version), 'plugin version must be strict semver')
assert(typeof manifest.description === 'string' && manifest.description.length > 0, 'plugin description is required')
const interfaceMetadata = manifest.extensions?.['com.openai']?.interface
assert(interfaceMetadata?.displayName === 'VisualStruct', 'OpenAI displayName must be VisualStruct')
assert(
  typeof interfaceMetadata?.shortDescription === 'string' && interfaceMetadata.shortDescription.length <= 30,
  'OpenAI shortDescription must be at most 30 characters',
)

assert(mcp.$schema === mcpSchema, 'mcp.json must target Agent Plugins 1.0.0')
const servers = Object.entries(mcp.mcpServers ?? {})
assert(servers.length === 1 && servers[0][0] === 'visualstruct', 'mcp.json must declare exactly one visualstruct server')
const server = servers[0][1]
assert(server.type === 'stdio', 'visualstruct MCP must use stdio')
assert(server.command === 'node', 'visualstruct MCP must launch with Node.js')
assert(JSON.stringify(server.args) === JSON.stringify(['${PLUGIN_ROOT}/runtime-launch.mjs']), 'MCP launcher path is invalid')
assert(server.cwd === '${PLUGIN_ROOT}', 'MCP working directory must be the plugin root')

const frontmatterMatch = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)
assert(frontmatterMatch, 'VisualStruct Skill frontmatter is missing')
const frontmatter = YAML.parse(frontmatterMatch[1])
assert(frontmatter?.name === 'visualstruct', 'VisualStruct Skill name is invalid')
assert(typeof frontmatter?.description === 'string' && frontmatter.description.length > 0, 'VisualStruct Skill description is missing')

const token = '__VISUALSTRUCT_RUNTIME_VERSION__'
assert(launcherTemplate.split(token).length === 2, 'runtime launcher must contain exactly one version token')
const launcher = launcherTemplate.replace(token, corePackage.version)
assert(!/Users[\\/]|Projects[\\/]|npm link/i.test(launcher), 'runtime launcher depends on a development checkout')

const zip = new JSZip()
zip.file(`${archiveRoot}/plugin.json`, `${JSON.stringify(manifest, null, 2)}\n`)
zip.file(`${archiveRoot}/mcp.json`, `${JSON.stringify(mcp, null, 2)}\n`)
zip.file(`${archiveRoot}/runtime-launch.mjs`, launcher)
zip.file(`${archiveRoot}/skills/visualstruct/SKILL.md`, skill)
zip.file(`${archiveRoot}/LICENSE`, read('LICENSE'))

const outputDir = join(root, 'build')
const outputFile = join(outputDir, 'visualstruct-chatgpt-plugin.zip')
mkdirSync(outputDir, { recursive: true })
writeFileSync(outputFile, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log(outputFile)
