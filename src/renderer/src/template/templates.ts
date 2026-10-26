import { cvTemplateIds, type CvTemplateId } from '../domain/schema'
import { classicTemplate } from './classic'
import type { TemplateDefinition } from './templateDefinition'

// Wszystkie templaty aplikacji, kluczowane identyfikatorami ze schematu CV.
// Nowy template = identyfikator w `cvTemplateIds` + wpis tutaj + podbicie schematu CV (ADR 0002).
export const templates = {
  classic: classicTemplate
} as const satisfies Record<CvTemplateId, TemplateDefinition>

export type TemplateId = CvTemplateId
export const templateIds = cvTemplateIds
