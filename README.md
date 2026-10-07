# VisualStruct

A local visual compiler: a small semantic `VisualSpec` (YAML/JSON) goes in, polished SVG / PNG / HTML comes out,
plus PDF / PPTX / DOCX on request.
The model decides what the visual means; layout, icons, styling, optimization and export all happen locally.

The goal is token efficiency with Claude: Claude writes only the compact spec — never SVG paths, coordinates,
CSS or HTML — and gets file paths back, not the generated markup.

Architecture and scope: [VISUALSTRUCT_MASTER_ARCHITECTURE.md](VISUALSTRUCT_MASTER_ARCHITECTURE.md).

## Quick install on Windows

Needs Node.js 22+ (and Claude Code for the `code` and `both` modes).

```powershell
git clone https://github.com/KelesogluMustafa/visualstruct.git
cd visualstruct
.\install.ps1 -Mode both
```

If PowerShell blocks scripts, run `powershell -ExecutionPolicy Bypass -File .\install.ps1 -Mode both`.

| Mode | Installs |
| --- | --- |
| `cli` | Core + CLI |
| `code` | Core + CLI + Claude Code plugin |
| `desktop` | Core + CLI + Claude Desktop packages |
| `both` | All of the above |

The core goes to `%USERPROFILE%\.local\visualstruct\v<version>` and the `visualstruct` command to
`%USERPROFILE%\.local\bin` (added to your user PATH; open a new terminal afterwards). Nothing depends on the
checkout or on `npm link`, and re-running the installer is safe. For Claude Desktop it prints two files to
install by hand. D2 is only checked, never installed for you: `winget install Terrastruct.D2`.

**Uninstall**

- Core and CLI: delete `%USERPROFILE%\.local\visualstruct` and `%USERPROFILE%\.local\bin\visualstruct.cmd`.
- Claude Code: `claude plugin uninstall visualstruct@visualstruct`, then `claude plugin marketplace remove visualstruct`.
- Claude Desktop: remove the extension under Settings → Extensions and the skill under Settings → Capabilities.

The sections below describe the same setup step by step.

## Setup

Requires Node.js 22+. Diagram types also need the [D2](https://d2lang.com) executable:

```bash
git clone https://github.com/KelesogluMustafa/visualstruct.git
cd visualstruct
npm ci
winget install Terrastruct.D2
npm run doctor
```

Use `npm install` instead of `npm ci` when changing dependencies.

If D2 is installed somewhere unusual, point `VISUALSTRUCT_D2` at the executable.

## Usage

```bash
npm run validate -- examples/architecture.yaml
npm run render -- examples/infographic.yaml
npm run render -- examples/comparison.yaml --format svg,png --theme technical-dark --out ./output
```

Each render writes `output/<name>.svg`, `.png` and `.html` and prints the file paths.

### Output formats

```bash
npm run render -- examples/architecture.yaml --format pdf,pptx,docx
npm run render -- examples/architecture.yaml --format all
```

| Format | What you get |
| --- | --- |
| `svg`, `png`, `html` | The default set: optimized SVG, 2x PNG, standalone responsive page |
| `pdf` | Single-page vector PDF sized to the visual. Text is outlined, so it is not selectable |
| `pptx` | One 16:9 slide with the visual centered, embedded as PNG |
| `docx` | A4 page (landscape for wide visuals) with title, optional subtitle and the visual as PNG |

Every format is exported from the same master SVG; nothing is rendered twice.

## VisualSpec

No coordinates, no raw SVG, no CSS. Unknown keys are rejected.

```yaml
v: 1
type: architecture
title: SaveFold
nodes:
  web: { label: Web, tech: Vite, icon: monitor }
  api: { label: API, tech: Node.js, icon: server }
  db: { label: Database, tech: MySQL, icon: database }
flow:
  - web>api>db
```

| Engine | Types | Main fields |
| --- | --- | --- |
| D2 | `architecture`, `flow`, `system-map`, `data-flow`, `sequence` | `nodes`, `groups`, `flow`, `direction` |
| SVG.js | `infographic`, `project-overview`, `stack`, `timeline`, `roadmap` | `stats`, `sections` (`items`, `tags`), `cols` |
| SVG.js | `comparison` | `columns`, `rows` (`[label, value, ...]`) |

Common fields: `title`, `subtitle`, `footer`, `theme`, `responsive`, `output: { formats, dir, name }`.
Themes: `technical-light` (default), `technical-dark`, `minimal-light`, `portfolio`.
Icons are [Lucide](https://lucide.dev/icons) names. See [examples/](examples).

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
[plugin/skills/visualstruct/SKILL.md](plugin/skills/visualstruct/SKILL.md) is the single source of the skill.

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

## Development

```bash
npm test
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)
