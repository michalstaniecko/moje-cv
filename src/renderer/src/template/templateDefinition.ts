import type { ComponentType } from 'react'
import type { CvBlock } from '../domain/blocks'
import type { TemplateGeometry } from '../domain/templateGeometry'

type BlockKind = CvBlock['kind']

// Komponent rysujący treść bloku jednego rodzaju (bez opakowania .cv-block z odstępem).
export type BlockContentView<K extends BlockKind> = ComponentType<{ block: Extract<CvBlock, { kind: K }> }>

// Nadpisania wspólnych komponentów bloków – rodzaj bloku bez wpisu rysuje komponent wspólny.
export type BlockViewOverrides = { [K in BlockKind]?: BlockContentView<K> }

// Definicja szablonu (zob. „Template” w GLOSSARY.md): wszystko, czym szablon różni się od innych.
export type TemplateDefinition = {
  // Klasa na korzeniu dokumentu, do której zawężony jest arkusz stylów szablonu.
  className: string
  geometry: TemplateGeometry
  blockViews: BlockViewOverrides
}
