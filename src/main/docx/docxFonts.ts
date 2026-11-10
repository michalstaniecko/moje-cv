import { join } from 'node:path'
import { app } from 'electron'
import { FONTS_SOURCE_DIRECTORY, readDocxFonts, type DocxFonts } from './fontFiles'

// Fonty do osadzania w DOCX export – jedyne miejsce zależne od `app`. W paczce katalog `fonts` z zasobów aplikacji
// (`extraResources` → `Contents/Resources/fonts`), w dev `resources/fonts` projektu. Pliki z wnętrza bundla są
// dostępne w sandboxie (ADR-0003), bez sieci i bez nowych entitlements.
const fontsDirectory = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'fonts') : join(app.getAppPath(), FONTS_SOURCE_DIRECTORY)

// Czytane przy pierwszym eksporcie i trzymane w pamięci; po nieudanym odczycie następny eksport próbuje znowu.
let loaded: Promise<DocxFonts> | undefined

export function docxFonts(): Promise<DocxFonts> {
  loaded ??= readDocxFonts(fontsDirectory()).catch((error: unknown) => {
    loaded = undefined
    throw error
  })
  return loaded
}
