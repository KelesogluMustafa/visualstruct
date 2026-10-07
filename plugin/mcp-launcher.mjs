// Starts the installed VisualStruct core as the plugin's MCP server.
// The plugin ships no code of its own; a shell is used so Windows can resolve the npm ".cmd" shim.
import { spawn } from 'node:child_process'

const child = spawn('visualstruct mcp', { shell: true, stdio: 'inherit', windowsHide: true })
child.on('exit', (code) => process.exit(code ?? 1))
