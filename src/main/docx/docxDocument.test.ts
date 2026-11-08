import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { sampleCvs } from '../../renderer/src/domain/sampleCv'
import type { CvDocument } from '../../renderer/src/domain/schema'
import { buildDocx } from './docxDocument'
import { FONTS_SOURCE_DIRECTORY, readDocxFonts } from './fontFiles'
import { cvFontFamilies, cvFontIds, type CvFontId } from '../../shared/cvFonts'

// Budżet rozmiaru DOCX z osadzonymi fontami (#93).
const DOCX_SIZE_BUDGET_BYTES = 3 * 1024 * 1024

// Fonty z `resources/fonts`, jak w dev – czytane raz dla wszystkich testów.
const fonts = await readDocxFonts(FONTS_SOURCE_DIRECTORY)

const build = (document: CvDocument) => buildDocx(document, fonts)

// Części pliku DOCX (ZIP) jako tekst: `word/document.xml`, `word/styles.xml`, `docProps/core.xml`…
async function docxParts(document: CvDocument): Promise<Record<string, string>> {
  const files = unzipSync(new Uint8Array(await build(document)))
  return Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strFromU8(content)]))
}

// Akapity `word/document.xml` w kolejności dokumentu (surowy XML każdego `<w:p>`).
const paragraphs = (xml: string): string[] => xml.match(/<w:p>.*?<\/w:p>|<w:p [^>]*>.*?<\/w:p>/gs) ?? []

// Widoczny tekst akapitu: przebiegi tekstu, tabulator jako „⇥”, miękki podział jako „↵”.
const text = (paragraph: string): string =>
  [...paragraph.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)]
    .map(([match, content]) => (match === '<w:tab/>' ? '⇥' : match === '<w:br/>' ? '↵' : unescapeXml(content!)))
    .join('')

const unescapeXml = (value: string) =>
  value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const withStyle = (xml: string, style: string) => paragraphs(xml).filter((p) => p.includes(`<w:pStyle w:val="${style}"/>`))

const paragraphWithText = (xml: string, content: string) => paragraphs(xml).find((p) => text(p).includes(content))

const sample = sampleCvs.en

const cv = (overrides: Partial<CvDocument> = {}): CvDocument => ({ ...sample, ...overrides })

describe('buildDocx', () => {
  test('the full name is a Title paragraph and every section title a Heading 1', async () => {
    const xml = (await docxParts(sample))['word/document.xml']!
    expect(withStyle(xml, 'Title').map(text)).toEqual(['Jane Example'])
    expect(withStyle(xml, 'Heading1').map(text)).toEqual(['Work experience', 'Education', 'Skills', 'Languages'])
  })

  test('each contact is its own paragraph: bold label, tab, value; an empty label leaves just the value', async () => {
    const document = cv({
      header: {
        ...sample.header,
        contacts: [
          { id: 'c1', label: 'Phone', value: '+1 555 0100' },
          { id: 'c2', label: '', value: 'jane@example.com' },
          { id: 'c3', label: 'Fax', value: '  ' }
        ]
      }
    })
    const xml = (await docxParts(document))['word/document.xml']!
    const phone = paragraphWithText(xml, '+1 555 0100')!
    expect(text(phone)).toBe('Phone⇥+1 555 0100')
    expect(phone).toMatch(/<w:b\/>.*?<w:t[^>]*>Phone</s)
    expect(phone).toContain('<w:tab w:val="left"')
    expect(text(paragraphWithText(xml, 'jane@example.com')!)).toBe('jane@example.com')
    expect(paragraphWithText(xml, 'Fax')).toBeUndefined()
  })

  test('the summary is an italic paragraph whose line breaks are soft breaks', async () => {
    const document = cv({ header: { ...sample.header, summary: 'First line\nSecond line' } })
    const summary = paragraphWithText((await docxParts(document))['word/document.xml']!, 'First line')!
    expect(text(summary)).toBe('First line↵Second line')
    expect(summary).toContain('<w:i/>')
  })

  test('a position: bold role, tab, dates on a right tab stop at the right margin; then company – city; both kept with the next line', async () => {
    const xml = (await docxParts(sample))['word/document.xml']!
    const role = paragraphWithText(xml, 'Senior Procurement Specialist')!
    expect(text(role)).toBe('Senior Procurement Specialist⇥03.2023 – present')
    expect(role).toMatch(/<w:b\/>.*?<w:t[^>]*>Senior Procurement Specialist</s)
    // A4 minus marginesy 20 mm = 170 mm = 9638 twipów.
    expect(role).toContain('<w:tab w:val="right" w:pos="9638"/>')
    expect(role).toContain('<w:keepNext/>')
    const company = paragraphs(xml)[paragraphs(xml).indexOf(role) + 1]!
    expect(text(company)).toBe('Fictional Manufacturing Ltd – Manchester')
    expect(company).toContain('<w:keepNext/>')
  })

  test('the bullets of a position and the items of list sections are a real bulleted list', async () => {
    const xml = (await docxParts(sample))['word/document.xml']!
    for (const item of [
      'Negotiating prices and commercial terms with domestic and international suppliers.',
      'Onboarding new members of the procurement team.',
      'Commercial negotiation',
      'German – B2'
    ]) {
      expect(text(paragraphWithText(xml, item)!)).toBe(item)
      expect(paragraphWithText(xml, item)).toContain('<w:numPr>')
    }
    expect(paragraphWithText(xml, 'Senior Procurement Specialist')).not.toContain('<w:numPr>')
  })

  test('a bullet with line breaks keeps them as soft breaks', async () => {
    const document = cv({
      sections: [
        {
          id: 'x',
          type: 'experience',
          title: 'Work',
          hidden: false,
          pageBreakBefore: false,
          items: [
            {
              id: 'e',
              role: 'Buyer',
              company: '',
              location: '',
              start: null,
              end: null,
              pageBreakBefore: false,
              bullets: [{ id: 'b', text: 'One\nTwo' }]
            }
          ]
        }
      ]
    })
    expect(text(paragraphWithText((await docxParts(document))['word/document.xml']!, 'One')!)).toBe('One↵Two')
  })

  test('an education entry: bold level, field and school, then the dates on the right tab stop', async () => {
    const xml = (await docxParts(sample))['word/document.xml']!
    const entry = paragraphWithText(xml, 'Fictional Academy')!
    expect(text(entry)).toBe('Master’s degree, Logistics, Fictional Academy⇥10.2009 – 06.2014')
    expect(entry).toMatch(/<w:b\/>.*?<w:t[^>]*>Master’s degree</s)
    expect(entry).toContain('<w:tab w:val="right" w:pos="9638"/>')
  })

  test('a page break forced in the CV starts a new page before that section or entry, and nowhere else', async () => {
    const [experience, education, ...rest] = sample.sections
    if (experience?.type !== 'experience' || education?.type !== 'education') throw new Error('Unexpected Sample CV')
    const document = cv({
      sections: [
        { ...experience, items: experience.items.map((item, index) => ({ ...item, pageBreakBefore: index === 2 })) },
        { ...education, pageBreakBefore: true },
        ...rest
      ]
    })
    const xml = (await docxParts(document))['word/document.xml']!
    expect(paragraphs(xml).filter((p) => p.includes('<w:pageBreakBefore/>')).map(text)).toEqual([
      'Procurement Assistant⇥09.2016 – 01.2019',
      'Education'
    ])
  })

  test('empty fields, empty sections and hidden sections are left out', async () => {
    const [experience, , skills, ...rest] = sample.sections
    if (experience?.type !== 'experience' || skills?.type !== 'list') throw new Error('Unexpected Sample CV')
    const document = cv({
      sections: [
        { ...experience, items: [{ ...experience.items[0]!, location: '', bullets: [{ id: 'b', text: ' ' }] }] },
        { ...skills, items: [{ id: 's', text: '' }] },
        ...rest
      ]
    })
    const xml = (await docxParts(document))['word/document.xml']!
    expect(withStyle(xml, 'Heading1').map(text)).toEqual(['Work experience', 'Languages'])
    expect(paragraphWithText(xml, 'Fictional Manufacturing Ltd')!).toSatisfy((p: string) => text(p) === 'Fictional Manufacturing Ltd')
    expect(xml).not.toContain('This section is hidden')
    expect(paragraphs(xml).filter((p) => text(p).trim() === '')).toEqual([])
  })

  test('A4 page with 20 mm margins and no footer', async () => {
    const xml = (await docxParts(sample))['word/document.xml']!
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"')
    expect(xml).toMatch(/<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/)
    expect(xml).not.toContain('<w:footerReference')
  })

  test('styles: Heading 1 in the accent colour with a thin bottom border in it; the CV font and language by default', async () => {
    const document = cv({ settings: { ...sample.settings, accentColor: '#AB12cd', font: 'arimo', language: 'pt' } })
    const styles = (await docxParts(document))['word/styles.xml']!
    const heading1 = styles.match(/<w:style [^>]*w:styleId="Heading1".*?<\/w:style>/s)![0]
    expect(heading1).toContain('<w:color w:val="AB12CD"/>')
    expect(heading1).toMatch(/<w:pBdr><w:bottom [^>]*w:color="AB12CD"/)
    const defaults = styles.match(/<w:docDefaults>.*?<\/w:docDefaults>/s)![0]
    expect(defaults).toContain('w:ascii="Arimo"')
    expect(defaults).toContain('w:hAnsi="Arimo"')
    expect(defaults).toContain('w:cs="Arimo"')
    expect(defaults).toContain('<w:lang w:val="pt-BR"/>')
    const title = styles.match(/<w:style [^>]*w:styleId="Title".*?<\/w:style>/s)![0]
    expect(title).toContain('<w:b/>')
    expect(title).toContain('w:ascii="Arimo"')
    // Akcent tylko w nagłówkach – nazwisko w kolorze tekstu.
    expect(title).not.toContain('AB12CD')
  })

  test('title and author in the file properties are the same as in the PDF, without the app name', async () => {
    const core = (await docxParts(sample))['docProps/core.xml']!
    expect(core).toContain('<dc:title>CV – Jane Example</dc:title>')
    expect(core).toContain('<dc:creator>Jane Example</dc:creator>')
    expect(core).not.toContain('CV Drawer')
  })

  test('without a full name the title is just “CV” and there is no author', async () => {
    const core = (await docxParts(cv({ header: { ...sample.header, fullName: '' } })))['docProps/core.xml']!
    expect(core).toContain('<dc:title>CV</dc:title>')
    expect(core).not.toMatch(/<dc:creator>[^<]+<\/dc:creator>/)
    expect(core).not.toContain('Un-named')
  })

  test.each(Object.keys(sampleCvs))('the Sample CV in %s builds without errors', async (language) => {
    const document = sampleCvs[language as keyof typeof sampleCvs]
    const xml = (await docxParts(document))['word/document.xml']!
    expect(withStyle(xml, 'Title').map(text)).toEqual([document.header.fullName])
  })

  describe('photo', () => {
    // Początek prawdziwych plików: sygnatura JPEG (SOI + APP0 „JFIF”) i PNG – builder nie dekoduje obrazu.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
    const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`
    const withPhoto = (url: string | null): CvDocument => cv({ header: { ...sample.header, photo: url === null ? null : { dataUrl: url } } })
    const media = (parts: Record<string, string>) => Object.keys(parts).filter((path) => path.startsWith('word/media/'))

    test('a JPEG photo sits next to the name, contacts and summary in a borderless two-column table', async () => {
      const files = unzipSync(new Uint8Array(await build(withPhoto(dataUrl('image/jpeg', jpeg)))))
      const images = Object.keys(files).filter((path) => path.startsWith('word/media/'))
      expect(images).toHaveLength(1)
      expect(images[0]).toMatch(/\.jpe?g$/)
      // Bez ponownej kompresji: w pliku te same bajty co w data URL.
      expect(Buffer.from(files[images[0]!]!)).toEqual(jpeg)

      const xml = strFromU8(files['word/document.xml']!)
      const tables = xml.match(/<w:tbl>.*?<\/w:tbl>/gs) ?? []
      expect(tables).toHaveLength(1)
      const [table] = tables
      const cells = table!.match(/<w:tc>.*?<\/w:tc>/gs)!
      expect(cells).toHaveLength(2)
      const [left, right] = cells
      expect(paragraphs(left!).map(text)).toEqual([
        'Jane Example',
        ...sample.header.contacts.map((contact) => `${contact.label}⇥${contact.value}`),
        ...(sample.header.summary.trim() ? [sample.header.summary] : [])
      ])
      expect(left).toContain('<w:pStyle w:val="Title"/>')
      expect(right).toContain('<wp:inline')
      // 30 × 40 mm (36 000 EMU na mm).
      expect(right).toContain('<wp:extent cx="1080000" cy="1440000"/>')
      const borders = table!.match(/<w:tblBorders>.*?<\/w:tblBorders>/s)![0]
      expect(borders.match(/w:val="(\w+)"/g)!.every((value) => /"(none|nil)"/.test(value))).toBe(true)
      // Nagłówek przed pierwszym tytułem sekcji, poza tabelą nie powtarza się.
      expect(xml.indexOf('<w:tbl>')).toBeLessThan(xml.indexOf('Work experience'))
      expect(xml.split('Jane Example')).toHaveLength(2)
    })

    test('a PNG photo is embedded as PNG', async () => {
      const parts = await docxParts(withPhoto(dataUrl('image/png', png)))
      expect(media(parts)).toEqual([expect.stringMatching(/\.png$/)])
      expect(parts['word/document.xml']).toContain('<w:tbl>')
    })

    test('without a photo the header is plain paragraphs, with no table', async () => {
      const parts = await docxParts(withPhoto(null))
      expect(parts['word/document.xml']).not.toContain('<w:tbl')
      expect(media(parts)).toEqual([])
      expect(withStyle(parts['word/document.xml']!, 'Title').map(text)).toEqual(['Jane Example'])
    })

    test.each([
      ['damaged base64', 'data:image/jpeg;base64,@@not base64@@'],
      ['bytes that are not a JPEG', dataUrl('image/jpeg', Buffer.from('hello, world'))],
      ['an empty image', 'data:image/jpeg;base64,'],
      ['not a data URL', 'https://example.com/photo.jpg'],
      ['an unsupported type (SVG)', 'data:image/svg+xml,%3Csvg%2F%3E'],
      ['an unsupported type (GIF)', dataUrl('image/gif', Buffer.from('GIF89a'))]
    ])('a photo with %s is left out and the DOCX is still built', async (_, url) => {
      const parts = await docxParts(withPhoto(url))
      expect(media(parts)).toEqual([])
      expect(parts['word/document.xml']).not.toContain('<w:tbl')
      expect(withStyle(parts['word/document.xml']!, 'Title').map(text)).toEqual(['Jane Example'])
    })
  })

  describe('fallback font for Lato', () => {
    const russian = (font: CvDocument['settings']['font']): CvDocument => ({
      ...sampleCvs.ru,
      settings: { ...sampleCvs.ru.settings, font }
    })

    test('the Russian Sample CV in Lato writes its Cyrillic in Source Sans 3 runs, the Latin in the default font', async () => {
      const xml = (await docxParts(russian('lato')))['word/document.xml']!
      expect(xml).toContain('w:ascii="Source Sans 3"')
      // Każdy odcinek w Source Sans 3 to cyrylica (albo inne znaki spoza Lato), nigdy łacina.
      const fallbackRuns = [...xml.matchAll(/<w:r>(?:(?!<\/w:r>).)*?w:ascii="Source Sans 3"(?:(?!<\/w:r>).)*?<\/w:r>/gs)].map(([run]) => text(run))
      expect(fallbackRuns.length).toBeGreaterThan(0)
      for (const run of fallbackRuns) expect(run).not.toMatch(/[A-Za-z0-9 ]/)
      const name = withStyle(xml, 'Title')[0]!
      expect(text(name)).toBe(sampleCvs.ru.header.fullName)
      expect(name).toContain('w:ascii="Source Sans 3"')
    })

    test('the same CV in Arimo has no Source Sans 3 runs', async () => {
      const xml = (await docxParts(russian('arimo')))['word/document.xml']!
      expect(xml).not.toContain('Source Sans 3')
    })

    test('a Latin-only CV in Lato has no Source Sans 3 runs', async () => {
      expect((await docxParts(sample))['word/document.xml']!).not.toContain('Source Sans 3')
    })

    test('a contact label and value are split too, keeping the bold label and the tab', async () => {
      const document = cv({
        header: { ...sample.header, contacts: [{ id: 'c', label: 'Телефон', value: 'Москва' }] }
      })
      const xml = (await docxParts(document))['word/document.xml']!
      const contact = paragraphWithText(xml, 'Москва')!
      expect(text(contact)).toBe('Телефон⇥Москва')
      expect(contact.match(/w:ascii="Source Sans 3"/g)).toHaveLength(2)
      expect(paragraphWithText(xml, 'Телефон')).toMatch(/<w:b\/>.*?<w:t[^>]*>Телефон</s)
    })
  })

  describe('embedded fonts', () => {
    const inFont = (document: CvDocument, font: CvFontId): CvDocument => ({ ...document, settings: { ...document.settings, font } })

    // Rodziny z `word/fontTable.xml` z krojami osadzonymi w każdej z nich.
    const embeddedFaces = (fontTable: string): Record<string, string[]> =>
      Object.fromEntries(
        [...fontTable.matchAll(/<w:font w:name="([^"]+)">(.*?)<\/w:font>/gs)].map(([, name, content]) => [
          name!,
          [...content!.matchAll(/<w:(embed\w+) /g)].map(([, face]) => face!).sort()
        ])
      )

    const ALL_FACES = ['embedBold', 'embedBoldItalic', 'embedItalic', 'embedRegular']

    // Zaciemnianie (ECMA-376 §17.8.1) zmienia tylko pierwsze 32 bajty pliku, więc reszta identyfikuje krój.
    const tail = (data: Uint8Array) => Buffer.from(data.subarray(32)).toString('base64')
    const faceTails = (...ids: CvFontId[]) => ids.flatMap((id) => Object.values(fonts[id]).map(tail)).sort()

    const embeddedFiles = (files: Record<string, Uint8Array>) =>
      Object.entries(files).filter(([path]) => /^word\/fonts\/[^/]+\.odttf$/.test(path))

    test.each(cvFontIds)('the four faces of the CV font %s are embedded, full files, and nothing else for a Latin CV', async (id) => {
      const files = unzipSync(new Uint8Array(await build(inFont(sample, id))))
      expect(embeddedFaces(strFromU8(files['word/fontTable.xml']!))).toEqual({ [cvFontFamilies[id]]: ALL_FACES })
      const odttf = embeddedFiles(files)
      expect(odttf.map(([, data]) => tail(data)).sort()).toEqual(faceTails(id))
      for (const [, data] of odttf) expect(Object.values(fonts[id]).map((face) => face.length)).toContain(data.length)
    })

    test('Source Sans 3 is embedded as well for the Russian Sample CV in Lato, but not for the English one', async () => {
      const russian = unzipSync(new Uint8Array(await build(inFont(sampleCvs.ru, 'lato'))))
      expect(embeddedFaces(strFromU8(russian['word/fontTable.xml']!))).toEqual({ Lato: ALL_FACES, 'Source Sans 3': ALL_FACES })
      expect(embeddedFiles(russian).map(([, data]) => tail(data)).sort()).toEqual(faceTails('lato', 'source-sans-3'))

      const english = unzipSync(new Uint8Array(await build(inFont(sampleCvs.en, 'lato'))))
      expect(Object.keys(embeddedFaces(strFromU8(english['word/fontTable.xml']!)))).toEqual(['Lato'])
      expect(embeddedFiles(english)).toHaveLength(4)
    })

    test('the Russian Sample CV in Source Sans 3 or Arimo embeds only that font', async () => {
      for (const id of ['source-sans-3', 'arimo'] as const) {
        const files = unzipSync(new Uint8Array(await build(inFont(sampleCvs.ru, id))))
        expect(Object.keys(embeddedFaces(strFromU8(files['word/fontTable.xml']!)))).toEqual([cvFontFamilies[id]])
      }
    })

    // Budżet rozmiaru pliku z osadzonymi fontami (zob. #93): Sample CV w każdym CV language i w każdym foncie CV.
    test('the Sample CV in every CV language and every CV font fits the size budget', async () => {
      for (const [language, document] of Object.entries(sampleCvs)) {
        for (const id of cvFontIds) {
          const size = (await build(inFont(document, id))).length
          expect(size, `${language} in ${id}`).toBeLessThanOrEqual(DOCX_SIZE_BUDGET_BYTES)
        }
      }
    })
  })

  describe('consent clause', () => {
    const consent = (enabled: boolean, text: string): CvDocument['consent'] => ({ enabled, clauseId: null, text })

    test('is the last paragraph, in small muted text, with its line breaks as soft breaks', async () => {
      const xml = (await docxParts(cv({ consent: consent(true, 'I agree to the processing\nof my data.') })))['word/document.xml']!
      const last = paragraphs(xml).at(-1)!
      expect(text(last)).toBe('I agree to the processing↵of my data.')
      expect(last).toContain('<w:sz w:val="16"/>')
      expect(last).toMatch(/<w:color w:val="[0-9A-F]{6}"\/>/)
    })

    test('is left out when switched off or empty', async () => {
      for (const clause of [consent(false, 'I agree.'), consent(true, '  \n ')]) {
        const xml = (await docxParts(cv({ consent: clause })))['word/document.xml']!
        expect(xml).not.toContain('I agree.')
        expect(text(paragraphs(xml).at(-1)!)).toBe('German – B2')
      }
    })
  })
})
