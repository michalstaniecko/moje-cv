import { describe, expect, it } from 'vitest'
import { generateBlocks } from './blocks'
import { sampleCvs } from './sampleCv'
import { withSpacing } from './testGeometry'

// Odstępy sprawdzane niżej (reszta z geometrii testowej).
const spacing = withSpacing({
  afterHeader: 10,
  beforeSectionTitle: 12,
  afterSectionTitle: 3,
  betweenBullets: 1,
  afterExperienceItem: 8,
  afterEducationItem: 2,
  afterEducationSection: 7,
  betweenListItems: 0.5,
  afterListSection: 4
})

const spaceAfter = (blocks: ReturnType<typeof generateBlocks>, id: string) =>
  blocks.find((block) => block.id === id)?.spaceAfterMm

describe('generateBlocks', () => {
  it('takes the spacing between blocks from the template geometry', () => {
    const blocks = generateBlocks(sampleCvs.en, spacing)
    // Po nagłówku 10 mm, ale przed tytułem sekcji 12 mm – liczy się większy odstęp.
    expect(spaceAfter(blocks, 'header')).toBe(12)
    expect(spaceAfter(blocks, 'experience:title')).toBe(3)
    expect(spaceAfter(blocks, 'e1')).toBe(1)
    // Ostatni punkt wpisu: odstęp między punktami + odstęp po wpisie.
    expect(spaceAfter(blocks, 'e1:e1-b8')).toBe(9)
    expect(spaceAfter(blocks, 'ed1')).toBe(2)
    expect(spaceAfter(blocks, 'ed2')).toBe(7)
    expect(spaceAfter(blocks, 'skills:s1')).toBe(0.5)
    expect(spaceAfter(blocks, 'skills:s5')).toBe(4.5)
    // Ostatni blok dokumentu nie ma odstępu.
    expect(spaceAfter(blocks, 'languages:l2')).toBe(0)
  })
})
