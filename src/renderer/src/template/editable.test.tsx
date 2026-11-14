import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { generateBlocks, type CvBlock } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument } from '../domain/schema'
import { CvBlockView } from './CvBlockView'
import { EditingProvider, type PageEditing, type PageFieldProps, type SlotName } from './editable'
import { templates } from './templates'

// Sloty w trybie edycji (docs/specs/wysiwyg-editing.md, W2, W9, W10): osobne pola z kluczem, placeholder tylko
// w odsłoniętym fragmencie. Tryb dokumentu sprawdza goldenMarkup.test.tsx.

function Field({ field, text, measuring }: PageFieldProps) {
  return (
    <span data-field-key={field.key} data-measuring={measuring || undefined} data-placeholder={field.placeholder}>
      {text}
    </span>
  )
}

// Edycja testowa: pole dla każdego slotu nagłówka i tytułu (wiersz listy – tylko pierwszy), fragment = nazwa slotu
// albo `sectionTitle:<id>`.
function editingWith(reveal: string[] = []): PageEditing {
  return {
    fieldOf: (block: CvBlock, slot: SlotName) => {
      if (block.kind === 'header' && slot !== 'title') return { key: `header:${slot}`, fragment: slot, label: slot, placeholder: slot, spellcheck: false }
      if (slot !== 'title') return null
      const sectionId = block.id.split(':')[0]!
      if (block.kind === 'listRow' && !/:(s1|l1)$/.test(block.id)) return null
      return { key: `section:${sectionId}:title`, fragment: `sectionTitle:${sectionId}`, label: 'Title', placeholder: 'Title', spellcheck: true }
    },
    reveal: new Set(reveal),
    Field,
    onPagesCommitted: () => {}
  }
}

function render(document: CvDocument, templateId: keyof typeof templates, editing: PageEditing, { measuring = false } = {}) {
  const template = templates[templateId]
  const blocks = generateBlocks(document, template.geometry, { reveal: editing.reveal })
  const html = blocks
    .map((block) =>
      renderToStaticMarkup(
        <EditingProvider value={{ editing, measuring, listSectionLayout: template.geometry.listSectionLayout }}>
          <CvBlockView block={block} views={template.blockViews} />
        </EditingProvider>
      )
    )
    .join('\n')
  // Bez DOM w testach: pola jako [klucz, tekst] w kolejności markupu.
  const fields = [...html.matchAll(/<span data-field-key="([^"]+)"( data-measuring="true")?[^>]*>([^<]*)<\/span>/g)].map(
    ([, key, measuring, text]) => ({ key: key!, text: text!, measuring: measuring !== undefined })
  )
  return { html, fields, keys: fields.map((field) => field.key) }
}

const emptyHeader: CvDocument = {
  ...sampleCvs.en,
  header: { ...sampleCvs.en.header, fullName: '', summary: '', photo: null },
  sections: sampleCvs.en.sections.map((section) => ({ ...section, title: '' }))
}

const titles = ['experience', 'education', 'skills', 'languages'].map((id) => `section:${id}:title`)

describe('editing slots', () => {
  for (const templateId of Object.keys(templates) as (keyof typeof templates)[]) {
    it(`draw the name, the summary and the section titles as fields in the ${templateId} template`, () => {
      const page = render(sampleCvs.en, templateId, editingWith())
      expect(page.html).toContain('<h1 class="cv-name"><span data-field-key="header:fullName" data-placeholder="fullName">Jane Example</span></h1>')
      expect(page.html).toMatch(/<p class="cv-summary"><span data-field-key="header:summary"/)
      expect(page.html).toMatch(/<h2 class="cv-section-title"><span data-field-key="section:experience:title"/)
      expect(page.keys).toEqual(['header:fullName', 'header:summary', ...titles])
      expect(page.fields[0]!.text).toBe('Jane Example')
    })

    it(`draws empty fields only in a revealed fragment, in the ${templateId} template`, () => {
      const idle = render(emptyHeader, templateId, editingWith())
      expect(idle.keys).toEqual([])
      expect(idle.html).not.toMatch(/cv-name|cv-summary|cv-section-title/)

      expect(render(emptyHeader, templateId, editingWith(['fullName'])).fields).toEqual([
        { key: 'header:fullName', text: '', measuring: false }
      ])
      expect(render(emptyHeader, templateId, editingWith(['sectionTitle:experience', 'sectionTitle:skills'])).fields).toEqual([
        { key: 'section:experience:title', text: '', measuring: false },
        { key: 'section:skills:title', text: '', measuring: false }
      ])
    })
  }

  it('draw the measuring copy with the same fields, marked as measuring', () => {
    const page = render(sampleCvs.en, 'modern', editingWith(), { measuring: true })
    expect(page.fields.map((field) => field.measuring)).toEqual(Array(6).fill(true))
  })

  it('keep the title out of the list rows when the Template draws it above the list', () => {
    const page = render(sampleCvs.en, 'bold', editingWith())
    expect(page.html.split('\n').filter((block) => block.includes('data-block="listRow"') && block.includes('data-field-key'))).toEqual([])
  })
})
