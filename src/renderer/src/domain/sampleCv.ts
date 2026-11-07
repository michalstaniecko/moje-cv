import type { InterfaceLanguage } from '../../../shared/i18n/languages'
import { CV_SCHEMA_VERSION, cvDocumentSchema, defaultCvSettings, type CvDocument, type CvLanguage } from './schema'
import { cs } from './samples/cs'
import { de } from './samples/de'
import { en } from './samples/en'
import { es } from './samples/es'
import { fr } from './samples/fr'
import { id } from './samples/id'
import { it } from './samples/it'
import { nl } from './samples/nl'
import { pl } from './samples/pl'
import { pt } from './samples/pt'
import { ro } from './samples/ro'
import { ru } from './samples/ru'
import { sv } from './samples/sv'
import { tr } from './samples/tr'
import { uk } from './samples/uk'
import { vi } from './samples/vi'

type Contact = { label: string; value: string }
type Position = { role: string; company: string; location: string }
type Education = { level: string; field: string; institution: string }

// Teksty jednego Sample CV. Struktura (sekcje, liczba pozycji i punktów) i daty są wspólne dla wszystkich
// języków i pochodzą z `sampleCv` niżej; krotki pilnują, żeby żaden wariant nie zgubił ani nie dodał punktu.
// Wariant ma być zlokalizowany, nie tylko przetłumaczony: lokalne imię, fikcyjne firmy, miasta, numer telefonu
// i nazwy stopni.
export type SampleCvText = {
  name: string
  fullName: string
  contacts: { phone: Contact; email: Contact; linkedin: Contact; city: Contact }
  summary: string
  experience: {
    title: string
    positions: [
      Position & { bullets: [string, string, string, string, string, string, string, string] },
      Position & { bullets: [string, string, string, string, string, string, string] },
      Position & { bullets: [string, string, string, string, string] },
      Position & { bullets: [string, string, string, string] }
    ]
  }
  education: { title: string; entries: [Education, Education] }
  skills: { title: string; items: [string, string, string, string, string] }
  languages: { title: string; items: [string, string] }
  hobby: { title: string; text: string }
  // Wbudowana klauzula zgody – tylko tam, gdzie jej tekst prawny jest zweryfikowany (dziś tylko po polsku).
  consent?: string
}

// Szara sylwetka w proporcjach 3:4 – zdjęcie zastępcze przykładowego CV.
const placeholderPhoto =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
      '<rect width="300" height="400" fill="#d9e2e2"/>' +
      '<circle cx="150" cy="150" r="70" fill="#a7b8b8"/>' +
      '<path d="M30 400c0-90 54-150 120-150s120 60 120 150z" fill="#a7b8b8"/>' +
      '</svg>'
  )

const bullets = (prefix: string, texts: string[]) =>
  texts.map((text, index) => ({ id: `${prefix}-b${index + 1}`, text }))

// Daty stanowisk i wykształcenia – te same w każdym języku.
const positionDates = [
  { start: { year: 2023, month: 3 }, end: 'present' },
  { start: { year: 2019, month: 2 }, end: { year: 2023, month: 2 } },
  { start: { year: 2016, month: 9 }, end: { year: 2019, month: 1 } },
  { start: { year: 2014, month: 7 }, end: { year: 2016, month: 8 } }
] as const
const educationDates = [
  { start: null, end: { year: 2024, month: 6 } },
  { start: { year: 2009, month: 10 }, end: { year: 2014, month: 6 } }
] as const

// Przykładowe CV z fikcyjnymi danymi, w układzie briefu, napisane w `language` (to jego CV language).
function sampleCv(language: CvLanguage, text: SampleCvText): CvDocument {
  const section = { hidden: false, pageBreakBefore: false }
  return cvDocumentSchema.parse({
    schemaVersion: CV_SCHEMA_VERSION,
    id: 'sample',
    name: text.name,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: defaultCvSettings(language),
    header: {
      fullName: text.fullName,
      photo: { dataUrl: placeholderPhoto },
      contacts: [text.contacts.phone, text.contacts.email, text.contacts.linkedin, text.contacts.city].map((contact, index) => ({
        id: `c${index + 1}`,
        ...contact
      })),
      summary: text.summary
    },
    sections: [
      {
        id: 'experience',
        type: 'experience',
        title: text.experience.title,
        ...section,
        items: text.experience.positions.map(({ bullets: texts, ...position }, index) => ({
          id: `e${index + 1}`,
          ...position,
          ...positionDates[index],
          pageBreakBefore: false,
          bullets: bullets(`e${index + 1}`, texts)
        }))
      },
      {
        id: 'education',
        type: 'education',
        title: text.education.title,
        ...section,
        items: text.education.entries.map((entry, index) => ({
          id: `ed${index + 1}`,
          ...entry,
          ...educationDates[index],
          pageBreakBefore: false
        }))
      },
      {
        id: 'skills',
        type: 'list',
        title: text.skills.title,
        ...section,
        items: text.skills.items.map((item, index) => ({ id: `s${index + 1}`, text: item }))
      },
      {
        id: 'languages',
        type: 'list',
        title: text.languages.title,
        ...section,
        items: text.languages.items.map((item, index) => ({ id: `l${index + 1}`, text: item }))
      },
      {
        id: 'hobby',
        type: 'list',
        title: text.hobby.title,
        ...section,
        hidden: true,
        items: [{ id: 'h1', text: text.hobby.text }]
      }
    ],
    consent: text.consent
      ? { enabled: true, clauseId: null, text: text.consent }
      : { enabled: false, clauseId: null, text: '' }
  })
}

const texts: Record<InterfaceLanguage, SampleCvText> = { cs, de, en, es, fr, id, it, nl, pl, pt, ro, ru, sv, tr, uk, vi }

// Przykładowe CV tworzone przy pierwszym uruchomieniu i na żądanie – w języku interfejsu z tej chwili.
export const sampleCvs = Object.fromEntries(
  Object.entries(texts).map(([language, text]) => [language, sampleCv(language as InterfaceLanguage, text)])
) as Record<InterfaceLanguage, CvDocument>
