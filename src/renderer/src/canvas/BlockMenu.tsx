import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { PaginateResult } from '../domain/paginate'
import type { CvDocument, Section } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import {
  addContact,
  moveItem,
  moveSection,
  removeContact,
  removeEducationItem,
  removeExperienceItem,
  updateEducationItem,
  updateExperienceItem,
  updateSection
} from '../editor/documentEdits'
import { educationName, entryName, removeContactLabel } from '../editor/fields/entryNames'
import { sectionName } from '../editor/fields/SectionTitleField'
import type { MoveOffset } from '../editor/moveShortcut'
import type { RemoveWithUndo } from '../editor/removalUndo'
import { RowMenu, type RowMenuAction } from '../editor/RowMenu'
import { useDictionary } from '../i18n'
import { addSectionElement } from './AddControls'
import { handleFragments, moveAmongShown, neighbourAfterHiding, sectionFragmentKeys } from './blockMoves'
import { sectionOf } from './editTargets'
import type { Fragment } from './fragmentRects'
import { readSelection } from './useActiveField'
import type { EditSession } from './useEditSession'

// Uchwyt 24×24 px stoi w marginesie kartki przed lewą krawędzią fragmentu, środkiem mniej więcej na wysokości
// pierwszej linii.
const HANDLE_SIZE = 24
const HANDLE_GAP = 4
const FIRST_LINE_OFFSET = 4

// Menu fragmentu strony (docs/specs/inline-editing-redesign.md, Q11, Q25): uchwyt `RowMenu` (bez przeciągania) przy
// tytułach sekcji i wpisach w Edit mode – „Przenieś wyżej/niżej” (także ⌥⇧↑/↓ na uchwycie), „Nowa strona przed”, a przy
// tytule sekcji też „Ukryj sekcję” i „Dodaj …”; przy kontaktach w nagłówku – „Dodaj kontakt” i „Usuń kontakt: …”.
// Każda zmiana to jeden krok cofania.
// - Uchwyty są poza kolejnością Tab (docs/specs/wysiwyg-editing.md, W22): mysz klika uchwyt, klawiatura otwiera menu
//   Shift+F10 / klawiszem menu w polu fragmentu (PageField.tsx); Escape wraca wtedy do pola.
// - Przeniesienie przeskakuje to, czego na stronach nie ma (ukryte i puste sekcje, puste wpisy), ogłasza nową pozycję
//   czytnikowi ekranu (jak `SortableList`) i zostawia fokus na uchwycie fragmentu w nowym miejscu – także na innej
//   stronie (uchwyt szukany po kluczu fragmentu po nowym pomiarze stron); menu otwarte z pola zostawia kursor w tym
//   polu, w tym samym miejscu (też „Nowa strona przed”).
// - „Ukryj sekcję” przenosi fokus na fragment za sekcją (albo przed nią).
// - „Dodaj …” dodaje element na końcu sekcji i stawia kursor w jego pierwszym polu na stronie (pusty jest odsłaniany).
// - „Usuń stanowisko” / „Usuń wykształcenie” (docs/specs/wysiwyg-editing.md, W21 – nie ma Edit card z tekstowym
//   przyciskiem usuwania): oddzielone kreską, z „Usunięto. Cofnij”; fokus przechodzi na fragment za wpisem (albo przed
//   nim), a „Cofnij” stawia kursor w pierwszym polu przywróconego wpisu.
export function useBlockMenu({
  editor,
  document,
  fragments,
  layout,
  layer,
  session,
  onFocusLost,
  onRemove
}: {
  editor: CvEditor
  document: CvDocument
  fragments: Fragment[]
  layout: PaginateResult | null
  layer: RefObject<HTMLElement | null>
  session: EditSession
  onFocusLost: () => void
  onRemove: RemoveWithUndo
}) {
  const t = useDictionary().editor
  const { announce } = session.announcer

  const handleButton = (key: string) =>
    layer.current?.querySelector<HTMLButtonElement>(`.edit-handle[data-fragment="${CSS.escape(key)}"] .row-handle`) ?? null
  // Pierwsze Page field fragmentu z tekstem (nie żeton daty), a bez niego pierwsze pole fragmentu.
  const fragmentButton = (key: string) => {
    const pages = layer.current?.parentElement
    const selector = `.cv-pages [data-fragment="${CSS.escape(key)}"]`
    return (
      pages?.querySelector<HTMLElement>(`${selector}[contenteditable]`) ??
      pages?.querySelector<HTMLElement>(selector) ??
      null
    )
  }

  // Fokus po zmianie: od razu na obecny element (pozycja menu zaraz zniknie), a po nowym pomiarze stron – na element
  // fragmentu w nowym miejscu (przestawienie przycisków w DOM albo przejście na inną stronę gubi fokus).
  const pendingFocus = useRef<{ key: string; on: 'handle' | 'fragment'; layout: PaginateResult | null } | null>(null)
  const focusAfterChange = (key: string, on: 'handle' | 'fragment') => {
    ;(on === 'handle' ? handleButton(key) : fragmentButton(key))?.focus()
    pendingFocus.current = { key, on, layout }
  }
  useLayoutEffect(() => {
    const pending = pendingFocus.current
    if (!pending || pending.layout === layout) return
    pendingFocus.current = null
    const element = pending.on === 'handle' ? handleButton(pending.key) : fragmentButton(pending.key)
    if (element) {
      if (window.document.activeElement !== element) element.focus()
    } else onFocusLost()
    // Tylko po nowym pomiarze fragmentów; `layout` porównany z tym sprzed zmiany odróżnia nowy podział stron.
  }, [fragments])

  const shownSections = new Set<string>()
  const shownItems = new Set<string>()
  for (const fragment of fragments) {
    if (fragment.target.kind === 'sectionTitle') shownSections.add(fragment.target.sectionId)
    if (fragment.target.kind === 'experienceItem' || fragment.target.kind === 'educationItem') shownItems.add(fragment.target.itemId)
  }
  const current = () => editor.store.getState().document
  // Menu otwarte z pola na stronie (`opener`, Shift+F10): po zmianie kursor wraca do tego pola w tym samym miejscu –
  // także gdy fragment przeszedł na inną stronę (pole przemontowane). Zwraca, czy tak będzie (inaczej fokus na uchwyt).
  const backToField = (opener: HTMLElement | null) => {
    const key = opener?.dataset['fieldKey']
    const fragment = opener?.dataset['fragment']
    if (!opener || key === undefined || fragment === undefined || !opener.closest('.cv-pages')) return false
    const end = (opener.textContent ?? '').length
    session.activeField.expect({ key, fragment }, readSelection(opener) ?? { start: end, end })
    return true
  }

  const moveActions = (
    plan: (offset: MoveOffset) => unknown,
    moveBy: (offset: MoveOffset, opener?: HTMLElement | null) => void
  ): RowMenuAction[] => [
    { label: t.order.moveUp, disabled: !plan(-1), run: ({ opener }) => moveBy(-1, opener) },
    { label: t.order.moveDown, disabled: !plan(1), run: ({ opener }) => moveBy(1, opener) }
  ]

  const sectionMenu = (fragment: Fragment, section: Section): BlockMenu => {
    const name = sectionName(section, t)
    const plan = (offset: MoveOffset) =>
      moveAmongShown(current().sections.map((candidate) => candidate.id), shownSections, section.id, offset)
    const moveBy = (offset: MoveOffset, opener: HTMLElement | null = null) => {
      const move = plan(offset)
      if (!move) return
      const kept = backToField(opener)
      editor.edit(moveSection(section.id, move.toIndex))
      announce(t.order.moved(t.order.section(name), move.position, move.total))
      if (!kept) focusAfterChange(fragment.key, 'handle')
    }
    const hide = () => {
      const keys = sectionFragmentKeys(section)
      const next = neighbourAfterHiding(fragments, keys)
      editor.edit(updateSection(section.id, { hidden: true }))
      if (next) focusAfterChange(next, 'fragment')
      else onFocusLost()
    }
    const add = () => {
      const target = addSectionElement(editor, section)
      if (target) session.focusPart(target)
    }
    const addLabel = { experience: t.addPosition, education: t.addEducation, list: t.addListItem }[section.type]
    return {
      label: t.order.handle.section(name),
      onMoveShortcut: moveBy,
      actions: [
        ...moveActions(plan, moveBy),
        {
          label: t.pageBreakBeforeSection,
          checked: section.pageBreakBefore,
          run: ({ opener }) => {
            const kept = backToField(opener)
            editor.edit(updateSection(section.id, { pageBreakBefore: !section.pageBreakBefore }))
            if (!kept) focusAfterChange(fragment.key, 'handle')
          }
        },
        { label: t.hideSection, run: hide },
        { label: addLabel, run: add }
      ]
    }
  }

  const entryMenu = (fragment: Fragment, section: Section, itemId: string): BlockMenu | null => {
    if (section.type === 'experience') {
      const item = section.items.find((candidate) => candidate.id === itemId)
      if (!item) return null
      const name = entryName(item.role, t.newPosition)
      return entryActions(fragment, section.id, itemId, {
        handleName: t.order.handle.position(name),
        movedName: t.order.position(name),
        pageBreakBefore: item.pageBreakBefore,
        setPageBreakBefore: (pageBreakBefore) => updateExperienceItem(section.id, itemId, (entry) => ({ ...entry, pageBreakBefore })),
        removeLabel: t.removePosition,
        remove: removeExperienceItem(section.id, itemId),
        firstField: `experience:${itemId}:role`
      })
    }
    if (section.type === 'education') {
      const item = section.items.find((candidate) => candidate.id === itemId)
      if (!item) return null
      const name = educationName(item, t)
      return entryActions(fragment, section.id, itemId, {
        handleName: t.order.handle.education(name),
        movedName: t.order.education(name),
        pageBreakBefore: item.pageBreakBefore,
        setPageBreakBefore: (pageBreakBefore) => updateEducationItem(section.id, itemId, { pageBreakBefore }),
        removeLabel: t.removeEducation,
        remove: removeEducationItem(section.id, itemId),
        firstField: `education:${itemId}:level`
      })
    }
    return null
  }

  const entryActions = (
    fragment: Fragment,
    sectionId: string,
    itemId: string,
    entry: {
      handleName: string
      movedName: string
      pageBreakBefore: boolean
      setPageBreakBefore: (pageBreakBefore: boolean) => (document: CvDocument) => CvDocument
      // „Usuń …”: nazwa pozycji, zmiana i klucz pierwszego pola wpisu (kursor po „Cofnij”).
      removeLabel: string
      remove: (document: CvDocument) => CvDocument
      firstField: string
    }
  ): BlockMenu => {
    const plan = (offset: MoveOffset) => {
      const latest = current().sections.find((candidate) => candidate.id === sectionId)
      return latest ? moveAmongShown(latest.items.map((candidate) => candidate.id), shownItems, itemId, offset) : null
    }
    const moveBy = (offset: MoveOffset, opener: HTMLElement | null = null) => {
      const move = plan(offset)
      if (!move) return
      const kept = backToField(opener)
      editor.edit(moveItem(sectionId, itemId, move.toIndex))
      announce(t.order.moved(entry.movedName, move.position, move.total))
      if (!kept) focusAfterChange(fragment.key, 'handle')
    }
    return {
      label: entry.handleName,
      onMoveShortcut: moveBy,
      actions: [
        ...moveActions(plan, moveBy),
        {
          label: t.pageBreakBeforeEntry,
          checked: entry.pageBreakBefore,
          run: ({ opener }) => {
            const kept = backToField(opener)
            editor.edit(entry.setPageBreakBefore(!entry.pageBreakBefore))
            if (!kept) focusAfterChange(fragment.key, 'handle')
          }
        },
        {
          label: entry.removeLabel,
          danger: true,
          run: () => {
            const next = neighbourAfterHiding(fragments, new Set([fragment.key]))
            session.datePopover.close()
            onRemove(entry.remove, {
              entryId: itemId,
              listId: sectionId,
              restore: () => session.activeField.request({ key: entry.firstField, fragment: fragment.key }, window.document, 'end')
            })
            if (next) focusAfterChange(next, 'fragment')
            else onFocusLost()
          }
        }
      ]
    }
  }

  // Kontakty w nagłówku (W14, docs/specs/outline-instead-of-cv-form.md, D5): „Dodaj kontakt” – nowy kontakt na końcu,
  // kursor w jego etykiecie na stronie; za kreską po jednym „Usuń kontakt: <etykieta / wartość>” na kontakt, z „Usunięto.
  // Cofnij”. Kolejność kontaktów zmienia się ⌥⇧↑/↓ w kontakcie na stronie (pageFields.ts) i z menu pola kontaktu
// (FieldMenu.tsx, D6), które pod „Move contact … up/down” ma też pozycje tego menu.
  // - Po usunięciu kursor w następnym kontakcie, a bez niego – w poprzednim; po ostatnim kontakcie fokus na uchwycie
  //   kontaktów, a gdy nagłówek kontaktów zniknął ze strony – `onFocusLost`.
  // - „Cofnij” stawia kursor w przywróconym kontakcie.
  const contactsMenu = (): BlockMenu => ({
    label: t.order.handle.contacts,
    onMoveShortcut: () => {},
    actions: [
      {
        label: t.addContact,
        run: () => {
          editor.edit(addContact())
          const added = current().header.contacts.at(-1)
          if (added) session.focusPart({ kind: 'contacts', contactId: added.id })
        }
      },
      ...document.header.contacts.map(
        (contact, index): RowMenuAction => ({
          label: removeContactLabel(contact, index, t),
          danger: true,
          run: () => {
            const contacts = current().header.contacts
            const at = contacts.findIndex((candidate) => candidate.id === contact.id)
            if (at === -1) return
            const next = contacts[at + 1] ?? contacts[at - 1]
            onRemove(removeContact(contact.id), {
              entryId: contact.id,
              listId: 'contacts',
              restore: () => session.focusPart({ kind: 'contacts', contactId: contact.id })
            })
            if (next) session.focusPart({ kind: 'contacts', contactId: next.id })
            else focusAfterChange('contacts', 'handle')
          }
        })
      )
    ]
  })

  const menuFor = (fragment: Fragment): BlockMenu | null => {
    const { target } = fragment
    if (target.kind === 'contacts') return contactsMenu()
    if (target.kind !== 'sectionTitle' && target.kind !== 'experienceItem' && target.kind !== 'educationItem') return null
    const section = document.sections.find((candidate) => candidate.id === target.sectionId)
    if (!section) return null
    return target.kind === 'sectionTitle' ? sectionMenu(fragment, section) : entryMenu(fragment, section, target.itemId)
  }

  const handles = [...handleFragments(fragments)].flatMap((fragment) => {
    const menu = menuFor(fragment)
    return menu ? [{ fragment, menu }] : []
  })

  // Menu otwarte z pola (Shift+F10) zostawia pole aktywne – rozwinięty wpis się nie zwija, a Escape wraca do tego
  // samego pola. Po zamknięciu, gdy fokus nie trafił w pole (np. Tab z menu), pole przestaje być aktywne.
  const onClosed = () =>
    requestAnimationFrame(() => {
      const field = session.activeField.get()
      const focused = window.document.activeElement
      if (field && !(focused instanceof HTMLElement && focused.closest('[data-field-popover]'))) session.activeField.blurred(field, focused)
    })

  return { handles, onClosed }
}

type BlockMenu = { label: string; actions: RowMenuAction[]; onMoveShortcut: (offset: MoveOffset) => void }

// Uchwyt menu fragmentu w marginesie kartki. Widać go przy najechaniu na fragment albo na uchwyt, przy fokusie w polu
// fragmentu i przy otwartym menu (app.css). Poza kolejnością Tab (W22) – z klawiatury Shift+F10 w polu fragmentu.
// `onClosed` – menu się zamknęło: pole, z którego je otwarto (zostaje aktywne, póki menu jest otwarte), przestaje być
// aktywne, jeśli fokus nie wrócił do pola.
export function BlockHandle({ fragment, menu, onClosed }: { fragment: Fragment; menu: BlockMenu; onClosed: () => void }) {
  const { rect } = fragment
  return (
    <div
      className="edit-handle"
      data-fragment={fragment.key}
      data-section={sectionOf(fragment.target) ?? undefined}
      data-page={fragment.page}
      style={{ top: rect.top - FIRST_LINE_OFFSET, left: rect.left - HANDLE_SIZE - HANDLE_GAP }}
    >
      <RowMenu
        label={menu.label}
        actions={menu.actions}
        onMoveShortcut={menu.onMoveShortcut}
        tabbable={false}
        keepsFieldActive
        onClosed={onClosed}
      />
    </div>
  )
}
