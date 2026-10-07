// Thin Agent Plugins launcher. The packer replaces the version token and the
// resulting archive starts only the installed, versioned VisualStruct runtime.
import { access, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const runtimeVersion = '__VISUALSTRUCT_RUNTIME_VERSION__'

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(`VisualStruct needs Node.js 22+, found ${process.versions.node}`)
  process.exit(1)
}

const runtimeRoot = join(homedir(), '.local', 'visualstruct', `v${runtimeVersion}`)
const runtimeEntry = join(runtimeRoot, 'node_modules', 'visualstruct', 'dist', 'mcp.js')
const workDir = process.env.VISUALSTRUCT_OUTPUT_HOME || join(homedir(), 'Documents', 'VisualStruct')

try {
  await access(runtimeEntry)
} catch {
  console.error(`VisualStruct stable runtime v${runtimeVersion} was not found under the user profile.`)
  console.error('Install the matching VisualStruct runtime before enabling this plugin.')
  process.exit(1)
}

await mkdir(workDir, { recursive: true })
process.chdir(workDir)
console.error(`VisualStruct runtime: ${runtimeRoot}`)
const { runMcpServer } = await import(pathToFileURL(runtimeEntry).href)
await runMcpServer()
