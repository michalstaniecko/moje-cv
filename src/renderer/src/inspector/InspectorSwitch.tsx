// Przełącznik w panelu elementu Inspektora (np. „Pokaż na CV”, „Zacznij od nowej strony”): napis i przełącznik
// w jednym wierszu, nazwa przełącznika z napisu. Wygląd jak przełączniki listy „CV elements”.
// `part` – rodzaj części CV, której widoczność przełącza (`data-switch`; np. PHOTO_SWITCH_SELECTOR w CvElements.tsx).
export function InspectorSwitch({
  label,
  checked,
  onChange,
  part
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  part?: string
}) {
  return (
    <label className="inspector-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        className="cv-element-switch"
        data-switch={part}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
