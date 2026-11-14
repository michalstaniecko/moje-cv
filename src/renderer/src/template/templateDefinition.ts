import type { ComponentType } from 'react'
import type { CvBlock } from '../domain/blocks'
import type { TemplateGeometry } from '../domain/templateGeometry'

type BlockKind = CvBlock['kind']

// Komponent rysujący treść bloku jednego rodzaju (bez opakowania .cv-block z odstępem).
export type BlockContentView<K extends BlockKind> = ComponentType<{ block: Extract<CvBlock, { kind: K }> }>

// Nadpisania wspólnych komponentów bloków – rodzaj bloku bez wpisu rysuje komponent wspólny.
// Tekst każdego pola CV nadpisanie rysuje przez sloty edycji z editable.tsx (ADR-0010: `CvText`, `useShown`,
// `ContactLine`, `CompanyLine`, `EducationLine` / `EducationDetails`, `DateRange`) – w Edit mode to Page fields
// i żetony dat, w dokumencie ten sam markup co sam tekst. Nadpisanie trzyma się też kontraktu znaczników edycji
// (`editMarkupContract` w canvas/editTargets.ts): klasy .cv-name, .cv-photo, .cv-contact, .cv-summary,
// .cv-section-title, .cv-date i `li` w wierszach list – z nich warstwa edycji dzieli nagłówek na fragmenty, stawia
// uchwyty i ⚠ dat (domain/schema.ts, krok 5 „Nowy szablon”).
export type BlockViewOverrides = { [K in BlockKind]?: BlockContentView<K> }

// Stopka strony rysowana w dolnym marginesie, poza obszarem treści (nie wpływa na pomiar ani podział stron).
// `fullName` – imię i nazwisko z nagłówka CV; `pageCount` – liczba stron całego dokumentu (także w miniaturze).
export type PageFooterView = ComponentType<{ fullName: string; pageNumber: number; pageCount: number }>

// Definicja szablonu (zob. „Template” w GLOSSARY.md): wszystko, czym szablon różni się od innych.
export type TemplateDefinition = {
  // Klasa na korzeniu dokumentu, do której zawężony jest arkusz stylów szablonu.
  className: string
  geometry: TemplateGeometry
  blockViews: BlockViewOverrides
  // Bez stopki – strony bez stopki.
  PageFooter?: PageFooterView
}
