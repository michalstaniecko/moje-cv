import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { isEndBeforeStart } from '../domain/dates'
import type { CvDocument, YearMonth } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'
import { Checkbox } from '../editor/fields/Checkbox'
import { DateOrderWarning } from '../editor/fields/DateOrderWarning'
import { MonthField } from '../editor/MonthField'
import { useDictionary } from '../i18n'
import type { JoinedFieldsProps, PageFieldProps } from '../template/editable'
import { FieldPopover } from './FieldPopover'
import { activateJoined, focusSibling, fragmentHandle, joinedTarget, leaveToPages, usePageFieldsContext } from './PageField'
import { dateChange, dateName, entryDates, isPositionEnd, moveField, pageFieldByKey } from './pageFields'
import { offsetOf, pageFieldElement, type ActiveFieldStore } from './useActiveField'

// Daty wpisów na stronach (docs/specs/wysiwyg-editing.md, W12): każda data to żeton daty – przycisk w miejscu daty
// w `.cv-date` (napis „03.2021”, „present” w CV language albo placeholder „From”/„To” w odsłoniętym wpisie). Klik, Enter
// albo spacja otwiera przy nim Field popover daty: pole miesiąca (`MonthField`, jak w CV form), przy końcu stanowiska
// „Obecnie tu pracuję”, „Wyczyść” i ostrzeżenie o odwróconych datach. Zmiana widać od razu na stronie; Escape i Enter
// zamykają popover i wracają na żeton.
// Poza rozwiniętym wpisem (aktywnym fragmentem) daty są jednym napisem jak w PDF (`JoinedDates`, jak linie złączone
// w PageField.tsx): klik rozwija wpis i otwiera popover daty pod kursorem, Tab i strzałki stawiają fokus na żetonie.

// Otwarty Field popover daty: klucz żetonu albo null. Mały magazyn poza stanem React (jak aktywne pole): otwarcie
// renderuje tylko żeton i popover, nie strony. `anchored` rośnie, gdy żeton otwartej daty pojawi się na stronie
// (popover otwarty z napisu dat czeka na żeton rozwiniętego wpisu, a żeton przeniesiony na inną stronę jest nowym
// węzłem).
export type DatePopoverStore = ReturnType<typeof createDatePopoverStore>
type DatePopoverState = { key: string | null; anchored: number }

export function createDatePopoverStore() {
  let state: DatePopoverState = { key: null, anchored: 0 }
  const listeners = new Set<() => void>()
  const set = (next: DatePopoverState) => {
    state = next
    for (const listener of listeners) listener()
  }
  return {
    get: () => state.key,
    state: () => state,
    open: (key: string) => {
      if (state.key !== key) set({ key, anchored: state.anchored })
    },
    close: () => {
      if (state.key !== null) set({ key: null, anchored: state.anchored })
    },
    // Żeton `key` właśnie zamontowany na stronie.
    mounted: (key: string) => {
      if (state.key === key) set({ key, anchored: state.anchored + 1 })
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

// Daty wpisu poza rozwiniętym fragmentem: ten sam węzeł tekstowy co w dokumencie, w jednym `span`. Klik rozwija wpis
// i otwiera popover daty pod kliknięciem; fokus z klawiatury (Tab, strzałki) rozwija wpis i stawia fokus na żetonie
// (z Shift+Tab – na ostatnim). W kontenerze pomiarowym – sam `span` z tekstem (ta sama geometria).
export function JoinedDates({ fields, separator, text, measuring }: JoinedFieldsProps) {
  if (measuring) return <span>{text}</span>
  return <DormantDates fields={fields} separator={separator} text={text} />
}

function DormantDates({ fields, separator, text }: Omit<JoinedFieldsProps, 'measuring'>) {
  const { active, dates } = usePageFieldsContext()
  const element = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const span = element.current
    if (!span) return
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      const point = window.document.caretPositionFromPoint(event.clientX, event.clientY)
      openDatesAt(span, point && span.contains(point.offsetNode) ? offsetOf(span, point.offsetNode, point.offset) : 0, active, dates)
    }
    const onFocus = (event: FocusEvent) => {
      const from = event.relatedTarget
      const backward = from instanceof Node && from.isConnected && (span.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      activateJoined(span, backward ? (span.textContent ?? '').length : 0, active)
    }
    span.addEventListener('mousedown', onMouseDown)
    span.addEventListener('focus', onFocus)
    return () => {
      span.removeEventListener('mousedown', onMouseDown)
      span.removeEventListener('focus', onFocus)
    }
  }, [active, dates])
  return (
    <span
      ref={element}
      className="cv-page-dates"
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      aria-label={fields.map((field) => (field.value ? `${field.label}: ${field.value}` : field.label)).join(', ')}
      aria-describedby={fields[0]?.describedBy}
      data-fragment={fields[0]?.fragment}
      data-joined={JSON.stringify(fields.map((field) => [field.key, field.value.length]))}
      data-separator={separator.length}
    >
      {text}
    </span>
  )
}

// Rozwija wpis napisu dat `span` i otwiera popover daty pod znakiem `offset`. Fokus dostaje popover, gdy żeton jest
// już na stronie (nie żeton: przywrócenie fokusu po nowym podziale stron – wejście we wpis z pustą datą go odsłania –
// zabrałoby go popoverowi); po zamknięciu popover oddaje go żetonowi.
export function openDatesAt(span: HTMLElement, offset: number, active: ActiveFieldStore, dates: DatePopoverStore) {
  const target = joinedTarget(span, offset)
  const fragment = span.dataset['fragment']
  if (!target || fragment === undefined) return
  active.activate({ key: target.key, fragment })
  dates.open(target.key)
}

// Żeton daty. W kontenerze pomiarowym – ten sam napis albo placeholder w zwykłym `span` (ta sama geometria).
export function DateToken({ field, text, measuring }: PageFieldProps) {
  if (measuring) {
    return (
      <span className="cv-page-date" data-placeholder={field.placeholder}>
        {text}
      </span>
    )
  }
  return <LiveDateToken field={field} text={text} />
}

function LiveDateToken({ field, text }: Omit<PageFieldProps, 'measuring'>) {
  const { editor, active, dates, announce } = usePageFieldsContext()
  const open = useSyncExternalStore(dates.subscribe, () => dates.get() === field.key)
  const element = useRef<HTMLSpanElement>(null)
  const t = useDictionary().editor
  const latest = useRef(field)
  const dictionary = useRef(t)
  useEffect(() => {
    latest.current = field
    dictionary.current = t
  })

  // Jak w Page field: obsługi podpięte przed malowaniem (żeton przemontowany na innej stronie dostaje fokus
  // z przywrócenia w tym samym commicie).
  useLayoutEffect(() => {
    const span = element.current
    if (!span) return
    const current = () => ({ key: latest.current.key, fragment: latest.current.fragment })
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      // Bez zaznaczania tekstu daty; fokus i popover (drugi klik zamyka).
      event.preventDefault()
      span.focus({ preventScroll: true })
      if (dates.get() === latest.current.key) dates.close()
      else dates.open(latest.current.key)
    }
    const onFocus = () => active.focused(current(), span)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if (event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        // ⌥⇧↑/↓ – cały wpis, jak z jego pól.
        event.preventDefault()
        const moved = moveField(latest.current.key, editor.store.getState().document, event.key === 'ArrowUp' ? -1 : 1)
        if (moved) {
          active.expect(current(), { start: 0, end: 0 })
          editor.edit(moved.change)
          announce(moved.announce(dictionary.current))
        }
        return
      }
      if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
        const handle = fragmentHandle(span, latest.current.fragment)
        if (handle) {
          event.preventDefault()
          handle.click()
        }
        return
      }
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      if (event.key === 'Escape') {
        event.preventDefault()
        leaveToPages(span)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        dates.open(latest.current.key)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        if (focusSibling(span, -1, false, active)) event.preventDefault()
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        if (focusSibling(span, 1, false, active)) event.preventDefault()
      }
    }
    span.addEventListener('mousedown', onMouseDown)
    span.addEventListener('focus', onFocus)
    span.addEventListener('keydown', onKeyDown)
    dates.mounted(latest.current.key)
    return () => {
      span.removeEventListener('mousedown', onMouseDown)
      span.removeEventListener('focus', onFocus)
      span.removeEventListener('keydown', onKeyDown)
    }
  }, [editor, active, dates, announce])

  return (
    <span
      ref={element}
      className="cv-page-date"
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={text ? `${field.label}: ${text}` : field.label}
      aria-describedby={field.describedBy}
      data-field-key={field.key}
      data-fragment={field.fragment}
      data-placeholder={field.placeholder}
    >
      {text}
    </span>
  )
}

// Field popover otwartej daty (albo nic). Żeton, którego już nie ma (wpis usunięty, cofnięty), zamyka popover.
export function DatePopover({
  editor,
  document,
  dates,
  active
}: {
  editor: CvEditor
  document: CvDocument
  dates: DatePopoverStore
  active: ActiveFieldStore
}) {
  const { key, anchored } = useSyncExternalStore(dates.subscribe, dates.state)
  const values = key === null ? null : entryDates(key, document)
  useEffect(() => {
    if (key !== null && !values) dates.close()
  }, [key, values, dates])
  if (key === null || !values) return null
  return (
    <DatePanel
      key={key}
      fieldKey={key}
      values={values}
      anchored={anchored}
      editor={editor}
      document={document}
      dates={dates}
      active={active}
    />
  )
}

type EntryDates = { start: YearMonth | null; end: YearMonth | 'present' | null }

function DatePanel({
  fieldKey,
  values,
  anchored,
  editor,
  document,
  dates,
  active
}: {
  fieldKey: string
  values: EntryDates
  anchored: number
  editor: CvEditor
  document: CvDocument
  dates: DatePopoverStore
  active: ActiveFieldStore
}) {
  const t = useDictionary().editor
  const panel = useRef<HTMLDivElement>(null)
  const warningId = useId()
  const field = pageFieldByKey(fieldKey, document, t)
  const isEnd = fieldKey.endsWith(':end')
  const value = isEnd ? values.end : values.start
  const reversed = isEndBeforeStart(values.start, values.end)
  const token = () => pageFieldElement(window.document, fieldKey)
  const change = (next: YearMonth | 'present' | null, merge: boolean) =>
    editor.edit(dateChange(fieldKey, next), merge ? fieldKey : undefined)

  // Koniec sprzed zaznaczenia „Obecnie tu pracuję” – wraca po odznaczeniu (jak w CV form).
  const endBeforePresent = useRef<YearMonth | null>(null)
  const togglePresent = (present: boolean) => {
    if (present && values.end !== 'present') endBeforePresent.current = values.end
    change(present ? 'present' : endBeforePresent.current, false)
  }

  // Zamknięcie: z powrotem na żeton (Escape, Enter) albo – gdy fokus poszedł gdzie indziej (klik obok, Tab) – żeton
  // przestaje być aktywnym polem, jeśli fokus nie trafił w inne pole (`blurred` sprawdza to po ustaleniu fokusu).
  const close = (returnFocus: boolean) => {
    dates.close()
    const element = token()
    if (returnFocus && element) {
      element.focus({ preventScroll: true })
      return
    }
    const activeField = field && { key: field.key, fragment: field.fragment }
    if (activeField) setTimeout(() => active.blurred(activeField))
  }

  // Popover stoi „za” żetonem: Shift+Tab z pierwszej kontrolki wraca na żeton, Tab z ostatniej – do pola za żetonem.
  const tabOut = (backward: boolean) => {
    close(true)
    const element = token()
    if (!backward && element) focusSibling(element, 1, false, active)
  }

  return (
    <FieldPopover
      anchor={token}
      anchored={anchored}
      label={field?.label}
      onClose={close}
      onTabOut={tabOut}
      onKeyDown={(event) => {
        // Enter w polu miesiąca zatwierdza datę i wraca na żeton.
        if (event.key === 'Enter' && (event.target as HTMLElement).matches('input[type="month"]')) {
          event.preventDefault()
          event.stopPropagation()
          close(true)
        }
      }}
    >
      <div ref={panel}>
        <MonthField
          label={dateName(fieldKey, t) ?? ''}
          value={value === 'present' ? null : value}
          disabled={value === 'present'}
          describedBy={reversed ? warningId : undefined}
          onChange={(next) => change(next, true)}
        />
        {isPositionEnd(fieldKey) && <Checkbox label={t.currentlyWorkHere} checked={value === 'present'} onChange={togglePresent} />}
        {reversed && <DateOrderWarning id={warningId} />}
        <div className="field-popover-actions">
          <button
            type="button"
            disabled={value === null}
            onClick={() => {
              change(null, false)
              panel.current?.querySelector<HTMLInputElement>('input[type="month"]')?.focus()
            }}
          >
            {t.clearDate}
          </button>
        </div>
      </div>
    </FieldPopover>
  )
}
