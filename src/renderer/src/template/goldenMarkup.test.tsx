import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { generateBlocks } from '../domain/blocks'
import { sampleCvs } from '../domain/sampleCv'
import type { CvDocument, Section } from '../domain/schema'
import { CvBlockView } from './CvBlockView'
import { CvPages } from './CvPages'
import type { TemplateDefinition } from './templateDefinition'
import { templates } from './templates'

// „Złoty markup” (docs/specs/wysiwyg-editing.md, W3.1): markup dokumentu – każdy blok `generateBlocks` w każdym szablonie,
// stopka strony i korzeń `CvPages` z kontenerem pomiarowym – bez kontekstu edycji (`renderToString`, więc z granicami
// sąsiednich węzłów tekstowych jako `<!-- -->`). Wzorce zapisane z szablonów
// identycznych z `main` przed pierwszą zmianą szablonów (sloty edycji, ADR-0010). Różnica oznacza zmianę dokumentu
// (podglądu, PDF): wzorców nie aktualizujemy, żeby test przeszedł.

const en = sampleCvs.en

// Przypadki brzegowe, których Sample CV nie ma: kontakt bez etykiety, wykształcenie z samym poziomem, wpis bez dat,
// wpis z samymi datami, „obecnie”, sekcja bez tytułu, podsumowanie z nową linią, zdjęcie, klauzula zgody, nieparzysta
// liczba elementów listy (dwie kolumny w Modern i Bold, tytuł obok listy w Classic).
const edgeCases: CvDocument = {
  ...en,
  header: {
    fullName: 'Jane Example',
    photo: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    contacts: [
      { id: 'c1', label: '', value: 'jane@example.com' },
      { id: 'c2', label: 'Phone', value: '+1 555 0100' },
      { id: 'c3', label: 'Empty', value: '' }
    ],
    summary: 'First line.\nSecond line.'
  },
  sections: [
    {
      id: 'x',
      type: 'experience',
      title: '',
      hidden: false,
      pageBreakBefore: false,
      items: [
        { id: 'x1', role: 'No dates', company: 'Acme', location: '', start: null, end: null, bullets: [], pageBreakBefore: false },
        { id: 'x2', role: '', company: '', location: '', start: { year: 2020, month: 3 }, end: 'present', bullets: [], pageBreakBefore: false },
        {
          id: 'x3',
          role: 'Engineer',
          company: '',
          location: 'Berlin',
          start: { year: 2018, month: 1 },
          end: null,
          bullets: [
            { id: 'b1', text: '' },
            { id: 'b2', text: 'Only bullet' }
          ],
          pageBreakBefore: false
        }
      ]
    },
    {
      id: 'y',
      type: 'education',
      title: 'Education',
      hidden: false,
      pageBreakBefore: true,
      items: [
        { id: 'y1', level: 'BSc', field: '', institution: '', start: null, end: null, pageBreakBefore: false },
        { id: 'y2', level: '', field: 'Physics', institution: 'MIT', start: { year: 2010, month: 9 }, end: { year: 2014, month: 6 }, pageBreakBefore: false },
        { id: 'y3', level: '', field: '', institution: '', start: { year: 2009, month: 1 }, end: null, pageBreakBefore: false }
      ]
    },
    {
      id: 'z',
      type: 'list',
      title: 'Skills',
      hidden: false,
      pageBreakBefore: false,
      items: ['A', '', 'B', 'C'].map((text, index) => ({ id: `z${index}`, text }))
    },
    { id: 'w', type: 'list', title: '', hidden: false, pageBreakBefore: false, items: [{ id: 'w1', text: 'Untitled list item' }] }
  ] satisfies Section[],
  consent: { enabled: true, clauseId: null, text: 'I agree.\nSecond line of the clause.' }
}

// Nagłówek bez imienia i podsumowania (same kontakty) i sekcja listowa bez tytułu obok listy.
const noNameNoSummary: CvDocument = {
  ...en,
  header: { ...en.header, fullName: ' ', summary: '', photo: null },
  sections: en.sections.map((section) => (section.type === 'list' ? { ...section, title: ' ' } : section))
}

const documents = { en, pl: sampleCvs.pl, 'edge-cases': edgeCases, 'no-name-no-summary': noNameNoSummary }

function documentMarkup(document: CvDocument, templateId: keyof typeof templates): string {
  const template: TemplateDefinition = templates[templateId]
  const blocks = generateBlocks(document, template.geometry)
  const { PageFooter } = template
  return [
    ...blocks.map((block) => renderToString(<CvBlockView block={block} views={template.blockViews} />)),
    PageFooter ? renderToString(<PageFooter fullName={document.header.fullName} pageNumber={1} pageCount={2} />) : '(no footer)',
    PageFooter ? renderToString(<PageFooter fullName="" pageNumber={2} pageCount={2} />) : '(no footer)',
    // Korzeń dokumentu i kontener pomiarowy (strony powstają dopiero po pomiarze w przeglądarce).
    renderToString(<CvPages document={{ ...document, settings: { ...document.settings, template: templateId } }} />)
  ].join('\n')
}

describe('golden markup: the document markup of every block in every Template', () => {
  for (const templateId of Object.keys(templates) as (keyof typeof templates)[]) {
    for (const [name, document] of Object.entries(documents)) {
      it(`${templateId}, ${name}`, async () => {
        await expect(documentMarkup(document, templateId) + '\n').toMatchFileSnapshot(`__golden__/${templateId}-${name}.html`)
      })
    }
  }
})
