// Claude Desktop entry point. Installed as "desktop-launch.mjs" in the versioned runtime folder,
// next to node_modules, so it only ever starts that runtime and never a development checkout.
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(`VisualStruct needs Node.js 22+, found ${process.versions.node}`)
  process.exit(1)
}

// A desktop chat has no project folder, so relative and default output paths resolve here.
const workDir = join(homedir(), 'Documents', 'VisualStruct')
mkdirSync(workDir, { recursive: true })
process.chdir(workDir)

// stdout belongs to the MCP protocol; diagnostics go to stderr.
console.error(`VisualStruct runtime: ${import.meta.dirname}`)
const { runMcpServer } = await import('./node_modules/visualstruct/dist/mcp.js')
await runMcpServer()
