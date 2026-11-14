import { cvFontFamilies } from '../../../../shared/cvFonts'
import { interfaceLanguages } from '../../../../shared/i18n/languages'
import { cvLanguageCodes, type CvDocument, type CvLanguage } from '../../domain/schema'
import { useDictionary } from '../../i18n'
import type { Font } from '../../template/fonts'
import type { CvEditor } from '../cvEditor'
import { updateSettings } from '../documentEdits'
import { TemplatePicker } from '../TemplatePicker'

// CV design (zob. GLOSSARY.md): kolor akcentu (imię, tytuły sekcji, kropki przy datach), font, szablon i CV language –
// w CV form i w panelu „Projekt CV” w pasku narzędzi (te same klucze łączenia kroków cofania).
// Zmiana CV language zmienia tylko stały tekst na dokumencie, nie treść CV.
export function CvDesignFields({ editor, document }: { editor: CvEditor; document: CvDocument }) {
  const t = useDictionary().editor
  const { settings } = document
  return (
    <section className="form-section">
      <h2 className="form-section-title">{t.cvDesign}</h2>
      <div className="form-row">
        <label className="form-field">
          <span>{t.accentColor}</span>
          <input
            type="color"
            value={settings.accentColor}
            onChange={(event) => editor.edit(updateSettings({ accentColor: event.target.value }), 'settings:accentColor')}
          />
        </label>
        <label className="form-field">
          <span>{t.font}</span>
          <select
            value={settings.font}
            onChange={(event) =>
              editor.edit(updateSettings({ font: event.target.value as Font }))
            }
          >
            {Object.entries(cvFontFamilies).map(([font, name]) => (
              <option key={font} value={font}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TemplatePicker document={document} onChange={(template) => editor.edit(updateSettings({ template }))} />
      <div className="form-row">
        <label className="form-field">
          <span>{t.cvLanguage}</span>
          <select
            value={settings.language}
            onChange={(event) => editor.edit(updateSettings({ language: event.target.value as CvLanguage }))}
          >
            {cvLanguageCodes.map((language) => (
              <option key={language} value={language}>
                {interfaceLanguages[language].name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
