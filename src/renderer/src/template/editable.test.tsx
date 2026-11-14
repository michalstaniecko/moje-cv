import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { generateBlocks, type CvBlock } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument, EducationItem, ExperienceItem, Section } from '../domain/schema'
import { CvBlockView } from './CvBlockView'
import { EditingProvider, type EditableField, type PageEditing, type PageFieldProps, type SlotName } from './editable'
import { templates } from './templates'

// Sloty w trybie edycji (docs/specs/wysiwyg-editing.md, W2, W9, W10): osobne pola z kluczem, separatory między polami,
// placeholder tylko w odsłoniętym fragmencie. Tryb dokumentu sprawdza goldenMarkup.test.tsx.

function Field({ field, text, measuring }: PageFieldProps) {
  return (
    <span data-field-key={field.key} data-measuring={measuring || undefined} data-placeholder={field.placeholder}>
      {text}
    </span>
  )
}

const entryOf = (document: CvDocument, itemId: string) => {
  for (const section of document.sections) {
    const item = (section.items as Section['items'][number][]).find((candidate) => candidate.id === itemId)
    if (item) return { section, item }
  }
  return null
}

// Edycja testowa: pole dla każdego slotu, z wartością z dokumentu. Klucze i fragmenty jak w warstwie edycji
// (canvas/pageFields.ts), ale rozwiązane tu prosto z id bloków. Tytuł w wierszu listy – tylko w pierwszym wierszu.
function editingWith(document: CvDocument, reveal: string[] = []): PageEditing {
  const field = (key: string, fragment: string, value: string): EditableField => ({
    key,
    fragment,
    label: key,
    placeholder: key.split(':').at(-1)!,
    spellcheck: false,
    value
  })
  return {
    fieldOf: (block: CvBlock, slot: SlotName, part?: string) => {
      if (block.kind === 'header') {
        if (slot === 'fullName') return field('header:fullName', 'fullName', document.header.fullName)
        if (slot === 'summary') return field('header:summary', 'summary', document.header.summary)
        return null
      }
      const [first, rest] = block.id.split(':') as [string, string | undefined]
      if (slot === 'title') {
        const section = document.sections.find((candidate) => candidate.id === first)
        if (!section) return null
        const firstShown = reveal.includes(`list:${first}`) ? section.items[0] : section.items.find((item) => 'text' in item && item.text.trim())
        if (block.kind === 'listRow' && rest !== firstShown?.id) return null
        return field(`section:${first}:title`, `sectionTitle:${first}`, section.title)
      }
      if (slot === 'item') {
        const section = document.sections.find((candidate) => candidate.id === first)!
        const item = (section.items as { id: string; text: string }[]).find((candidate) => candidate.id === part)!
        return field(`list:${item.id}:text`, `list:${section.id}`, item.text)
      }
      const entry = entryOf(document, first)
      if (!entry) return null
      const fragment = `item:${first}`
      if (slot === 'bullet') {
        const bullets = (entry.item as ExperienceItem).bullets
        const bullet = rest
          ? bullets.find((candidate) => candidate.id === rest)!
          : reveal.includes(fragment)
            ? bullets[0]!
            : bullets.find((candidate) => candidate.text.trim())!
        return field(`experience:${first}:bullet:${bullet.id}`, fragment, bullet.text)
      }
      const prefix = entry.section.type === 'experience' ? 'experience' : 'education'
      const value = (entry.item as unknown as Record<string, unknown>)[slot]
      return typeof value === 'string' ? field(`${prefix}:${first}:${slot}`, fragment, value) : null
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

const sample = sampleCvs.en

const emptyHeader: CvDocument = {
  ...sample,
  header: { ...sample.header, fullName: '', summary: '', photo: null },
  sections: sample.sections.map((section) => ({ ...section, title: '' }))
}

const titles = ['experience', 'education', 'skills', 'languages'].map((id) => `section:${id}:title`)
const templateIds = Object.keys(templates) as (keyof typeof templates)[]
const headerAndTitles = (keys: string[]) => keys.filter((key) => key.startsWith('header:') || key.endsWith(':title'))

// Pierwsze stanowisko i pierwsze wykształcenie Sample CV podmienione na podane.
function withEntries(position: Partial<ExperienceItem>, education: Partial<EducationItem>): CvDocument {
  return {
    ...sample,
    sections: sample.sections.map((section) => {
      if (section.type === 'experience') return { ...section, items: [{ ...section.items[0]!, ...position }, ...section.items.slice(1)] }
      if (section.type === 'education') return { ...section, items: [{ ...section.items[0]!, ...education }, ...section.items.slice(1)] }
      return section
    })
  }
}

const blockHtml = (html: string, blockId: string) => html.split('\n').find((block) => block.includes(`data-block-id="${blockId}"`))!

describe('editing slots', () => {
  for (const templateId of templateIds) {
    it(`draw the name, the summary and the section titles as fields in the ${templateId} template`, () => {
      const page = render(sample, templateId, editingWith(sample))
      expect(page.html).toContain('<h1 class="cv-name"><span data-field-key="header:fullName" data-placeholder="fullName">Jane Example</span></h1>')
      expect(page.html).toMatch(/<p class="cv-summary"><span data-field-key="header:summary"/)
      expect(page.html).toMatch(/<h2 class="cv-section-title"><span data-field-key="section:experience:title"/)
      expect(headerAndTitles(page.keys)).toEqual(['header:fullName', 'header:summary', ...titles])
      expect(page.fields[0]!.text).toBe('Jane Example')
    })

    it(`draw every text field of the entries and lists as its own field in the ${templateId} template`, () => {
      const page = render(sample, templateId, editingWith(sample))
      const position = sample.sections[0]!.type === 'experience' ? sample.sections[0]!.items[0]! : null
      expect(page.keys).toEqual(
        expect.arrayContaining([
          'experience:e1:role',
          'experience:e1:company',
          'experience:e1:location',
          ...position!.bullets.map((bullet) => `experience:e1:bullet:${bullet.id}`),
          'education:ed1:level',
          'education:ed1:field',
          'education:ed1:institution',
          'list:s1:text',
          'list:l2:text'
        ])
      )
      // Każdy punkt i element listy Sample CV to pole – jedno na `li`.
      expect(page.html.match(/<li>/g)!.length).toBe(page.keys.filter((key) => key.includes(':bullet:') || key.startsWith('list:')).length)
      // Separatory poza polami, w elemencie szablonu.
      expect(blockHtml(page.html, 'e1')).toContain(
        '<div class="cv-company"><span data-field-key="experience:e1:company" data-placeholder="company">Fictional Manufacturing Ltd</span> – <span data-field-key="experience:e1:location" data-placeholder="location">Manchester</span></div>'
      )
      expect(blockHtml(page.html, 'ed2')).toMatch(
        /<span data-field-key="education:ed2:level"[^>]*>Master’s degree<\/span>(<\/strong>)?, <span data-field-key="education:ed2:field"[^>]*>Logistics<\/span>, <span data-field-key="education:ed2:institution"[^>]*>Fictional Academy<\/span>/
      )
    })

    it(`draw an empty field outside a revealed fragment as in the document, without a placeholder, in the ${templateId} template`, () => {
      const document = withEntries({ role: '', company: '' }, { level: '', institution: ' ' })
      const page = render(document, templateId, editingWith(document))
      const entry = blockHtml(page.html, 'e1')
      expect(entry).not.toContain('experience:e1:role')
      expect(entry).not.toContain('experience:e1:company')
      expect(entry).toContain('<div class="cv-company"><span data-field-key="experience:e1:location" data-placeholder="location">Manchester</span></div>')
      const education = blockHtml(page.html, 'ed1')
      expect(education).not.toMatch(/education:ed1:(level|institution)|cv-education-level|, /)
      expect(education).toContain('education:ed1:field')
    })

    it(`draw the empty fields of a revealed entry with placeholders and every separator in the ${templateId} template`, () => {
      const document = withEntries(
        {
          role: '',
          company: '',
          location: '',
          start: null,
          end: null,
          bullets: [
            { id: 'b1', text: '' },
            { id: 'b2', text: 'Two' }
          ]
        },
        { level: '', field: '', institution: '', start: null, end: null }
      )
      const page = render(document, templateId, editingWith(document, ['item:e1', 'item:ed1']))
      expect(page.fields.filter((field) => /:(e1|ed1):/.test(field.key))).toEqual([
        { key: 'experience:e1:role', text: '', measuring: false },
        { key: 'experience:e1:company', text: '', measuring: false },
        { key: 'experience:e1:location', text: '', measuring: false },
        { key: 'experience:e1:bullet:b1', text: '', measuring: false },
        { key: 'experience:e1:bullet:b2', text: 'Two', measuring: false },
        { key: 'education:ed1:level', text: '', measuring: false },
        { key: 'education:ed1:field', text: '', measuring: false },
        { key: 'education:ed1:institution', text: '', measuring: false }
      ])
      expect(blockHtml(page.html, 'e1')).toMatch(/data-placeholder="company"><\/span> – <span data-field-key="experience:e1:location"/)
      expect(blockHtml(page.html, 'ed1')).toMatch(/level"><\/span>(<\/strong>)?, <span[^>]*field"><\/span>, <span[^>]*institution"><\/span>/)
    })

    it(`draws empty fields only in a revealed fragment, in the ${templateId} template`, () => {
      const idle = render(emptyHeader, templateId, editingWith(emptyHeader))
      expect(headerAndTitles(idle.keys)).toEqual([])
      expect(idle.html).not.toMatch(/cv-name|cv-summary|cv-section-title/)

      expect(render(emptyHeader, templateId, editingWith(emptyHeader, ['fullName'])).fields[0]).toEqual({
        key: 'header:fullName',
        text: '',
        measuring: false
      })
      const titled = render(emptyHeader, templateId, editingWith(emptyHeader, ['sectionTitle:experience', 'sectionTitle:skills']))
      expect(titled.fields.filter((field) => field.key.endsWith(':title'))).toEqual([
        { key: 'section:experience:title', text: '', measuring: false },
        { key: 'section:skills:title', text: '', measuring: false }
      ])
    })

    it(`draws the empty items of a revealed list with placeholders in the ${templateId} template`, () => {
      const document: CvDocument = {
        ...sample,
        sections: sample.sections.map((section) =>
          section.id === 'skills' && section.type === 'list' ? { ...section, items: [{ id: 'new', text: '' }, ...section.items] } : section
        )
      }
      expect(render(document, templateId, editingWith(document)).keys).not.toContain('list:new:text')
      const page = render(document, templateId, editingWith(document, ['list:skills']))
      expect(page.fields.filter((field) => field.key.startsWith('list:')).slice(0, 2)).toEqual([
        { key: 'list:new:text', text: '', measuring: false },
        { key: 'list:s1:text', text: 'Commercial negotiation', measuring: false }
      ])
    })
  }

  it('draw the measuring copy with the same fields, marked as measuring', () => {
    const page = render(sample, 'modern', editingWith(sample), { measuring: true })
    expect(page.fields.length).toBeGreaterThan(6)
    expect(page.fields.every((field) => field.measuring)).toBe(true)
  })

  it('keep the title out of the list rows when the Template draws it above the list', () => {
    const page = render(sample, 'bold', editingWith(sample))
    expect(page.html.split('\n').filter((block) => block.includes('data-block="listRow"') && block.includes(':title"'))).toEqual([])
  })

  it('keep a role without text in the Modern role row with the dates as plain text, without a field', () => {
    const document = withEntries({ role: '' }, {})
    const entry = blockHtml(render(document, 'modern', editingWith(document)).html, 'e1')
    expect(entry).toContain('<div class="cv-role"></div>')
  })
})
