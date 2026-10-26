// Porządek tagów do wyświetlenia: alfabetycznie z polskimi literami na swoich miejscach (ą po a, ł po l, ś po s),
// niezależnie od języka interfejsu – tagi nie należą do żadnego języka (zob. GLOSSARY.md).
const collator = new Intl.Collator('pl')

export const sortTags = (tags: readonly string[]): string[] => [...tags].sort(collator.compare)
