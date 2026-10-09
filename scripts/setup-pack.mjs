// Builds the release files into build/:
//   VisualStruct-Windows-Setup-<version>.zip   installer + prebuilt package + Claude Desktop files
//   SHA256SUMS.txt                             checksums of every release file in build/
// The Setup ZIP lets a user install without cloning the repository. It bundles no Node.js and
// no D2; the installer downloads the package's dependencies from the npm registry.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = fileURLToPath(new URL('..', import.meta.url))
const build = join(root, 'build')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const { version } = pkg
const run = (command) => execSync(command, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })

const guide = `VISUALSTRUCT ${version} - INSTALL GUIDE (WINDOWS)
=================================================

Requirements
  Node.js 22 or newer   https://nodejs.org/   or   winget install OpenJS.NodeJS.LTS
  An internet connection during installation (npm downloads the dependencies).
  D2, only for architecture, flow and sequence diagrams:   winget install Terrastruct.D2

Install
  1. Extract this ZIP completely.
  2. Double-click install.cmd.

  install.cmd            command line only
  install.cmd desktop    command line + the two Claude Desktop files in this folder
  install.cmd code       command line + Claude Code plugin (needs the claude CLI and git)
  install.cmd both       everything

  VisualStruct is installed to  %USERPROFILE%\\.local\\visualstruct\\v${version}
  and the "visualstruct" command to  %USERPROFILE%\\.local\\bin  (added to your user PATH).
  Open a new terminal afterwards and run:   visualstruct doctor

Claude Desktop
  Settings > Extensions > install   visualstruct-${version}.mcpb
  Settings > Capabilities > Skills > upload   visualstruct-skill.zip

Uninstall
  Delete  %USERPROFILE%\\.local\\visualstruct  and  %USERPROFILE%\\.local\\bin\\visualstruct.cmd

Documentation: https://github.com/KelesogluMustafa/visualstruct
`

const installCmd = [
  '@echo off',
  'rem VisualStruct installer. Usage: install.cmd [cli|code|desktop|both]   (default: cli)',
  'set "VS_MODE=%~1"',
  'if "%VS_MODE%"=="" set "VS_MODE=cli"',
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Mode %VS_MODE%',
  'echo.',
  'pause',
  '',
].join('\r\n')

mkdirSync(build, { recursive: true })
run('node scripts/desktop-pack.mjs')
run('node scripts/chatgpt-plugin-pack.mjs')

const staging = mkdtempSync(join(tmpdir(), 'visualstruct-setup-'))
try {
  run(`npm pack --pack-destination "${staging}"`)
  const tarball = `${pkg.name}-${version}.tgz`
  const top = `VisualStruct-Windows-Setup-${version}/`
  const zip = new JSZip()
  const add = (name, content) => zip.file(top + name, content, { date: new Date('2026-01-01T00:00:00Z') })
  add('install.cmd', installCmd)
  add('install.ps1', readFileSync(join(root, 'install.ps1')))
  add(tarball, readFileSync(join(staging, tarball)))
  // Same dependency overrides as scripts/desktop-runtime.mjs writes for a checkout install.
  add('runtime-package.json', `${JSON.stringify({ name: 'visualstruct-runtime', private: true, overrides: pkg.overrides ?? {} }, null, 2)}\n`)
  add('runtime-launch.mjs', readFileSync(join(root, 'desktop-extension', 'runtime-launch.mjs')))
  add(`visualstruct-${version}.mcpb`, readFileSync(join(build, `visualstruct-${version}.mcpb`)))
  add('visualstruct-skill.zip', readFileSync(join(build, 'visualstruct-skill.zip')))
  add('README-INSTALL.txt', guide.replace(/\n/g, '\r\n'))
  add('LICENSE', readFileSync(join(root, 'LICENSE')))
  const setup = join(build, `VisualStruct-Windows-Setup-${version}.zip`)
  writeFileSync(setup, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  console.log(setup)
} finally {
  rmSync(staging, { recursive: true, force: true })
}

const released = [
  `VisualStruct-Windows-Setup-${version}.zip`,
  `visualstruct-${version}.mcpb`,
  'visualstruct-chatgpt-plugin.zip',
  'visualstruct-skill.zip',
].filter((name) => existsSync(join(build, name)))
const sums = released.map((name) => `${createHash('sha256').update(readFileSync(join(build, name))).digest('hex')} *${name}\n`)
writeFileSync(join(build, 'SHA256SUMS.txt'), sums.join(''))
console.log(join(build, 'SHA256SUMS.txt'))
