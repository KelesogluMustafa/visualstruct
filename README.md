# VisualStruct

A local visual compiler: a small semantic `VisualSpec` (YAML/JSON) goes in, polished SVG / PNG / HTML comes out.
The model decides what the visual means; layout, icons, styling, optimization and export all happen locally.

The goal is token efficiency with Claude: Claude writes only the compact spec — never SVG paths, coordinates,
CSS or HTML — and gets file paths back, not the generated markup.

Architecture and scope: [VISUALSTRUCT_MASTER_ARCHITECTURE.md](VISUALSTRUCT_MASTER_ARCHITECTURE.md).

## Setup

Requires Node.js 22+. Diagram types also need the [D2](https://d2lang.com) executable:

```bash
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

## Development

```bash
npm test
npm run typecheck
npm run build
```
