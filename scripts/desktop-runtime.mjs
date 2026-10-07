// Installs the current version as a stable runtime in the user profile:
//   ~/.local/visualstruct/v<version>/
// It is installed from `npm pack` output, so it does not depend on this checkout or on `npm link`.
// Safe to re-run; other installed versions are left alone.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const runtime = join(homedir(), '.local', 'visualstruct', `v${pkg.version}`)
const staging = mkdtempSync(join(tmpdir(), 'visualstruct-pack-'))

try {
  execSync(`npm pack --pack-destination "${staging}"`, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
  const tarball = join(staging, `${pkg.name}-${pkg.version}.tgz`)

  mkdirSync(runtime, { recursive: true })
  const manifest = join(runtime, 'package.json')
  if (!existsSync(manifest)) {
    // Carries the same dependency overrides as the package itself.
    const runtimePkg = { name: 'visualstruct-runtime', private: true, overrides: pkg.overrides ?? {} }
    writeFileSync(manifest, `${JSON.stringify(runtimePkg, null, 2)}\n`)
  }
  execSync(`npm install "${tarball}" --omit=dev --no-audit --no-fund`, { cwd: runtime, stdio: ['ignore', 'ignore', 'inherit'] })
  copyFileSync(join(root, 'desktop-extension', 'runtime-launch.mjs'), join(runtime, 'desktop-launch.mjs'))
} finally {
  rmSync(staging, { recursive: true, force: true })
}

console.log(`VisualStruct runtime v${pkg.version} installed: ${runtime}`)
