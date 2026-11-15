import { describe, expect, it } from 'vitest'
import { generateBlocks, type Reveal } from './blocks'
import { blocksToMeasureForPreview } from './previewSplit'
import { sampleCvs } from './sampleCv'
import type { CvDocument, Section } from './schema'
import { testGeometry } from './testGeometry'

// Bloki Preview mode, których wysokości nie da się wziąć z pomiaru stron Edit mode z odsłoniętym fragmentem.
const toMeasure = (document: CvDocument, reveal: Reveal) =>
  blocksToMeasureForPreview(generateBlocks(document, testGeometry), generateBlocks(document, testGeometry, { reveal }), reveal).map(
    (block) => block.id
  )

const sample = sampleCvs.en
const withSection = (id: string, update: (section: Section) => Section): CvDocument => ({
  ...sample,
  sections: sample.sections.map((section) => (section.id === id ? update(section) : section))
})
type ExperienceSection = Extract<Section, { type: 'experience' }>
const withExperience = (update: (section: ExperienceSection) => ExperienceSection) =>
  withSection('experience', (section) => update(section as ExperienceSection))

describe('blocksToMeasureForPreview', () => {
  it('needs nothing measured anew when no part of the CV is revealed', () => {
    expect(toMeasure(sample, new Set())).toEqual([])
  })

  it('measures anew every block of a revealed entry, also those that look the same as in Preview mode', () => {
    const document = withExperience((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === 'e4' ? { ...item, location: '', bullets: [...item.bullets, { id: 'empty', text: '' }] } : item
      )
    }))
    expect(toMeasure(document, new Set(['item:e4']))).toEqual(['e4', 'e4:e4-b2', 'e4:e4-b3', 'e4:e4-b4'])
  })

  it('measures anew the blocks of other entries that a revealed empty entry changes', () => {
    // Pusty wpis za ostatnim: w Edit mode e4 nie jest już ostatnim wpisem sekcji (inna dekoracja szablonu).
    const empty = { ...sample.sections[0]!.items[0]!, id: 'e5', role: '', company: '', location: '', start: null, end: null, bullets: [] }
    const document = withExperience((section) => ({ ...section, items: [...section.items, empty] as ExperienceSection['items'] }))
    expect(toMeasure(document, new Set(['item:e5']))).toEqual(['e4', 'e4:e4-b2', 'e4:e4-b3', 'e4:e4-b4'])
  })

  it('measures anew the header when a part of it is revealed', () => {
    const document = { ...sample, header: { ...sample.header, summary: '' } }
    expect(toMeasure(document, new Set(['summary']))).toEqual(['header'])
  })

  it('measures anew the first row of a list section with its title beside the list when the title is revealed', () => {
    const document = withSection('skills', (section) => ({ ...section, title: '' }))
    expect(toMeasure(document, new Set(['sectionTitle:skills']))).toEqual(['skills:s1'])
  })
})
