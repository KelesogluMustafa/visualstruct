# Integrations

VisualStruct serves one MCP tool, `visual_render`. Every integration below is a thin launcher for
the runtime installed in your user profile (`%USERPROFILE%\.local\visualstruct\v<version>`), so
install VisualStruct first: see [Installation](../README.md#installation).

The Windows Setup ZIP of each release already contains the Claude Desktop files
(`visualstruct-<version>.mcpb` and `visualstruct-skill.zip`); the build commands below are only
needed when working from a source checkout.

## Claude Code integration

Install the core once per machine; other projects never copy this repository.

```bash
npm ci
npm run build
npm link
```

`npm link` puts the `visualstruct` command on PATH. `visualstruct mcp` serves one MCP tool,
`visual_render`, which takes a spec (`spec` inline or `spec_path`) plus optional `out_dir`, `name`,
`formats`, `theme`, `validate_only`, and returns file paths and warnings only, never file contents.

Use **one** of the two modes. Running both registers the skill and the tool twice.

**Plugin mode** (skill + MCP as one unit):

```bash
claude plugin marketplace add KelesogluMustafa/visualstruct
claude plugin install visualstruct@visualstruct --scope user
claude plugin disable visualstruct@visualstruct
claude plugin enable visualstruct@visualstruct
```

Disabling the plugin removes both the skill and the MCP server. To switch off only the MCP server,
use `/mcp` inside Claude Code.

**Manual mode** (skill and MCP toggled separately, run from PowerShell):

```powershell
claude mcp add -s user visualstruct -- cmd /c visualstruct mcp
Copy-Item -Recurse plugin\skills\visualstruct $env:USERPROFILE\.claude\skills\visualstruct
```

- MCP off: `claude mcp remove -s user visualstruct`, or disable it per project in `/mcp`.
- Skill off: delete `~/.claude/skills/visualstruct`.
- Skill manual-only: add `disable-model-invocation: true` to the copied `SKILL.md` front matter, then
  call it with `/visualstruct`.

On macOS/Linux the manual registration is `claude mcp add -s user visualstruct -- visualstruct mcp`.

In any project, ask Claude for a diagram; outputs are written to that project (`out_dir`).
[plugin/skills/visualstruct/SKILL.md](../plugin/skills/visualstruct/SKILL.md) is the single source of the skill.

## Claude Desktop (Windows)

The Chat and Cowork tabs of the Claude desktop app use a Desktop Extension instead of the Claude Code plugin.
The extension is only a launcher: it starts a versioned runtime installed in your user profile, so it does
not need this checkout or `npm link` once installed.

```bash
npm ci
npm run desktop:runtime
npm run desktop:pack
```

- `desktop:runtime` installs `~/.local/visualstruct/v<version>/` from `npm pack` output. Re-running is safe;
  other versions are kept.
- `desktop:pack` writes `build/visualstruct-<version>.mcpb` and `build/visualstruct-skill.zip`.

Then, in Claude Desktop: install the `.mcpb` under Settings → Extensions, and upload the skill zip under
Settings → Capabilities → Skills. Node.js 22+ must be on PATH, and D2 is needed for the diagram types.
With no `out_dir`, files are written to `Documents/VisualStruct/output`.

The Claude Code plugin and the Desktop Extension are separate surfaces sharing the same core and the same
`SKILL.md`. An uploaded skill may also sync into Claude Code; if the skill then shows up twice there, keep
only one of the two.

## ChatGPT and Codex Desktop plugin

VisualStruct also ships as one portable Agent Plugins 1.0 archive containing the existing VisualStruct
Skill and a local MCP registration for the existing `visual_render` tool. The archive is a thin launcher:
it does not bundle another renderer and never depends on this checkout or on `npm link`.

The plugin needs the stable VisualStruct runtime of the same version, so install that first:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Mode cli
```

Then upload `visualstruct-chatgpt-plugin.zip` from **Plugins → Add → Upload plugin archive**. The ZIP attached
to each GitHub release can be uploaded as is; `npm run chatgpt:pack` builds the same file into `build/`.
The local MCP resolves the matching installed runtime from
`%USERPROFILE%\.local\visualstruct\v<version>`. Keep only this plugin enabled on OpenAI surfaces to avoid
duplicate Skill or MCP registrations from another VisualStruct installation.
