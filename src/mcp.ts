import { readFileSync } from 'node:fs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { loadSpec, parseSpec } from './core/load-spec.js'
import { prepareSpec, renderFile, renderSpec } from './core/render.js'
import { routeEngine } from './core/router.js'
import { FORMATS, THEME_NAMES, VisualStructError, type Engine, type VisualType } from './types.js'

/** Thin adapter: every tool call is forwarded to the core. No render logic lives here. */

const visualRenderInput = {
  spec: z.string().min(1).optional().describe('Inline VisualSpec as YAML or JSON text'),
  spec_path: z.string().min(1).optional().describe('Path to a VisualSpec file, instead of "spec"'),
  out_dir: z.string().min(1).optional().describe('Output directory; use an absolute path'),
  name: z
    .string()
    .regex(/^[\w.-]+$/)
    .optional()
    .describe('Output file name without extension'),
  formats: z.array(z.enum(FORMATS)).min(1).optional(),
  theme: z.enum(THEME_NAMES).optional(),
  validate_only: z.boolean().optional().describe('Check the spec without writing files'),
}

export type VisualRenderArgs = z.infer<z.ZodObject<typeof visualRenderInput>>

/** Paths and small metadata only. Rendered SVG/HTML/PNG content is never returned. */
export type VisualRenderResult =
  | { ok: true; engine: Engine; files: string[]; warnings: string[] }
  | { ok: true; valid: true; type: VisualType; engine: Engine; warnings: string[] }
  | { ok: false; code: string; message: string; errors: string[] }

export async function visualRender(args: VisualRenderArgs): Promise<VisualRenderResult> {
  try {
    const { spec, spec_path: specPath } = args
    if ((spec === undefined) === (specPath === undefined)) {
      throw new VisualStructError('USAGE', 'Provide exactly one of "spec" or "spec_path"')
    }
    const inline = spec === undefined ? undefined : { input: parseSpec(spec) }

    if (args.validate_only) {
      const prepared = prepareSpec(inline ? inline.input : await loadSpec(specPath ?? ''), { theme: args.theme })
      return { ok: true, valid: true, type: prepared.type, engine: routeEngine(prepared.type), warnings: prepared.warnings }
    }

    const options = { outDir: args.out_dir, name: args.name, formats: args.formats, theme: args.theme }
    const result = inline ? await renderSpec(inline.input, options) : await renderFile(specPath ?? '', options)
    return {
      ok: true,
      engine: result.engine,
      files: result.files.map((file) => file.replaceAll('\\', '/')),
      warnings: result.warnings,
    }
  } catch (error) {
    if (error instanceof VisualStructError) {
      return { ok: false, code: error.code, message: error.message, errors: error.details }
    }
    return { ok: false, code: 'INTERNAL', message: (error as Error).message, errors: [] }
  }
}

export function createMcpServer(): McpServer {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const server = new McpServer({ name: 'visualstruct', version })

  server.registerTool(
    'visual_render',
    {
      description:
        'Render a VisualSpec (YAML/JSON) to SVG/PNG/HTML files locally. Returns file paths and warnings only, never file contents.',
      inputSchema: visualRenderInput,
    },
    async (args) => {
      const result = await visualRender(args)
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !result.ok }
    },
  )
  return server
}

/** Serves MCP over stdio. stdout belongs to the protocol, so nothing else may write to it. */
export async function runMcpServer(): Promise<void> {
  await createMcpServer().connect(new StdioServerTransport())
}
