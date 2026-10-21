import type { CvDocument, ExperienceItem, Section } from '../domain/schema'

type Contact = CvDocument['header']['contacts'][number]
type Change<T> = (value: T) => T

const replaceById = <T extends { id: string }>(items: T[], id: string, change: Change<T>): T[] =>
  items.map((item) => (item.id === id ? change(item) : item))

const newId = (): string => crypto.randomUUID()

export const updateHeader =
  (patch: Partial<CvDocument['header']>): Change<CvDocument> =>
  (document) => ({ ...document, header: { ...document.header, ...patch } })

const updateContacts =
  (change: Change<Contact[]>): Change<CvDocument> =>
  (document) => updateHeader({ contacts: change(document.header.contacts) })(document)

export const addContact = (): Change<CvDocument> =>
  updateContacts((contacts) => [...contacts, { id: newId(), label: '', value: '' }])

export const updateContact = (id: string, patch: Partial<Omit<Contact, 'id'>>): Change<CvDocument> =>
  updateContacts((contacts) => replaceById(contacts, id, (contact) => ({ ...contact, ...patch })))

export const removeContact = (id: string): Change<CvDocument> =>
  updateContacts((contacts) => contacts.filter((contact) => contact.id !== id))

type ExperienceSection = Extract<Section, { type: 'experience' }>

const updateExperienceItems =
  (sectionId: string, change: Change<ExperienceItem[]>): Change<CvDocument> =>
  (document) => ({
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId && section.type === 'experience'
        ? ({ ...section, items: change(section.items) } satisfies ExperienceSection)
        : section
    )
  })

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
