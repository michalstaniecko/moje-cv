// PROTOTYP – kontrakt między CvScreen a wariantami. CvScreen liczy cały stan (edytor, sesja, eksport, zapis),
// a wariant decyduje WYŁĄCZNIE o układzie ekranu i o tym, gdzie i jak są opcje globalne.
import type { ReactNode, Ref } from 'react'
import type { EditSession } from '../canvas/useEditSession'
import type { Clause, ClauseContent, CvDocument } from '../domain/schema'
import type { CvEditor } from '../editor/cvEditor'

export type PrototypeShellProps = {
  editor: CvEditor
  document: CvDocument
  session: EditSession
  clauses: Clause[]
  saveClause: (content: ClauseContent) => Promise<Clause | null>
  saveStatus: string
  // Gotowe elementy obecnego ekranu – użyj albo zastąp własnymi.
  backButton: ReactNode
  nameHeading: ReactNode
  modeToggle: ReactNode
  exportButtons: ReactNode
  // Paski komunikatów (zapis, eksport) – wstaw pod swoim paskiem narzędzi.
  notices: ReactNode
  // Panel stron (PreviewPane z warstwą edycji). Musi być bezpośrednim dzieckiem kontenera z `panesRef`
  // i klasą `editor-panes` (siatka; kolumny ustaw sam przez `style={{ gridTemplateColumns }}`).
  preview: ReactNode
  // „Usunięto. Cofnij” – też dziecko kontenera `editor-panes`.
  removalMessage: ReactNode
  // Obecny pasek boczny (Outline / CV form / szyna) – opcjonalnie do ponownego użycia.
  currentSidebar: ReactNode
  panesRef: Ref<HTMLDivElement>
  exportJson: () => void
  // Domyślna szerokość lewej kolumny dla `.removal-message-anchor` – ustaw `--sidebar-width` na kontenerze.
}
