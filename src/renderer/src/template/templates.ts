import { classicTemplate } from './classic'
import type { TemplateDefinition } from './templateDefinition'

// Wszystkie templaty aplikacji. Nowy template = wpis tutaj + podbicie schematu CV (ADR 0002).
export const templates = {
  classic: classicTemplate
} as const satisfies Record<string, TemplateDefinition>

export type TemplateId = keyof typeof templates
export const templateIds = Object.keys(templates) as TemplateId[]
export const DEFAULT_TEMPLATE_ID: TemplateId = 'classic'
