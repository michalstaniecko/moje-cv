// Pomocnik testów arkuszy szablonów (tylko testy).
// Selektory wszystkich reguł arkusza (bez nagłówków @media itp.).
export function selectorsOf(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...withoutComments.matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1]!.trim())
    .filter((prelude) => !prelude.startsWith('@'))
    .flatMap((prelude) => prelude.split(',').map((selector) => selector.trim()))
}
