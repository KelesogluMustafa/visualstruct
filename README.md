# VisualStruct

A local visual compiler: a small semantic `VisualSpec` (YAML/JSON) goes in, polished SVG / PNG / HTML comes out.
The model decides what the visual means; layout, icons, styling, optimization and export all happen locally.

The goal is token efficiency with Claude: Claude writes only the compact spec — never SVG paths, coordinates,
CSS or HTML — and gets file paths back, not the generated markup.

Architecture and scope: [VISUALSTRUCT_MASTER_ARCHITECTURE.md](VISUALSTRUCT_MASTER_ARCHITECTURE.md).

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

## Development

```bash
npm test
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)
