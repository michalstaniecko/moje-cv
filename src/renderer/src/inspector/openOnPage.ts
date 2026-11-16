import { addSectionElement } from '../canvas/AddControls'
import { sectionEmpty } from '../canvas/addOnPage'
import { fragmentKey, type EditTarget } from '../canvas/editTargets'
import type { EditSession } from '../canvas/useEditSession'
import type { CvEditor } from '../editor/cvEditor'

// Część CV na liście „CV elements” Inspektora – ten sam kształt co zaznaczenie Inspektora ze specyfikacji #136.
export type CvElement = { kind: 'header' } | { kind: 'photo' } | { kind: 'section'; id: string } | { kind: 'consent' }

// Kursor w części CV na stronie: strony przewinięte do jej fragmentu (jeśli już tam jest) i `session.focusPart`
// (pusta część jest odsłaniana z placeholderem).
export function focusOnPage(session: EditSession, target: EditTarget) {
  window.document
    .querySelector(`.cv-pages [data-fragment="${CSS.escape(fragmentKey(target))}"]`)
    ?.scrollIntoView({ block: 'center' })
  session.focusPart(target)
}

// Skok z wiersza „CV elements” do części CV na stronie (Edit mode), jak dawniej w Outline:
// - nagłówek – kursor w imieniu i nazwisku;
// - zdjęcie – fokus na zdjęciu na stronie, a bez zdjęcia jego wybór jak w pasku „Add to CV” (`from` – wiersz, na który
//   wraca fokus po anulowaniu);
// - sekcja – kursor na końcu jej tytułu, a w pustej – w jej pierwszym elemencie (odsłoniętym, a bez elementów – nowym);
// - klauzula zgody – kursor w jej tekście.
// Ukrytej albo wyłączonej części nie ma na stronach, więc fokus zostaje na liście.
export function openOnPage(
  element: CvElement,
  { editor, session, from }: { editor: CvEditor; session: EditSession; from: () => HTMLElement | null }
) {
  const document = editor.store.getState().document
  switch (element.kind) {
    case 'header':
      focusOnPage(session, { kind: 'fullName' })
      return
    case 'photo': {
      const { photo } = document.header
      if (!photo) session.photo.add(from)
      else if (!photo.hidden) session.photo.focus()
      return
    }
    case 'section': {
      const section = document.sections.find((candidate) => candidate.id === element.id)
      if (!section || section.hidden) return
      if (!sectionEmpty(section, document)) {
        focusOnPage(session, { kind: 'sectionTitle', sectionId: section.id })
        return
      }
      const target = addSectionElement(editor, section, { reuseEmpty: true })
      if (target) focusOnPage(session, target)
      return
    }
    case 'consent':
      if (document.consent.enabled) focusOnPage(session, { kind: 'consent' })
  }
}
