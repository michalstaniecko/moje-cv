/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generateBlocks } from '../../domain/blocks'
import { sampleCvs } from '../../domain/sampleCv'
import { pageMetricsPx, PX_PER_MM } from '../../domain/templateGeometry'
import { selectorsOf } from '../testCss'
import { modernTemplate } from '.'

describe('Modern template', () => {
  it('has a 180 × 271 mm content area and a 6 mm consent gap', () => {
    const metrics = pageMetricsPx(modernTemplate.geometry)
    expect(metrics.contentWidth).toBeCloseTo(180 * PX_PER_MM)
    expect(metrics.contentHeight).toBeCloseTo(271 * PX_PER_MM)
    expect(metrics.consentGap).toBeCloseTo(6 * PX_PER_MM)
  })

  it('spaces the sample CV blocks as the design says, with list titles above lists in two columns', () => {
    const blocks = generateBlocks(sampleCvs.en, modernTemplate.geometry)
    const bullets = (entry: string, count: number, last: number) =>
      Array.from({ length: count }, (_, index) => [`${entry}:${entry}-b${index + 2}`, index === count - 1 ? last : 0.8])
    expect(blocks.map((block) => [block.id, block.spaceAfterMm])).toEqual([
      ['header', 6],
      ['experience:title', 3],
      ['e1', 0.8],
      ...bullets('e1', 7, 5),
      ['e2', 0.8],
      ...bullets('e2', 6, 5),
      ['e3', 0.8],
      ...bullets('e3', 4, 5),
      ['e4', 0.8],
      ...bullets('e4', 3, 6),
      ['education:title', 3],
      ['ed1', 2],
      ['ed2', 6],
      ['skills:title', 3],
      ['skills:s1', 1],
      ['skills:s3', 1],
      ['skills:s5', 6],
      ['languages:title', 3],
      ['languages:l1', 0]
    ])
  })

  it('styles only a document rendered in the Modern template', () => {
    const selectors = selectorsOf(readFileSync(new URL('./modern.css', import.meta.url), 'utf8'))
    expect(selectors.length).toBeGreaterThan(0)
    const scope = `.${modernTemplate.className}`
    const unscoped = selectors.filter((selector) => selector !== scope && !selector.startsWith(`${scope} `))
    expect(unscoped).toEqual([])
  })
})
