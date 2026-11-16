// Zdjęcie z listy „CV elements” Inspektora (docs/specs/outline-instead-of-cv-form.md, D2): wiersz „Photo” prosi warstwę edycji o to samo, co
// robią pasek „Add to CV” i przycisk zdjęcia na stronie – wybór zdjęcia z kadrowaniem (`add`; `from` – przycisk, na
// który wraca fokus po anulowaniu i przy którym stoi komunikat o pliku, którego nie da się wczytać) i fokus na
// przycisku zdjęcia na stronie (`focus`). Obsługę rejestruje warstwa edycji (`bind`); bez niej prośby nic nie robią.
export type PhotoHandlers = {
  add: (from: () => HTMLElement | null) => void
  focus: () => void
}

export function createPhotoRequests() {
  let handlers: PhotoHandlers | null = null
  return {
    bind(next: PhotoHandlers) {
      handlers = next
      return () => {
        if (handlers === next) handlers = null
      }
    },
    add: (from: () => HTMLElement | null) => handlers?.add(from),
    focus: () => handlers?.focus()
  }
}

export type PhotoRequests = ReturnType<typeof createPhotoRequests>
