---
name: visualstruct
description: Use for any request to create a diagram or technical visual (architecture, flow, system map, infographic, comparison table, timeline, roadmap). Calls the local VisualStruct MCP tool visual_render to produce SVG/PNG/HTML files. Use BEFORE writing SVG, HTML, Mermaid or other drawing code by hand.
---

# VisualStruct

VisualStruct compiles a small semantic spec into SVG/PNG/HTML locally. You decide what the visual
means; it does layout, icons, styling and export.

## Rules

1. Write the smallest valid VisualSpec and pass it inline to `visual_render` as `spec`.
2. Never write SVG, HTML, CSS, coordinates or icon paths yourself.
3. Pass `out_dir` as an absolute path inside the user's project (default: `<project>/output`).
4. Report the returned file paths. Do not read the generated SVG or HTML back.
5. Look at the PNG only if the user asks for a visual check or the result has warnings.
6. On `ok: false`, fix the spec from `errors` and call again. Unknown keys are rejected.

The tool's full name ends in `visual_render` (prefix depends on how it was installed). If it is not
loaded yet, find it with ToolSearch using the keyword query `visual_render`, not a guessed full name.
Only if no such tool exists, save the spec to a file and run `visualstruct render <spec> --out <dir>`.

## VisualSpec

```yaml
v: 1
type: architecture
title: SaveFold
nodes:
  web: { label: Web, tech: Vite, icon: monitor }
  api: { label: API, tech: Node.js, icon: server, group: backend }
  db: Database
groups:
  backend: Backend
flow:
  - web>api>db
  - "api>db: reads"
```

Common: `v: 1`, `type`, `title`, optional `subtitle`, `footer`, `theme`.
Themes: `technical-light` (default), `technical-dark`, `minimal-light`, `portfolio`.
Icons are Lucide names (`database`, `server`, `zap`). Tool options `formats`, `theme`, `name` override the spec.

| Types | Fields |
| --- | --- |
| `architecture`, `flow`, `system-map`, `data-flow`, `sequence` | `nodes`, `groups`, `flow`, `direction: right\|down` |
| `infographic`, `project-overview`, `stack`, `timeline`, `roadmap` | `stats`, `sections`, `cols` |
| `comparison` | `columns`, `rows` |

```yaml
stats:
  - { label: Engines, value: 2, icon: cpu }
sections:
  - title: Input
    icon: file-text
    text: Optional sentence.
    items: [Plain item, { label: Diagrams, value: D2, icon: workflow }]
    tags: [YAML, JSON]
```

```yaml
columns: [{ title: Ours, icon: zap, highlight: true }, Theirs]
rows:
  - [Row label, value for column 1, value for column 2]
  - [Boolean cells draw a check or cross, true, false]
```
