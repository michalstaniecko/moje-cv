/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generateBlocks } from '../../domain/blocks'
import { sampleCvs } from '../../domain/sampleCv'
import { pageMetricsPx, PX_PER_MM } from '../../domain/templateGeometry'
import { selectorsOf } from '../testCss'
import { boldTemplate } from '.'

describe('Bold template', () => {
  it('has a 180 × 269 mm content area and a 6 mm consent gap', () => {
    const metrics = pageMetricsPx(boldTemplate.geometry)
    expect(metrics.contentWidth).toBeCloseTo(180 * PX_PER_MM)
    expect(metrics.contentHeight).toBeCloseTo(269 * PX_PER_MM)
    expect(metrics.consentGap).toBeCloseTo(6 * PX_PER_MM)
  })

  it('spaces the sample CV blocks as the design says, with list titles above lists in two columns', () => {
    const blocks = generateBlocks(sampleCvs.en, boldTemplate.geometry)
    const bullets = (entry: string, count: number, last: number) =>
      Array.from({ length: count }, (_, index) => [`${entry}:${entry}-b${index + 2}`, index === count - 1 ? last : 0.8])
    // Odstępy zaokrąglone do 0,01 mm – sumy odstępów w mm nie są dokładne w liczbach zmiennoprzecinkowych.
    expect(blocks.map((block) => [block.id, Math.round(block.spaceAfterMm * 100) / 100])).toEqual([
      ['header', 7],
      ['experience:title', 3.2],
      ['e1', 0.8],
      ...bullets('e1', 7, 5.3),
      ['e2', 0.8],
      ...bullets('e2', 6, 5.3),
      ['e3', 0.8],
      ...bullets('e3', 4, 5.3),
      ['e4', 0.8],
      ...bullets('e4', 3, 7),
      ['education:title', 3.2],
      ['ed1', 2.4],
      ['ed2', 7],
      ['skills:title', 3.2],
      ['skills:s1', 1.2],
      ['skills:s3', 1.2],
      ['skills:s5', 7],
      ['languages:title', 3.2],
      ['languages:l1', 0]
    ])
  })

  it('styles only a document rendered in the Bold template', () => {
    const selectors = selectorsOf(readFileSync(new URL('./bold.css', import.meta.url), 'utf8'))
    expect(selectors.length).toBeGreaterThan(0)
    const scope = `.${boldTemplate.className}`
    const unscoped = selectors.filter((selector) => selector !== scope && !selector.startsWith(`${scope} `))
    expect(unscoped).toEqual([])
  })
})
