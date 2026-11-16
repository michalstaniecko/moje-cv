// PROTOTYP – opcje, których NIE MA w schemacie CV (v7). Stan tylko w pamięci, bez wpływu na strony, PDF i DOCX.
// Służą do sprawdzenia, czy układ opcji globalnych zmieści przyszłe ustawienia. W UI oznaczaj je <StubBadge />.
import { create } from 'zustand'

export type StubOptions = {
  fontSize: 'small' | 'normal' | 'large'
  density: 'compact' | 'normal' | 'airy'
  photoShape: 'template' | 'rectangle' | 'rounded' | 'circle'
  dateFormat: 'MM.YYYY' | 'MMM YYYY' | 'YYYY'
  pageSize: 'A4' | 'Letter'
}

export const useStubOptions = create<StubOptions & { set: (patch: Partial<StubOptions>) => void }>((set) => ({
  fontSize: 'normal',
  density: 'normal',
  photoShape: 'template',
  dateFormat: 'MM.YYYY',
  pageSize: 'A4',
  set: (patch) => set(patch)
}))
