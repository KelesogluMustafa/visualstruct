# VisualStruct — Master Architecture

**Status:** V0.1 architecture baseline  
**Primary goal:** Produce polished SVG/PNG/HTML visuals locally while sending Claude the smallest possible semantic specification.  
**Priority:** Fast local setup, minimal moving parts, no Docker, no monorepo, no unnecessary frontend framework.

---

## 1. Core principle

VisualStruct is not an AI image generator. It is a **local visual compiler**.

Claude should decide **what the visual means**, not draw it.

```text
Claude
  │
  │ small VisualSpec (YAML/JSON)
  ▼
VisualStruct Local
  │
  ├─ layout
  ├─ icons
  ├─ SVG generation
  ├─ styling
  ├─ optimization
  ├─ HTML wrapping
  └─ PNG export
  ▼
SVG / PNG / HTML
```

### Hard token rule

Claude must **not** generate:

- raw SVG paths
- x/y coordinates
- repeated CSS
- icon path data
- long HTML documents
- pan/zoom JavaScript
- PNG conversion code per task

Claude should normally produce only a compact `VisualSpec`.

---

## 2. Today’s scope: V0.1

Today we build only what is required for a useful local product.

### Build today

1. One Node.js + TypeScript repository.
2. YAML/JSON `VisualSpec` input.
3. Schema validation.
4. Automatic engine routing.
5. D2 engine for architecture/flow diagrams.
6. SVG.js engine for custom infographic layouts.
7. Lucide icon resolution.
8. SVGO optimization.
9. SVG → PNG export.
10. Static responsive HTML wrapper.
11. A small CLI.
12. 3–4 example specs and smoke tests.

### Do **not** build today

- MCP server
- Claude Skill
- Claude Code plugin
- Visual editor / Studio
- React / Vue / Next.js
- database
- authentication
- Docker
- monorepo
- cloud deployment
- advanced drag/drop editor
- advanced automatic accessibility engine
- complex breakpoint-specific reflow

These are later adapters/features. They must not delay V0.1.

---

## 3. Technology decisions

### Runtime

- **Node.js 22+**
- **TypeScript**
- **ESM**
- npm

### CLI

Use Node's built-in `util.parseArgs`.

**No Commander/Yargs dependency in V0.1.**

### VisualSpec input

- YAML as the preferred human/Claude format
- JSON also accepted

Libraries:

- `yaml` — YAML parsing
- `zod` — runtime schema validation

### Diagram engine

**D2**

Used for:

- architecture
- flow
- sequence-style technical diagrams
- graph-like system maps

D2 is installed as a local Windows executable and called as a child process.

VisualStruct generates temporary `.d2` source internally. Claude does not need to write D2 directly.

### Infographic engine

**SVG.js + svgdom**

Packages:

- `@svgdotjs/svg.js`
- `svgdom`

Used for:

- project overview
- technology stack infographic
- comparison
- cards/sections/badges
- custom portfolio visuals

`svgdom` provides the headless DOM required to run SVG.js in Node.

### Icons

**Lucide**

Preferred package:

- `@lucide/icons`

VisualSpec uses only semantic names:

```yaml
icon: database
```

The renderer resolves the SVG path locally.

### SVG optimization

**SVGO**

Package:

- `svgo`

All generated SVG files pass through SVGO before final output.

### PNG export

**resvg-js**

Package:

- `@resvg/resvg-js`

Used locally for SVG → PNG.

### HTML output

**Eta**

Package:

- `eta`

Used only as a lightweight HTML template engine.

The HTML renderer wraps the optimized SVG in a responsive standalone page.

### Interactive HTML

**Panzoom** is planned, but not required to block V0.1.

When enabled later, it will provide:

- wheel zoom
- drag pan
- touch pinch
- reset/fit controls

Static responsive HTML must work before Panzoom is added.

---

## 4. Dependency set

### V0.1 runtime dependencies

```text
yaml
zod
@svgdotjs/svg.js
svgdom
@lucide/icons
svgo
@resvg/resvg-js
eta
```

### External executable

```text
D2
```

### V0.1 development dependencies

```text
typescript
tsx
@types/node
vitest
```

### Deliberately excluded

```text
React
Vue
Next.js
Tailwind
Bootstrap
Mermaid
PlantUML
Graphviz
ELK.js as a separate dependency
Excalidraw
Docker
```

They can be reconsidered only when a concrete missing capability appears.

---

## 5. Core data flow

```text
visual.yaml / visual.json
          │
          ▼
     Spec Loader
          │
          ▼
    Zod Validator
          │
          ▼
     Normalizer
          │
          ▼
    Engine Router
      │        │
      │        │
      ▼        ▼
     D2      SVG.js
 diagram   infographic
      │        │
      └───┬────┘
          ▼
       Raw SVG
          │
          ▼
        SVGO
          │
          ▼
    Optimized SVG
       │    │    │
       │    │    └────────► Eta ► HTML
       │    │
       │    └─────────────► resvg-js ► PNG
       │
       └──────────────────► SVG
```

---

## 6. VisualSpec design

VisualSpec must remain compact, semantic and stable.

Example:

```yaml
v: 1
type: architecture
title: SaveFold

theme: technical-light
responsive: true

nodes:
  web:
    label: Web
    tech: Vite
    icon: monitor
  api:
    label: API
    tech: Node.js
    icon: server
  db:
    label: Database
    tech: MySQL
    icon: database

flow:
  - web>api>db

output:
  formats: [svg, png, html]
```

### VisualSpec rules

1. No coordinates by default.
2. No raw SVG.
3. No SVG path data.
4. No repeated CSS.
5. Use semantic IDs.
6. Use named themes.
7. Use named templates.
8. Layout decisions stay local.

---

## 7. Engine routing

The router chooses the renderer automatically.

### D2 engine

```text
architecture
flow
system-map
data-flow
sequence
```

### SVG.js engine

```text
infographic
project-overview
stack
comparison
timeline
roadmap
```

### Example

```ts
if (D2_TYPES.has(spec.type)) {
  return renderWithD2(spec)
}

return renderWithSvgJs(spec)
```

The caller should not normally need to choose the engine manually.

---

## 8. Design system

VisualStruct owns visual consistency locally.

```text
src/design/
├── tokens.ts
├── themes.ts
├── typography.ts
└── responsive.ts
```

### Tokens

Store reusable rules for:

- colors
- typography
- spacing
- radius
- borders
- shadows
- icon sizes
- connector styles

### Initial themes

```text
technical-light
technical-dark
minimal-light
portfolio
```

Claude should only need:

```yaml
theme: technical-light
```

A theme is a set of local decisions, not a large prompt.

---

## 9. Responsive behavior

### V0.1

Every SVG must have a valid `viewBox`.

HTML wrapper:

```css
.visualstruct {
  width: 100%;
  overflow: auto;
}

.visualstruct svg {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
}
```

Large diagrams may horizontally scroll rather than become unreadably small.

### V0.2+

Add semantic responsive reflow:

```text
desktop: horizontal groups
mobile: stacked groups
```

Do not duplicate the whole VisualSpec for mobile.

---

## 10. HTML architecture

HTML is an output format, not the main application.

```text
Optimized SVG
     │
     ▼
Eta template
     │
     ▼
Standalone HTML
```

Initial template:

```text
src/templates/basic.eta
```

Features:

- responsive wrapper
- title/meta
- optional background
- inline optimized SVG
- no external CDN requirement

Later interactive mode may add Panzoom locally.

---

## 11. CLI

V0.1 command surface must stay small.

```bash
visualstruct render examples/savefold.yaml
visualstruct validate examples/savefold.yaml
visualstruct doctor
```

Optional flags:

```bash
--format svg
--format svg,png,html
--out ./output
--theme technical-light
```

### `doctor`

Checks only essentials:

- Node version
- D2 availability
- output directory write access

Example:

```text
VisualStruct Doctor
Node 22.x        OK
D2               OK
Output            OK
```

---

## 12. Suggested repository structure

Keep V0.1 as **one package**, not a monorepo.

```text
visualstruct/
├── src/
│   ├── cli.ts
│   ├── types.ts
│   │
│   ├── core/
│   │   ├── load-spec.ts
│   │   ├── schema.ts
│   │   ├── normalize.ts
│   │   ├── router.ts
│   │   └── render.ts
│   │
│   ├── engines/
│   │   ├── d2.ts
│   │   └── svgjs.ts
│   │
│   ├── design/
│   │   ├── tokens.ts
│   │   ├── themes.ts
│   │   └── responsive.ts
│   │
│   ├── icons/
│   │   └── lucide.ts
│   │
│   ├── outputs/
│   │   ├── optimize-svg.ts
│   │   ├── png.ts
│   │   └── html.ts
│   │
│   ├── templates/
│   │   └── basic.eta
│   │
│   └── qa/
│       └── basic.ts
│
├── examples/
│   ├── architecture.yaml
│   ├── infographic.yaml
│   └── comparison.yaml
│
├── tests/
│   ├── schema.test.ts
│   └── render.test.ts
│
├── output/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── VISUALSTRUCT_MASTER_ARCHITECTURE.md
```

---

## 13. V0.1 execution sequence

Implementation order is intentionally optimized for speed.

### Phase A — Skeleton

1. `npm init`
2. TypeScript + `tsx`
3. Create directories
4. Add `.gitignore`
5. Add package scripts

### Phase B — Spec

1. Define Zod schema
2. Load YAML/JSON
3. Normalize defaults
4. Add `validate`

### Phase C — SVG.js path

1. Initialize `svgdom`
2. Create one infographic renderer
3. Resolve one Lucide icon
4. Produce SVG
5. Optimize with SVGO

This gives the first working VisualStruct output quickly.

### Phase D — D2 path

1. `doctor` detects D2
2. Convert architecture VisualSpec → temporary D2 text
3. Call D2 CLI
4. Read resulting SVG
5. Optimize SVG

### Phase E — outputs

1. Save SVG
2. PNG via resvg-js
3. HTML via Eta

### Phase F — smoke tests

Verify:

```text
YAML → SVG          PASS
YAML → PNG          PASS
YAML → HTML         PASS
architecture → D2   PASS
invalid spec        FAILS CLEANLY
```

Then stop V0.1 work.

---

## 14. Definition of Done for today

V0.1 is complete when all of these work locally:

```bash
npm install
npm run doctor
npm run validate -- examples/architecture.yaml
npm run render -- examples/architecture.yaml
npm run render -- examples/infographic.yaml
```

Expected output:

```text
output/
├── architecture.svg
├── architecture.png
├── architecture.html
├── infographic.svg
├── infographic.png
└── infographic.html
```

And:

- SVG opens correctly in browser.
- PNG renders correctly.
- HTML is responsive.
- No generated raw SVG is returned to Claude.
- Claude only needs VisualSpec input for normal use.

---

## 15. Later integration architecture

Only after V0.1 is stable:

```text
                    Claude Code
                         │
                  VisualStruct Skill
                         │
                         ▼
                  VisualStruct MCP
                         │
                         ▼
                  VisualStruct Core
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
           SVG          PNG          HTML
```

### MCP V0.2/V0.3

Keep the MCP surface tiny:

```text
visual_render
visual_validate
visual_templates
visual_preview
```

MCP responses return metadata and file paths, **never the entire SVG source** unless explicitly requested.

Example response:

```json
{
  "ok": true,
  "files": [
    "output/savefold.svg",
    "output/savefold.png",
    "output/savefold.html"
  ],
  "warnings": []
}
```

### Skill

The skill should teach Claude only these rules:

1. Prefer VisualStruct for technical visuals.
2. Generate the smallest valid VisualSpec.
3. Never manually generate SVG if VisualStruct can render it.
4. Do not calculate coordinates.
5. Do not read generated SVG back into context unless debugging requires it.
6. Use preview only for visual QA.

### Plugin

After MCP + Skill are stable, package them as a Claude Code plugin for reuse across projects.

---

## 16. Distribution model

VisualStruct remains an independent GitHub repository.

```text
GitHub
  └── visualstruct
       │
       ├── Core
       ├── CLI
       ├── later: MCP
       └── later: Skill/plugin
```

Other projects do **not** copy the source code.

They use one installed VisualStruct instance.

Optional per-project config later:

```text
.visualstruct.yaml
```

Example:

```yaml
theme: portfolio
output: docs/visuals
```

---

## 17. Token-efficiency rules

These are architectural requirements.

### Rule 1 — Semantic input

Prefer:

```yaml
flow:
  - web>api>db
```

instead of verbose drawing instructions.

### Rule 2 — Local defaults

Claude should not repeat:

- font sizes
- padding
- margins
- colors
- icon paths
- border radii
- breakpoint rules

### Rule 3 — File-path outputs

Tools return:

```text
output/savefold.svg
```

not the complete SVG text.

### Rule 4 — Templates before free drawing

Use named templates whenever possible.

### Rule 5 — Preview only when needed

Do not ask Claude to inspect every output.

### Rule 6 — Deterministic work stays local

Layout, rendering, conversion, optimization and wrapping are local jobs.

Claude is reserved for semantic decisions.

---

## 18. Non-goals

VisualStruct V0.1 is not:

- Canva
- Figma
- a browser design editor
- an AI image generator
- a general website builder
- a presentation editor

It is a fast local compiler for structured technical visuals.

---

## 19. Final V0.1 architecture

```text
                       VisualSpec YAML/JSON
                              │
                              ▼
                     Loader + Zod Schema
                              │
                              ▼
                         Normalizer
                              │
                              ▼
                         Type Router
                         │         │
              ┌──────────┘         └──────────┐
              ▼                               ▼
             D2                         SVG.js + svgdom
      architecture/flow                 infographic
              │                               │
              └──────────────┬────────────────┘
                             ▼
                     Lucide when needed
                             │
                             ▼
                         Raw SVG
                             │
                             ▼
                           SVGO
                             │
                             ▼
                      Optimized SVG
                    ┌────────┼─────────┐
                    ▼        ▼         ▼
                   SVG    resvg-js    Eta
                            │          │
                            ▼          ▼
                           PNG        HTML
```

**Design target:** one small VisualSpec in, polished reusable local assets out.

---

## 20. Architecture freeze for V0.1

Before adding any dependency or subsystem, ask:

> Does this solve a concrete V0.1 problem that the current stack cannot solve simply?

If not, do not add it.

This keeps VisualStruct fast to build, easy to maintain and cheap to use with Claude.
