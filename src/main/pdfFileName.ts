import type { InterfaceLanguage } from '../shared/i18n/languages'

// Domyślna nazwa pliku PDF – czysty moduł (bez Electrona), żeby dało się go testować jednostkowo.
// Kolejność: imię i nazwisko („CV_Anna_Obraztsova.pdf”) → nazwa CV z biblioteki → „CV.pdf”.
// Nazwa zawiera tylko [A-Za-z0-9-] i „_”, żeby plik dało się bez problemu wysłać i otworzyć wszędzie.

const MAX_BASE_LENGTH = 100

// Litery łacińskie, których NFD nie rozkłada na literę bazową + znak łączący.
const LATIN: Record<string, string> = {
  ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ı: 'i', ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'Ae', ø: 'o', Ø: 'O',
  œ: 'oe', Œ: 'Oe', þ: 'th', Þ: 'Th', ð: 'd'
}

// Cyrylica według uproszczonego BGN/PCGN (rosyjski i każdy CV language poza `uk`).
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ґ: 'g', є: 'ye', і: 'i', ї: 'yi'
}

// Ukraiński system urzędowy z 2010 r., uproszczony (bez osobnych form na początku słowa); apostrof pominięty.
const UKRAINIAN: Record<string, string> = {
  ...CYRILLIC,
  г: 'h', и: 'y', 'ʼ': '', '’': '', "'": ''
}

// Wielka litera wieloznakowa daje tylko pierwszą literę wielką („Ж” → „Zh”).
function mapLetter(letter: string, map: Record<string, string>): string {
  const lower = letter.toLowerCase()
  const mapped = map[lower]
  if (mapped === undefined) return letter
  return letter === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1)
}

// Kolejność ma znaczenie: jawne mapy przed NFD, bo NFD rozłożyłoby „й” i „ё” na literę + znak łączący.
export function transliterate(text: string, language: InterfaceLanguage): string {
  const cyrillic = language === 'uk' ? UKRAINIAN : CYRILLIC
  return Array.from(text, (letter) => LATIN[letter] ?? mapLetter(letter, cyrillic))
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function words(text: string, language: InterfaceLanguage): string[] {
  return transliterate(text, language)
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9-]/g, ''))
    .filter((word) => /[A-Za-z0-9]/.test(word))
}

export function pdfFileName({
  fullName,
  cvName,
  language
}: {
  fullName: string
  cvName: string
  language: InterfaceLanguage
}): string {
  const fromName = words(fullName, language)
  const parts = fromName.length > 0 ? fromName : words(cvName, language).filter((word) => word.toLowerCase() !== 'cv')
  if (parts.length === 0) return 'CV.pdf'
  const base = ['CV', ...parts].join('_').slice(0, MAX_BASE_LENGTH).replace(/[_-]+$/, '')
  return `${base}.pdf`
}
