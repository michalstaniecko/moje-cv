import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type IPropertiesOptions,
  type IRunOptions,
  type IStylesOptions
} from 'docx'
import { cvFontFamilies, type CvFontId } from '../../shared/cvFonts'
import { splitByFontCoverage } from './fontCoverage'
import type { DocxFonts } from './fontFiles'
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

// Zdjęcie w prawej kolumnie nagłówka: 30 × 40 mm (proporcje 3:4 jak przy kadrowaniu), przy prawym marginesie.
const PHOTO_WIDTH_MM = 30
const PHOTO_HEIGHT_MM = 40
const PHOTO_COLUMN_MM = 34
// `ImageRun` przyjmuje wymiary w pikselach 96 dpi.
const pixels = (mm: number) => (mm / 25.4) * 96

// Zaokrąglone do całych twipów (A4 = 11906 × 16838, jak w Wordzie).
const twips = (mm: number) => Math.round((mm / 25.4) * 1440)

// Daty stanowiska i wykształcenia na tabulatorze wyrównanym do prawego marginesu (bez niewidocznej tabeli).
const datesTabStop = { type: TabStopType.RIGHT, position: twips(CONTENT_WIDTH_MM) }

type RunOptions = Omit<IRunOptions, 'text' | 'break' | 'children'>

// Przebiegi tekstu CV: każdy kolejny wiersz po miękkim podziale (`w:br`), jak `white-space: pre-line`, a znaki spoza
// fontu CV osobnym przebiegiem w foncie zastępczym (po nazwie), jak stos fontów w podglądzie (fontCoverage.ts).
// `usesFallback` mówi, czy któryś przebieg wyszedł w foncie zastępczym – wtedy osadzamy i jego.
type Runs = ((content: string, options?: RunOptions) => TextRun[]) & { readonly usesFallback: boolean }

const FALLBACK_FONT_ID: CvFontId = 'source-sans-3'
const FALLBACK_FONT = cvFontFamilies[FALLBACK_FONT_ID]

function runsIn(font: CvFontId): Runs {
  let usesFallback = false
  const runs = (content: string, options: RunOptions = {}) =>
    content.split('\n').flatMap((line, index) => {
      const lineBreak = index > 0 ? 1 : undefined
      const segments = splitByFontCoverage(line, font)
      if (segments.length === 0) return lineBreak ? [new TextRun({ ...options, text: '', break: lineBreak })] : []
      if (segments.some((segment) => segment.fallback)) usesFallback = true
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
  return Object.defineProperty(runs, 'usesFallback', { get: () => usesFallback }) as Runs
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

type Photo = { type: 'jpg' | 'png'; data: Buffer }

// Typ zdjęcia z prefiksu MIME data URL i sygnatura pliku, która musi się z nim zgadzać.
const photoTypes: Record<string, { type: Photo['type']; signature: number[] }> = {
  'image/jpeg': { type: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { type: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }
}

// Zdjęcie z data URL (bez ponownej kompresji). Inny typ albo uszkodzone dane → null: DOCX powstaje bez zdjęcia.
function decodePhoto(dataUrl: string | null): Photo | null {
  const match = dataUrl?.match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/]+={0,2})$/)
  const photoType = match ? photoTypes[match[1]!.toLowerCase()] : undefined
  if (!match || !photoType) return null
  const data = Buffer.from(match[2]!, 'base64')
  if (data.length <= photoType.signature.length) return null
  return photoType.signature.every((byte, index) => data[index] === byte) ? { type: photoType.type, data } : null
}

// Bez obramowań i marginesów komórek, więc tekst z lewej kolumny stoi przy marginesie jak reszta dokumentu.
const NO_CELL_MARGINS = { top: 0, bottom: 0, left: 0, right: 0 }

// Nagłówek ze zdjęciem: tabela 2 kolumny bez obramowań – nazwisko, kontakty i podsumowanie z lewej, zdjęcie z prawej.
function headerTable(left: Paragraph[], photo: Photo, spaceAfterMm: number): Table {
  const leftWidth = twips(CONTENT_WIDTH_MM - PHOTO_COLUMN_MM)
  const rightWidth = twips(PHOTO_COLUMN_MM)
  const image = new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: twips(spaceAfterMm) },
    children: [
      new ImageRun({
        type: photo.type,
        data: photo.data,
        transformation: { width: pixels(PHOTO_WIDTH_MM), height: pixels(PHOTO_HEIGHT_MM) }
      })
    ]
  })
  return new Table({
    width: { size: leftWidth + rightWidth, type: WidthType.DXA },
    columnWidths: [leftWidth, rightWidth],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    margins: NO_CELL_MARGINS,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          // Komórka musi kończyć się akapitem – także gdy nagłówek ma samo zdjęcie.
          new TableCell({ width: { size: leftWidth, type: WidthType.DXA }, children: left.length > 0 ? left : [new Paragraph({})] }),
          new TableCell({ width: { size: rightWidth, type: WidthType.DXA }, children: [image] })
        ]
      })
    ]
  })
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

// Treść bloku w dokumencie: nagłówek z poprawnym zdjęciem jako tabela, wszystko inne jako akapity.
function blockChildren(runs: Runs, block: CvBlock): (Paragraph | Table)[] {
  const photo = block.kind === 'header' ? decodePhoto(block.photoUrl) : null
  if (photo === null) return blockParagraphs(runs, block)
  return [headerTable(blockParagraphs(runs, block), photo, block.spaceAfterMm)]
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

type FontOptions = NonNullable<IPropertiesOptions['fonts']>[number]

// Osadzane fonty: 4 kroje fontu CV (pełne pliki, bez podzbiorów – Microsoft odradza podzbiory przy edycji), a font
// zastępczy tylko wtedy, gdy rzeczywiście jest w tekście (Lato + znaki spoza Lato, np. cyrylica).
function embeddedFonts(font: CvFontId, fonts: DocxFonts, withFallback: boolean): FontOptions[] {
  const ids = withFallback && font !== FALLBACK_FONT_ID ? [font, FALLBACK_FONT_ID] : [font]
  return ids.map((id) => {
    const { regular, bold, italic, boldItalic } = fonts[id]
    return { name: cvFontFamilies[id], data: regular, bold, italic, boldItalic }
  })
}

// `fonts` – pliki TTF fontów CV (docxFonts.ts czyta je z zasobów aplikacji); builder sam nie sięga do dysku.
export async function buildDocx(document: CvDocument, fonts: DocxFonts): Promise<Buffer> {
  const blocks = generateBlocks(document, DOCX_BLOCK_GEOMETRY)
  const fullName = document.header.fullName.trim()
  const runs = runsIn(document.settings.font)
  // Treść przed `Document`, żeby wiedzieć, czy potrzebny jest font zastępczy.
  const children = [...blocks.flatMap((block) => blockChildren(runs, block)), ...consentParagraphs(runs, document)]
  const docx = new Document({
    // Metadane jak w PDF; puste pola pominięte (bez domyślnego „Un-named” biblioteki), bez nazwy aplikacji.
    title: exportDocumentTitle(fullName),
    creator: fullName,
    lastModifiedBy: fullName,
    styles: styles(document),
    fonts: embeddedFonts(document.settings.font, fonts, runs.usesFallback),
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
        children
      }
    ]
  })
  return Packer.toBuffer(docx)
}
