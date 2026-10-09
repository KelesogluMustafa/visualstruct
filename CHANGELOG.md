# Changelog

## 0.3.4

- New: `VisualStruct-Windows-Setup-<version>.zip` on each release. It contains the installer,
  the prebuilt package and the Claude Desktop files, so VisualStruct can be installed without
  cloning the repository. Node.js 22+ is still required; D2 only for the diagram types
- `install.ps1` detects the Setup folder and installs from the bundled package; installing
  from a checkout works as before
- `npm run release:pack` builds the Setup ZIP and `SHA256SUMS.txt` for all release files
- CI on GitHub Actions (Windows and Ubuntu): typecheck, tests, build and release packaging
- README rewritten around what, why and quick start; integration details moved to
  `docs/INTEGRATIONS.md`
- No change to rendering, the VisualSpec format, the CLI or the MCP tool

## 0.3.3

- ChatGPT and Codex Desktop plugin archive (`visualstruct-chatgpt-plugin.zip`)
- Plugin release packaging aligned across Claude Code, Claude Desktop and ChatGPT

## 0.3.1

- Simplified Windows installer (`install.ps1`) with `cli`, `code`, `desktop` and `both` modes
- Versioned runtime in the user profile that does not depend on the checkout or on `npm link`
- Claude Desktop extension (`.mcpb`) and installable skill archive

## 0.3.0

- Vector PDF, PowerPoint PPTX and Word DOCX export from the same master SVG

## 0.2.0

- First tagged version: VisualSpec (YAML/JSON) to SVG, PNG and HTML with the D2 and SVG.js
  engines, Lucide icons, SVGO optimization and four themes
