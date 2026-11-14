import { useDictionary } from '../../i18n'

// Ostrzeżenie (nie blokada) pod datami, gdy koniec jest wcześniej niż początek. Bez `role="alert"`, żeby nie przerywać
// pisania; pole daty końca wskazuje je przez `aria-describedby`.
export function DateOrderWarning({ id }: { id: string }) {
  const t = useDictionary().editor
  return (
    <p id={id} className="form-warning">
      {t.endBeforeStart}
    </p>
  )
}
