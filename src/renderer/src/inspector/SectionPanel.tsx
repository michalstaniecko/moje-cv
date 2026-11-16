import { useId, useRef } from 'react'
import type { Section } from '../domain/schema'
import { moveSection, updateSection } from '../editor/documentEdits'
import { useDictionary } from '../i18n'
import type { PanelProps } from './ElementPanel'
import { InspectorSwitch } from './InspectorSwitch'
import { SectionItems } from './SectionItems'

// Ten sam klucz łączenia kroków cofania co tytuł sekcji na stronie i w CV form: wpisanie nazwy to jeden krok.
const titleMergeKey = (section: Section) => `section:${section.id}:title`

// Panel sekcji Inspektora (#139): nazwa (tytuł sekcji – jedyna treść CV edytowana w Inspektorze), „Pokaż na CV”,
// „Zacznij od nowej strony”, kolejność ↑/↓ z pozycją („2 z 5”) i lista pozycji. Każda zmiana to jeden krok cofania.
// Działa także dla sekcji ukrytej i pustej, których nie ma na stronach.
export function SectionPanel({ editor, document, session, section }: PanelProps & { section: Section }) {
  const t = useDictionary().editor
  const index = document.sections.findIndex((candidate) => candidate.id === section.id)
  const total = document.sections.length
  const update = (patch: Parameters<typeof updateSection>[1], mergeKey?: string) =>
    editor.edit(updateSection(section.id, patch), mergeKey)

  return (
    <>
      <label className="inspector-field">
        <span className="inspector-label">{t.inspector.section.name}</span>
        <input
          value={section.title}
          placeholder={t.sectionTypes[section.type]}
          onChange={(event) => update({ title: event.target.value }, titleMergeKey(section))}
        />
      </label>
      <div className="inspector-field">
        <InspectorSwitch label={t.inspector.showOnCv} part="section" checked={!section.hidden} onChange={(shown) => update({ hidden: !shown })} />
        <InspectorSwitch
          label={t.inspector.section.newPage}
          checked={section.pageBreakBefore}
          onChange={(pageBreakBefore) => update({ pageBreakBefore })}
        />
      </div>
      <SectionOrder index={index} total={total} onMove={(toIndex) => editor.edit(moveSection(section.id, toIndex))} />
      <SectionItems document={document} section={section} session={session} />
      {/* #140: przycisk „+ Dodaj …” (brzmienie z pigułek „+”) pod listą pozycji. */}
    </>
  )
}

// Kolejność sekcji: ↑/↓ i pozycja „2 z 5”. Na skraju listy przycisk w tę stronę jest nieaktywny, więc fokus przechodzi
// na drugi.
function SectionOrder({ index, total, onMove }: { index: number; total: number; onMove: (toIndex: number) => void }) {
  const t = useDictionary().editor
  const label = useId()
  const up = useRef<HTMLButtonElement>(null)
  const down = useRef<HTMLButtonElement>(null)
  const move = (toIndex: number) => {
    onMove(toIndex)
    if (toIndex === 0) down.current?.focus()
    if (toIndex === total - 1) up.current?.focus()
  }
  return (
    <div className="inspector-field">
      <span id={label} className="inspector-label">
        {t.inspector.section.order}
      </span>
      <div role="group" aria-labelledby={label} className="inspector-order">
        <button
          ref={up}
          type="button"
          aria-label={t.order.moveUp}
          title={t.order.moveUp}
          disabled={index <= 0}
          onClick={() => move(index - 1)}
        >
          ↑
        </button>
        <span className="inspector-order-position">{t.inspector.section.position(index + 1, total)}</span>
        <button
          ref={down}
          type="button"
          aria-label={t.order.moveDown}
          title={t.order.moveDown}
          disabled={index >= total - 1}
          onClick={() => move(index + 1)}
        >
          ↓
        </button>
      </div>
    </div>
  )
}
