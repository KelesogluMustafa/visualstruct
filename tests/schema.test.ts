import { describe, expect, it } from 'vitest'
import { loadSpec, parseSpec } from '../src/core/load-spec.js'
import { normalize } from '../src/core/normalize.js'
import { prepareSpec } from '../src/core/render.js'
import { routeEngine } from '../src/core/router.js'
import { validateSpec } from '../src/core/schema.js'
import { VisualStructError } from '../src/types.js'

const minimal = { v: 1, type: 'architecture', title: 'Demo', flow: ['web>api>db'] }

function failure(input: unknown): VisualStructError {
  try {
    validateSpec(input)
  } catch (error) {
    if (error instanceof VisualStructError) return error
    throw error
  }
  throw new Error('expected validation to fail')
}

describe('loading', () => {
  it('loads the YAML examples', async () => {
    for (const name of ['architecture', 'infographic', 'comparison']) {
      const spec = prepareSpec(await loadSpec(`examples/${name}.yaml`))
      expect(spec.type).toBe(name)
    }
  })

  it('accepts JSON as well as YAML', () => {
    expect(parseSpec(JSON.stringify(minimal), 'json')).toEqual(minimal)
    expect(parseSpec('v: 1\ntype: architecture\ntitle: Demo\nflow: [web>api>db]')).toEqual(minimal)
  })

  it('reports missing files and broken syntax as clean errors', async () => {
    await expect(loadSpec('examples/nope.yaml')).rejects.toMatchObject({ code: 'SPEC_NOT_FOUND' })
    expect(() => parseSpec('{ "v": 1,', 'json')).toThrow(VisualStructError)
    expect(() => parseSpec('title: [unclosed')).toThrow(VisualStructError)
  })
})

describe('validation', () => {
  it('passes a valid spec', () => {
    expect(validateSpec(minimal).title).toBe('Demo')
  })

  it('fails cleanly with a path for each problem', () => {
    const error = failure({ v: 2, type: 'pie', title: '' })
    expect(error.code).toBe('SPEC_INVALID')
    expect(error.details.map((detail) => detail.split(':')[0])).toEqual(expect.arrayContaining(['v', 'type', 'title']))
  })

  it('rejects drawing instructions: coordinates, raw SVG and unknown keys', () => {
    const withCoords = { ...minimal, nodes: { web: { label: 'Web', x: 10, y: 20 } } }
    expect(failure(withCoords).details.join('\n')).toContain('nodes.web')
    expect(failure({ ...minimal, svg: '<svg/>' }).code).toBe('SPEC_INVALID')
    expect(failure({ ...minimal, nodes: { web: { icon: '<path d="M0 0"/>' } } }).details.join('\n')).toContain('Lucide')
  })

  it('checks type-specific requirements', () => {
    expect(failure({ v: 1, type: 'architecture', title: 'T' }).details[0]).toContain('nodes')
    expect(failure({ v: 1, type: 'infographic', title: 'T' }).details[0]).toContain('sections')
    expect(failure({ ...minimal, flow: ['web'] }).details[0]).toContain('flow.0')
    const uneven = { v: 1, type: 'comparison', title: 'T', columns: ['A', 'B'], rows: [['Label', 'only one']] }
    expect(failure(uneven).details[0]).toContain('rows.0')
    expect(failure({ ...minimal, nodes: { web: { group: 'ghost' } } }).details[0]).toContain('unknown group')
  })
})

describe('normalization and routing', () => {
  it('fills defaults and expands the compact flow syntax', () => {
    const spec = normalize(validateSpec({ ...minimal, nodes: { web: 'Web app' }, flow: ['web>api>db: reads'] }))
    expect(spec.theme).toBe('technical-light')
    expect(spec.responsive).toBe(true)
    expect(spec.output.formats).toEqual(['svg', 'png', 'html'])
    expect(spec.nodes.map((node) => node.label)).toEqual(['Web app', 'api', 'db'])
    expect(spec.edges).toEqual([
      { from: 'web', to: 'api', label: 'reads' },
      { from: 'api', to: 'db', label: 'reads' },
    ])
    expect(spec.warnings).toHaveLength(2)
  })

  it('routes diagram types to D2 and everything else to SVG.js', () => {
    expect(routeEngine('architecture')).toBe('d2')
    expect(routeEngine('flow')).toBe('d2')
    expect(routeEngine('infographic')).toBe('svgjs')
    expect(routeEngine('comparison')).toBe('svgjs')
  })
})
