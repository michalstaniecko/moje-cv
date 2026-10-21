import type { Clause, CvDocument, EducationItem, ExperienceItem, Section, TextItem } from '../domain/schema'

type Contact = CvDocument['header']['contacts'][number]
type Change<T> = (value: T) => T

const replaceById = <T extends { id: string }>(items: T[], id: string, change: Change<T>): T[] =>
  items.map((item) => (item.id === id ? change(item) : item))

// Przenosi element o podanym id na pozycję `toIndex` (liczoną po wyjęciu go z listy).
const moveById = <T extends { id: string }>(items: T[], id: string, toIndex: number): T[] => {
  const from = items.findIndex((item) => item.id === id)
  if (from === -1) return items
  const rest = items.filter((item) => item.id !== id)
  const to = Math.max(0, Math.min(toIndex, rest.length))
  return [...rest.slice(0, to), items[from]!, ...rest.slice(to)]
}

const newId = (): string => crypto.randomUUID()

export const updateSettings =
  (patch: Partial<CvDocument['settings']>): Change<CvDocument> =>
  (document) => ({ ...document, settings: { ...document.settings, ...patch } })

export const updateHeader =
  (patch: Partial<CvDocument['header']>): Change<CvDocument> =>
  (document) => ({ ...document, header: { ...document.header, ...patch } })

export const updateConsent =
  (patch: Partial<Pick<CvDocument['consent'], 'enabled' | 'text'>>): Change<CvDocument> =>
  (document) => ({ ...document, consent: { ...document.consent, ...patch } })

// Wybór (albo przywrócenie) klauzuli z biblioteki: CV dostaje kopię jej treści – późniejsze zmiany w CV nie ruszają biblioteki.
export const applyClause =
  (clause: Clause): Change<CvDocument> =>
  (document) => ({ ...document, consent: { ...document.consent, clauseId: clause.id, text: clause.text } })

const updateContacts =
  (change: Change<Contact[]>): Change<CvDocument> =>
  (document) => updateHeader({ contacts: change(document.header.contacts) })(document)

export const addContact = (): Change<CvDocument> =>
  updateContacts((contacts) => [...contacts, { id: newId(), label: '', value: '' }])

export const updateContact = (id: string, patch: Partial<Omit<Contact, 'id'>>): Change<CvDocument> =>
  updateContacts((contacts) => replaceById(contacts, id, (contact) => ({ ...contact, ...patch })))

export const removeContact = (id: string): Change<CvDocument> =>
  updateContacts((contacts) => contacts.filter((contact) => contact.id !== id))

type ItemsByType = { experience: ExperienceItem[]; education: EducationItem[]; list: TextItem[] }

// Zmienia wpisy sekcji o podanym id, o ile jest ona danego typu.
const updateSectionItems =
  <T extends Section['type']>(sectionId: string, type: T, change: Change<ItemsByType[T]>): Change<CvDocument> =>
  (document) => ({
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId && section.type === type
        ? ({ ...section, items: change(section.items as ItemsByType[T]) } as Section)
        : section
    )
  })

const updateExperienceItems = (sectionId: string, change: Change<ExperienceItem[]>): Change<CvDocument> =>
  updateSectionItems(sectionId, 'experience', change)

export const addExperienceItem = (sectionId: string): Change<CvDocument> =>
  updateExperienceItems(sectionId, (items) => [
    ...items,
    {
      id: newId(),
      role: '',
      company: '',
      location: '',
      start: null,
      end: null,
      bullets: [{ id: newId(), text: '' }],
      pageBreakBefore: false
    }
  ])

export const updateExperienceItem = (
  sectionId: string,
  itemId: string,
  change: Change<ExperienceItem>
): Change<CvDocument> => updateExperienceItems(sectionId, (items) => replaceById(items, itemId, change))

export const removeExperienceItem = (sectionId: string, itemId: string): Change<CvDocument> =>
  updateExperienceItems(sectionId, (items) => items.filter((item) => item.id !== itemId))

const updateBullets = (sectionId: string, itemId: string, change: Change<ExperienceItem['bullets']>) =>
  updateExperienceItem(sectionId, itemId, (item) => ({ ...item, bullets: change(item.bullets) }))

export const addBullet = (sectionId: string, itemId: string): Change<CvDocument> =>
  updateBullets(sectionId, itemId, (bullets) => [...bullets, { id: newId(), text: '' }])

export const updateBullet = (sectionId: string, itemId: string, bulletId: string, text: string): Change<CvDocument> =>
  updateBullets(sectionId, itemId, (bullets) => replaceById(bullets, bulletId, (bullet) => ({ ...bullet, text })))

export const removeBullet = (sectionId: string, itemId: string, bulletId: string): Change<CvDocument> =>
  updateBullets(sectionId, itemId, (bullets) => bullets.filter((bullet) => bullet.id !== bulletId))

export const moveSection = (sectionId: string, toIndex: number): Change<CvDocument> => (document) => ({
  ...document,
  sections: moveById(document.sections, sectionId, toIndex)
})

type SectionSettings = Pick<Section, 'title' | 'hidden' | 'pageBreakBefore'>

export const updateSection = (sectionId: string, patch: Partial<SectionSettings>): Change<CvDocument> => (document) => ({
  ...document,
  sections: replaceById(document.sections, sectionId, (section) => ({ ...section, ...patch }))
})

const updateEducationItems = (sectionId: string, change: Change<EducationItem[]>): Change<CvDocument> =>
  updateSectionItems(sectionId, 'education', change)

export const addEducationItem = (sectionId: string): Change<CvDocument> =>
  updateEducationItems(sectionId, (items) => [
    ...items,
    { id: newId(), level: '', field: '', institution: '', start: null, end: null, pageBreakBefore: false }
  ])

export const updateEducationItem = (
  sectionId: string,
  itemId: string,
  patch: Partial<Omit<EducationItem, 'id'>>
): Change<CvDocument> =>
  updateEducationItems(sectionId, (items) => replaceById(items, itemId, (item) => ({ ...item, ...patch })))

export const removeEducationItem = (sectionId: string, itemId: string): Change<CvDocument> =>
  updateEducationItems(sectionId, (items) => items.filter((item) => item.id !== itemId))

const updateListItems = (sectionId: string, change: Change<TextItem[]>): Change<CvDocument> =>
  updateSectionItems(sectionId, 'list', change)

export const addListItem = (sectionId: string): Change<CvDocument> =>
  updateListItems(sectionId, (items) => [...items, { id: newId(), text: '' }])

export const updateListItem = (sectionId: string, itemId: string, text: string): Change<CvDocument> =>
  updateListItems(sectionId, (items) => replaceById(items, itemId, (item) => ({ ...item, text })))

export const removeListItem = (sectionId: string, itemId: string): Change<CvDocument> =>
  updateListItems(sectionId, (items) => items.filter((item) => item.id !== itemId))

export const moveItem = (sectionId: string, itemId: string, toIndex: number): Change<CvDocument> => (document) => ({
  ...document,
  sections: document.sections.map((section) =>
    section.id === sectionId ? ({ ...section, items: moveById<Section['items'][number]>(section.items, itemId, toIndex) } as Section) : section
  )
})

export const moveBullet = (sectionId: string, itemId: string, bulletId: string, toIndex: number): Change<CvDocument> =>
  updateBullets(sectionId, itemId, (bullets) => moveById(bullets, bulletId, toIndex))
