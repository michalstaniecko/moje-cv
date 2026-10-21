import { z } from 'zod'

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

export const cvDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  settings: z.object({
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.enum(['lato', 'source-sans-3', 'arimo'])
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

export const defaultCvSettings: CvDocument['settings'] = { accentColor: '#1a6e72', font: 'lato' }

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  clauses: z.array(z.object({ id: idSchema, name: z.string(), text: z.string() })),
  defaultClauseId: idSchema.nullable()
})
export type AppSettings = z.infer<typeof appSettingsSchema>
