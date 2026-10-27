/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generateBlocks } from '../../domain/blocks'
import { sampleCvs } from '../../domain/sampleCv'
import { pageMetricsPx, PX_PER_MM } from '../../domain/templateGeometry'
import { selectorsOf } from '../testCss'
import { classicTemplate } from '.'

describe('Classic template', () => {
  it('has a 182 × 275 mm content area and a 6 mm consent gap', () => {
    const metrics = pageMetricsPx(classicTemplate.geometry)
    expect(metrics.contentWidth).toBeCloseTo(182 * PX_PER_MM)
    expect(metrics.contentHeight).toBeCloseTo(275 * PX_PER_MM)
    expect(metrics.consentGap).toBeCloseTo(6 * PX_PER_MM)
  })

  it('spaces the sample CV blocks as the brief says', () => {
    const blocks = generateBlocks(sampleCvs.en, classicTemplate.geometry)
    expect(blocks.map((block) => [block.id, block.spaceAfterMm])).toEqual([
      ['header', 6],
      ['experience:title', 3],
      ['e1', 0.6],
      ['e1:e1-b2', 0.6],
      ['e1:e1-b3', 0.6],
      ['e1:e1-b4', 0.6],
      ['e1:e1-b5', 0.6],
      ['e1:e1-b6', 0.6],
      ['e1:e1-b7', 0.6],
      ['e1:e1-b8', 5.6],
      ['e2', 0.6],
      ['e2:e2-b2', 0.6],
      ['e2:e2-b3', 0.6],
      ['e2:e2-b4', 0.6],
      ['e2:e2-b5', 0.6],
      ['e2:e2-b6', 0.6],
      ['e2:e2-b7', 5.6],
      ['e3', 0.6],
      ['e3:e3-b2', 0.6],
      ['e3:e3-b3', 0.6],
      ['e3:e3-b4', 0.6],
      ['e3:e3-b5', 5.6],
      ['e4', 0.6],
      ['e4:e4-b2', 0.6],
      ['e4:e4-b3', 0.6],
      ['e4:e4-b4', 6],
      ['education:title', 3],
      ['ed1', 2],
      ['ed2', 6],
      ['skills:s1', 0.6],
      ['skills:s2', 0.6],
      ['skills:s3', 0.6],
      ['skills:s4', 0.6],
      ['skills:s5', 4.6],
      ['languages:l1', 0.6],
      ['languages:l2', 0]
    ])
  })

  it('styles only a document rendered in the Classic template', () => {
    const selectors = selectorsOf(readFileSync(new URL('./classic.css', import.meta.url), 'utf8'))
    expect(selectors.length).toBeGreaterThan(0)
    const scope = `.${classicTemplate.className}`
    const unscoped = selectors.filter((selector) => selector !== scope && !selector.startsWith(`${scope} `))
    expect(unscoped).toEqual([])
  })
})
