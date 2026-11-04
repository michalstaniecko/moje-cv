import { z } from 'zod'
import { appearances } from '../../../shared/appearance'
import { interfaceLanguageCodes } from '../../../shared/i18n/languages'

export const yearMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12)
})
export type YearMonth = z.infer<typeof yearMonthSchema>

const idSchema = z.string().min(1)

const textItemSchema = z.object({ id: idSchema, text: z.string() })
export type TextItem = z.infer<typeof textItemSchema>

const sectionBaseSchema = z.object({
  id: idSchema,
  title: z.string(),
  hidden: z.boolean(),
  pageBreakBefore: z.boolean()
})

export const experienceItemSchema = z.object({
  id: idSchema,
  role: z.string(),
  company: z.string(),
  location: z.string(),
  start: yearMonthSchema.nullable(),
  end: z.union([yearMonthSchema, z.literal('present')]).nullable(),
  bullets: z.array(textItemSchema),
  pageBreakBefore: z.boolean()
})
export type ExperienceItem = z.infer<typeof experienceItemSchema>

export const educationItemSchema = z.object({
  id: idSchema,
  level: z.string(),
  field: z.string(),
  institution: z.string(),
  start: yearMonthSchema.nullable(),
  end: yearMonthSchema.nullable(),
  pageBreakBefore: z.boolean()
})
export type EducationItem = z.infer<typeof educationItemSchema>

export const sectionSchema = z.discriminatedUnion('type', [
  sectionBaseSchema.extend({ type: z.literal('experience'), items: z.array(experienceItemSchema) }),
  sectionBaseSchema.extend({ type: z.literal('education'), items: z.array(educationItemSchema) }),
  sectionBaseSchema.extend({ type: z.literal('list'), items: z.array(textItemSchema) })
])
export type Section = z.infer<typeof sectionSchema>

// Identyfikatory szablonów (zob. „Template” w GLOSSARY.md). Definicje szablonów (template/templates.ts) są kluczowane tą listą.
// Nowy szablon (jedyne miejsce z tą listą kroków):
// 1. identyfikator tutaj,
// 2. definicja szablonu i wpis w `templates` (template/templates.ts) – geometria z układem sekcji listowych
//    (tytuł obok / nad listą, 1 / 2 kolumny), nadpisania bloków i opcjonalna stopka strony; arkusz może użyć
//    zmiennych ustawianych przez CvPages: --accent, --on-accent (tekst na akcencie) i marginesów --cv-margin-*,
// 3. nazwa w `editor.templateNames` w słownikach interfejsu (shared/i18n),
// 4. podbicie CV_SCHEMA_VERSION z pustą migracją w migrations.ts (ADR 0002).
export const cvTemplateIds = ['classic', 'modern', 'bold'] as const
export type CvTemplateId = (typeof cvTemplateIds)[number]

// CV language (zob. GLOSSARY.md): język, w którym napisane jest CV. Te same języki co Interface language.
export const cvLanguageCodes = interfaceLanguageCodes
export type CvLanguage = (typeof cvLanguageCodes)[number]

// Bieżąca wersja schematu CV. Zmiana schematu = podbicie wersji i migracja ze starej (patrz migrations.ts).
export const CV_SCHEMA_VERSION = 6

export const cvDocumentSchema = z.object({
  schemaVersion: z.literal(CV_SCHEMA_VERSION),
  id: idSchema,
  name: z.string(),
  // Tagi CV (zob. GLOSSARY.md): prywatne etykiety do porządkowania biblioteki, nigdy nie trafiają do dokumentu.
  // Zarządza nimi wyłącznie lista CV (repozytorium normalizuje je przy ustawianiu).
  tags: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  settings: z.object({
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.enum(['lato', 'source-sans-3', 'arimo']),
    // Szablon, którym CV jest renderowane. Nieznany szablon = niepoprawny plik (bez cichego zastępowania, ADR 0002).
    template: z.enum(cvTemplateIds),
    // CV language: decyduje o stałym tekście na dokumencie (np. „present”) i atrybucie `lang` stron.
    // Zmiana nigdy nie przepisuje treści CV (np. tytułów sekcji).
    language: z.enum(cvLanguageCodes)
  }),
  header: z.object({
    fullName: z.string(),
    photo: z.object({ dataUrl: z.string() }).nullable(),
    contacts: z.array(z.object({ id: idSchema, label: z.string(), value: z.string() })),
    summary: z.string()
  }),
  sections: z.array(sectionSchema),
  consent: z.object({
    enabled: z.boolean(),
    clauseId: idSchema.nullable(),
    text: z.string()
  })
})
export type CvDocument = z.infer<typeof cvDocumentSchema>

// CV language, których pełnego alfabetu nie ma Lato (cyrylica, wietnamski) – CV w nich startuje z Source Sans 3.
const languagesStartingWithSourceSans: readonly CvLanguage[] = ['ru', 'uk', 'vi']

// Ustawienia nowego CV (także Sample CV) w danym CV language.
export const defaultCvSettings = (language: CvLanguage): CvDocument['settings'] => ({
  accentColor: '#1a6e72',
  font: languagesStartingWithSourceSans.includes(language) ? 'source-sans-3' : 'lato',
  template: 'classic',
  language
})

export const clauseSchema = z.object({ id: idSchema, name: z.string(), text: z.string() })
export type Clause = z.infer<typeof clauseSchema>

export const clauseContentSchema = clauseSchema.omit({ id: true })
export type ClauseContent = z.infer<typeof clauseContentSchema>

// Nazwa CV do wyświetlenia – CV z pustą nazwą (np. z importowanego pliku) dostaje `untitled` w języku interfejsu.
export const cvDisplayName = (name: string, untitled: string) => name.trim() || untitled

// Nazwa klauzuli do wyświetlenia – dla klauzuli bez nazwy `untitled` w języku interfejsu.
export const clauseName = (clause: Pick<Clause, 'name'>, untitled: string) => clause.name.trim() || untitled

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  clauses: z.array(clauseSchema),
  defaultClauseId: idSchema.nullable(),
  // Wybrany język interfejsu. Brak pola = język systemu (bez podbijania wersji schematu).
  interfaceLanguage: z.enum(interfaceLanguageCodes).optional(),
  // Wybrany wygląd interfejsu (Appearance). Brak pola = Systemowy (bez podbijania wersji schematu).
  appearance: z.enum(appearances).optional()
})
export type AppSettings = z.infer<typeof appSettingsSchema>
