// Tytuł dokumentu w metadanych eksportu – ten sam w PDF i DOCX, żeby oba eksporty się nie rozjechały.
export function exportDocumentTitle(fullName: string): string {
  return fullName ? `CV – ${fullName}` : 'CV'
}
