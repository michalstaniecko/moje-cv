// Pole wyboru z etykietą – w CV form i w Field popovers (np. „I currently work here” w popoverze daty).
export function Checkbox({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="form-checkbox">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}
