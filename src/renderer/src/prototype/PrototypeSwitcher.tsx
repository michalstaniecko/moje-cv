// PROTOTYP – pływający przełącznik wariantów (← / →, także klawiszami strzałek poza polami edycji).
import { useEffect } from 'react'
import { prototypeEnabled, prototypeVariants, setPrototypeVariant, usePrototypeVariant } from './prototypeVariant'
import './prototype.css'

export function PrototypeSwitcher() {
  const current = usePrototypeVariant()
  const index = prototypeVariants.findIndex((variant) => variant.key === current)
  const go = (step: number) => {
    const next = prototypeVariants[(index + step + prototypeVariants.length) % prototypeVariants.length]!
    setPrototypeVariant(next.key)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]')) return
      event.preventDefault()
      go(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (!prototypeEnabled) return null
  const variant = prototypeVariants[index]!
  return (
    <div className="prototype-switcher" role="group" aria-label="Prototype variant">
      <button type="button" tabIndex={-1} onClick={() => go(-1)} aria-label="Previous variant">←</button>
      <span>
        <strong>{variant.key}</strong> {variant.name}
      </span>
      <button type="button" tabIndex={-1} onClick={() => go(1)} aria-label="Next variant">→</button>
    </div>
  )
}
