import { describe, expect, test } from 'vitest'
import { pl } from './pl'
import { uk } from './uk'

// Nazwa uchwytu wiersza to „Działania: <element>”, więc element stoi w mianowniku (inaczej niż w komunikatach
// „Przeniesiono <element>…”, gdzie jest w bierniku).
describe('row handle names in languages with grammatical case', () => {
  test('Polish names the row in the nominative', () => {
    expect(pl.editor.order.handle.section('Języki')).toBe('Działania: sekcja „Języki”')
    expect(pl.editor.order.handle.position('Kierownik')).toBe('Działania: stanowisko „Kierownik”')
    expect(pl.editor.order.handle.bullet(2)).toBe('Działania: punkt 2')
  })

  test('Ukrainian names the row in the nominative', () => {
    expect(uk.editor.order.handle.section('Мови')).toBe('Дії: розділ «Мови»')
    expect(uk.editor.order.handle.position('Менеджер')).toBe('Дії: посада «Менеджер»')
  })
})
