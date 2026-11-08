import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  type IParagraphOptions,
  type IRunOptions,
  type IStylesOptions
} from 'docx'
import { cvFontFamilies, type CvFontId } from '../../shared/cvFonts'
import { splitByFontCoverage } from './fontCoverage'
import { exportDocumentTitle } from '../exportDocumentTitle'
import { docxLanguageTag } from './languageTags'
import { generateBlocks, type BlockGeometry, type CvBlock } from '../../renderer/src/domain/blocks'
import { consentText } from '../../renderer/src/domain/consent'
import type { CvDocument } from '../../renderer/src/domain/schema'
import { A4_MM } from '../../renderer/src/domain/templateGeometry'

// Builder DOCX export (zob. GLOSSARY.md, ADR-0008): czysty moduł bez Electrona – `CvDocument` → plik DOCX.
// Jeden uproszczony układ dla wszystkich Template'ów, nastawiony na edycję (style nagłówków, prawdziwe listy, daty na
// tabulatorze). Treść pochodzi z `generateBlocks` z własną geometrią, więc main nie importuje żadnego modułu Template'u.

// Odstępy między blokami (mm) i układ sekcji listowych: tytuł nad listą, jeden element na punkt listy.
export const DOCX_BLOCK_GEOMETRY: BlockGeometry = {
  blockSpacingMm: {
    afterHeader: 6,
    beforeSectionTitle: 6,
    afterSectionTitle: 2,
    betweenBullets: 0.5,
    afterExperienceEntryWithoutBullets: 2,
    afterExperienceItem: 4,
    afterEducationItem: 2,
    afterEducationSection: 4,
    betweenListItems: 0.5,
    afterListSection: 4
  },
  listSectionLayout: { title: 'above', columns: 1 }
}

// Strona A4 z marginesami 20 mm, bez stopki i numerów stron – miejsce na dalszą edycję.
const PAGE_MARGIN_MM = 20
const CONTENT_WIDTH_MM = A4_MM.width - 2 * PAGE_MARGIN_MM

// Stały tabulator kontaktów (etykieta ⇥ wartość), od lewego marginesu.
const CONTACT_TAB_MM = 25

// Klauzula zgody: 8 pt (rozmiar w półpunktach), przygaszony kolor, odstęp przed nią.
const CONSENT_FONT_HALF_POINTS = 16
const CONSENT_GAP_MM = 6
const MUTED_COLOR = '666666'

// Rozmiary w półpunktach: tekst 10 pt, nazwisko ~21 pt (jak w szablonach), tytuły sekcji 13 pt.
const BODY_FONT_HALF_POINTS = 20
const TITLE_FONT_HALF_POINTS = 42
const HEADING_FONT_HALF_POINTS = 26
const TEXT_COLOR = '222222'

const BULLETS = 'bullets'

// Zaokrąglone do całych twipów (A4 = 11906 × 16838, jak w Wordzie).
const twips = (mm: number) => Math.round((mm / 25.4) * 1440)

// Daty stanowiska i wykształcenia na tabulatorze wyrównanym do prawego marginesu (bez niewidocznej tabeli).
const datesTabStop = { type: TabStopType.RIGHT, position: twips(CONTENT_WIDTH_MM) }

type RunOptions = Omit<IRunOptions, 'text' | 'break' | 'children'>

// Przebiegi tekstu CV: każdy kolejny wiersz po miękkim podziale (`w:br`), jak `white-space: pre-line`, a znaki spoza
// fontu CV osobnym przebiegiem w foncie zastępczym (po nazwie), jak stos fontów w podglądzie (fontCoverage.ts).
type Runs = (content: string, options?: RunOptions) => TextRun[]

const FALLBACK_FONT = cvFontFamilies['source-sans-3']

function runsIn(font: CvFontId): Runs {
  return (content, options = {}) =>
    content.split('\n').flatMap((line, index) => {
      const lineBreak = index > 0 ? 1 : undefined
      const segments = splitByFontCoverage(line, font)
      if (segments.length === 0) return lineBreak ? [new TextRun({ ...options, text: '', break: lineBreak })] : []
      return segments.map(
        (segment, segmentIndex) =>
          new TextRun({
            ...options,
            ...(segment.fallback ? { font: FALLBACK_FONT } : {}),
            text: segment.text,
            break: segmentIndex === 0 ? lineBreak : undefined
          })
      )
    })
}

const tab = () => new TextRun({ children: [new Tab()] })

const bullet = (runs: Runs, content: string): IParagraphOptions => ({
  numbering: { reference: BULLETS, level: 0 },
  children: runs(content)
})

// „tekst (pogrubiony) … ⇥ daty”: wiersz stanowiska albo wykształcenia.
function withDates(runs: Runs, bold: string, rest: string, dates: string): IParagraphOptions {
  const children: TextRun[] = []
  if (bold) children.push(...runs(bold, { bold: true }))
  if (rest) children.push(...runs(bold ? `, ${rest}` : rest))
  if (dates) children.push(tab(), ...runs(dates))
  return { tabStops: [datesTabStop], children }
}

function headerParagraphs(runs: Runs, block: Extract<CvBlock, { kind: 'header' }>): IParagraphOptions[] {
  const paragraphs: IParagraphOptions[] = []
  if (block.fullName.trim()) paragraphs.push({ heading: HeadingLevel.TITLE, children: runs(block.fullName) })
  for (const contact of block.contacts) {
    paragraphs.push({
      tabStops: [{ type: TabStopType.LEFT, position: twips(CONTACT_TAB_MM) }],
      children: contact.label.trim()
        ? [...runs(contact.label, { bold: true }), tab(), ...runs(contact.value)]
        : runs(contact.value)
    })
  }
  if (block.summary.trim()) paragraphs.push({ children: runs(block.summary, { italics: true }) })
  return paragraphs
}

function experienceParagraphs(runs: Runs, block: Extract<CvBlock, { kind: 'experienceEntry' }>): IParagraphOptions[] {
  const paragraphs: IParagraphOptions[] = []
  // Stanowisko i firma trzymają się następnego wiersza, żeby wpis nie odrywał się od pierwszego punktu.
  if (block.role.trim() || block.dates) paragraphs.push({ ...withDates(runs, block.role.trim(), '', block.dates), keepNext: true })
  if (block.companyLine) paragraphs.push({ keepNext: true, children: runs(block.companyLine) })
  if (block.firstBullet !== null) paragraphs.push(bullet(runs, block.firstBullet))
  return paragraphs
}

function contentParagraphs(runs: Runs, block: CvBlock): IParagraphOptions[] {
  switch (block.kind) {
    case 'header':
      return headerParagraphs(runs, block)
    case 'sectionTitle':
      return [{ heading: HeadingLevel.HEADING_1, children: runs(block.title) }]
    case 'experienceEntry':
      return experienceParagraphs(runs, block)
    case 'experienceBullet':
      return [bullet(runs, block.text)]
    case 'educationEntry':
      return [withDates(runs, block.level, block.details, block.dates)]
    case 'listRow':
      return block.items.map((item) => bullet(runs, item.text))
  }
}

// Akapity bloku z jego regułami podziału stron: wymuszona nowa strona przed pierwszym akapitem, „trzymaj
// z następnym” i odstęp po bloku na ostatnim.
function blockParagraphs(runs: Runs, block: CvBlock): Paragraph[] {
  const paragraphs = contentParagraphs(runs, block)
  return paragraphs.map((options, index) => {
    const last = index === paragraphs.length - 1
    return new Paragraph({
      ...options,
      pageBreakBefore: (index === 0 && block.breakBefore) || undefined,
      keepNext: options.keepNext || (last && block.keepWithNext) || undefined,
      spacing: { after: last ? twips(block.spaceAfterMm) : 0 }
    })
  })
}

// Klauzula zgody: ostatni akapit (8 pt, przygaszony), tylko gdy widoczna wg tej samej reguły co w podglądzie.
// Bez przypinania do dołu strony – po edycji i tak nie wiadomo, gdzie skończy się dokument.
function consentParagraphs(runs: Runs, document: CvDocument): Paragraph[] {
  const text = consentText(document)
  if (text === null) return []
  return [
    new Paragraph({
      spacing: { before: twips(CONSENT_GAP_MM), after: 0 },
      children: runs(text, { size: CONSENT_FONT_HALF_POINTS, color: MUTED_COLOR })
    })
  ]
}

// Style dokumentu: font CV (po nazwie) i CV language w domyślnych właściwościach tekstu, nazwisko stylem Title,
// tytuły sekcji stylem Heading 1 – jedyne miejsce z kolorem akcentu (tekst i cienka dolna linia), więc zmiana koloru
// w stylu zmienia wszystkie nagłówki, także dopisane przez użytkownika. Appearance nie ma wpływu.
function styles({ settings }: CvDocument): IStylesOptions {
  const font = cvFontFamilies[settings.font]
  const accent = settings.accentColor.slice(1).toUpperCase()
  return {
    default: {
      document: {
        run: { font, size: BODY_FONT_HALF_POINTS, color: TEXT_COLOR, language: { value: docxLanguageTag(settings.language) } }
      },
      title: {
        run: { font, size: TITLE_FONT_HALF_POINTS, bold: true, color: TEXT_COLOR },
        paragraph: { spacing: { after: twips(2) } }
      },
      heading1: {
        run: { font, size: HEADING_FONT_HALF_POINTS, bold: true, color: accent },
        paragraph: {
          keepNext: true,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: accent } }
        }
      }
    }
  }
}

export async function buildDocx(document: CvDocument): Promise<Buffer> {
  const blocks = generateBlocks(document, DOCX_BLOCK_GEOMETRY)
  const fullName = document.header.fullName.trim()
  const runs = runsIn(document.settings.font)
  const docx = new Document({
    // Metadane jak w PDF; puste pola pominięte (bez domyślnego „Un-named” biblioteki), bez nazwy aplikacji.
    title: exportDocumentTitle(fullName),
    creator: fullName,
    lastModifiedBy: fullName,
    styles: styles(document),
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: twips(6), hanging: twips(4) } } }
            }
          ]
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: twips(A4_MM.width), height: twips(A4_MM.height) },
            margin: {
              top: twips(PAGE_MARGIN_MM),
              right: twips(PAGE_MARGIN_MM),
              bottom: twips(PAGE_MARGIN_MM),
              left: twips(PAGE_MARGIN_MM),
              header: 0,
              footer: 0
            }
          }
        },
        children: [...blocks.flatMap((block) => blockParagraphs(runs, block)), ...consentParagraphs(runs, document)]
      }
    ]
  })
  return Packer.toBuffer(docx)
}
