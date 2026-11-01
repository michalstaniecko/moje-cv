import { useEffect, useRef, useState } from 'react'
import { useDictionary } from './i18n'

// Sponsor bar (zob. GLOSSARY.md): jedna linia na dole okna, na każdym ekranie. Nie da się jej zamknąć i nie ma
// żadnego stanu; w Mac App Store proces główny mówi, że jest niedostępna, i wtedy nie renderuje się nic (ADR-0005).
export function SponsorBar() {
  const [available, setAvailable] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const { appName, sponsor: t } = useDictionary()

  useEffect(() => {
    let active = true
    void window.api.sponsor.isAvailable().then((value) => {
      if (active) setAvailable(value)
    })
    return () => {
      active = false
    }
  }, [])

  if (!available) return null
  const open = () => void window.api.sponsor.open()

  return (
    <footer className="sponsor-bar" aria-label={t.bar}>
      <span className="sponsor-bar-message">{t.message(appName)}</span>
      <button type="button" className="sponsor-link" onClick={open}>
        {t.link}
      </button>
      <button type="button" className="sponsor-more" onClick={() => setMoreOpen(true)}>
        {t.more}
      </button>
      {moreOpen && <SponsorDialog onOpenLink={open} onClose={() => setMoreOpen(false)} />}
    </footer>
  )
}

// Okno „Więcej”: natywny <dialog> otwarty modalnie, zamykany Escape (zdarzenie `cancel`), przyciskiem Zamknij
// i kliknięciem w tło (kliknięcie poza treścią trafia w sam element <dialog>).
function SponsorDialog({ onOpenLink, onClose }: { onOpenLink: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { appName, sponsor: t } = useDictionary()
  const title = t.dialogTitle(appName)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="sponsor-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sponsor-dialog-content">
        <h2 className="form-section-title">{title}</h2>
        {t.paragraphs(appName).map((paragraph) => (
          <p key={paragraph} className="sponsor-dialog-paragraph">
            {paragraph}
          </p>
        ))}
        <div className="form-row form-row--spread">
          <button type="button" className="sponsor-link" onClick={onOpenLink}>
            {t.link}
          </button>
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </dialog>
  )
}
