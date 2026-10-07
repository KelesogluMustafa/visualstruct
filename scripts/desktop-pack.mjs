// Builds the Claude Desktop install files into build/:
//   visualstruct-<version>.mcpb   thin Desktop Extension (manifest + launcher, no VisualStruct code)
//   visualstruct-skill.zip        the skill, from its single source in plugin/skills/
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (...parts) => readFileSync(join(root, ...parts))
const { version } = JSON.parse(read('package.json').toString())
const manifest = JSON.parse(read('desktop-extension', 'manifest.json').toString())

const launchTarget = manifest.server.mcp_config.args.join(' ')
if (manifest.version !== version || !launchTarget.includes(`v${version}`)) {
  throw new Error(`desktop-extension/manifest.json must target v${version} (found ${manifest.version}: ${launchTarget})`)
}

async function writeZip(name, files) {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  const file = join(root, 'build', name)
  writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  console.log(file)
}

mkdirSync(join(root, 'build'), { recursive: true })
await writeZip(`visualstruct-${version}.mcpb`, {
  'manifest.json': read('desktop-extension', 'manifest.json'),
  'server/visualstruct-mcp.cmd': read('desktop-extension', 'server', 'visualstruct-mcp.cmd'),
})
await writeZip('visualstruct-skill.zip', {
  'visualstruct/SKILL.md': read('plugin', 'skills', 'visualstruct', 'SKILL.md'),
})
