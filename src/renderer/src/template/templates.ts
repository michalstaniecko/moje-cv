import type { CvTemplateId } from '../domain/schema'
import { boldTemplate } from './bold'
import { classicTemplate } from './classic'
import { modernTemplate } from './modern'
import type { TemplateDefinition } from './templateDefinition'

// Wszystkie szablony aplikacji, kluczowane identyfikatorami ze schematu CV.
// Jak dodać nowy szablon – zob. komentarz przy `cvTemplateIds` w domain/schema.ts.
export const templates = {
  classic: classicTemplate,
  modern: modernTemplate,
  bold: boldTemplate
} as const satisfies Record<CvTemplateId, TemplateDefinition>
