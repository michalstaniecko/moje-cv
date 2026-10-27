import type { BlockContentView, PageFooterView, TemplateDefinition } from '../templateDefinition'
import './bold.css'

// „Wyrazisty” – akcent jako wypełnienie: pas nagłówka ze spadem, tytuły-pigułki, kwadratowe znaczniki (issue #39).
// Tytuł sekcji i kolejne punkty doświadczenia rysuje wspólny markup – wystarcza im arkusz.

const Header: BlockContentView<'header'> = ({ block }) => {
  const hasBand = block.fullName.trim() || block.contacts.length > 0 || block.photoUrl
  return (
    <header className={block.photoUrl ? 'cv-header cv-header--photo' : 'cv-header'}>
      {hasBand && (
        <div className="cv-band">
          <div className="cv-band-main">
            {block.fullName.trim() && <h1 className="cv-name">{block.fullName}</h1>}
            {block.contacts.length > 0 && (
              <ul className="cv-contact">
                {block.contacts.map((contact) => (
                  <li key={contact.id} className="cv-contact-item">
                    {contact.label.trim() && <span className="cv-contact-label">{contact.label}</span>}
                    <span>{contact.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {block.photoUrl && <img className="cv-photo" src={block.photoUrl} alt="" />}
        </div>
      )}
      {block.summary.trim() && <p className="cv-summary">{block.summary}</p>}
    </header>
  )
}

// Daty na jasnym odcieniu akcentu – tylko gdy niepuste, żeby nie zostawało puste tło.
const ExperienceEntry: BlockContentView<'experienceEntry'> = ({ block }) => (
  <div className="cv-entry">
    {(block.role.trim() || block.dates) && (
      <div className="cv-role-row">
        <div className="cv-role">{block.role}</div>
        {block.dates && <div className="cv-date">{block.dates}</div>}
      </div>
    )}
    {block.companyLine && <div className="cv-company">{block.companyLine}</div>}
    {block.firstBullet !== null && (
      <ul className="cv-bullets">
        <li>{block.firstBullet}</li>
      </ul>
    )}
  </div>
)

const EducationEntry: BlockContentView<'educationEntry'> = ({ block }) => (
  <div className="cv-entry">
    <div className="cv-role-row">
      <div>
        {block.level && <strong className="cv-education-level">{block.level}</strong>}
        {block.level && block.details && ', '}
        {block.details}
      </div>
      {block.dates && <div className="cv-date">{block.dates}</div>}
    </div>
  </div>
)

const ListRow: BlockContentView<'listRow'> = ({ block }) => (
  <ul className="cv-list-row">
    {block.items.map((item) => (
      <li key={item.id}>{item.text}</li>
    ))}
  </ul>
)

// Stopka w dolnym marginesie strony: imię i nazwisko po lewej, „n / N” po prawej; pasek akcentu przy krawędzi kartki rysuje arkusz.
const PageFooter: PageFooterView = ({ fullName, pageNumber, pageCount }) => (
  <footer className="cv-page-footer">
    {fullName.trim() && <span>{fullName}</span>}
    <span className="cv-page-number">
      {pageNumber} / {pageCount}
    </span>
  </footer>
)

export const boldTemplate = {
  className: 'cv-template-bold',
  geometry: {
    // Marginesy 14 / 15 / 14 / 15 mm → obszar treści 180 × 269 mm; dolny mieści stopkę z paskiem akcentu.
    pageMarginsMm: { top: 14, right: 15, bottom: 14, left: 15 },
    blockSpacingMm: {
      afterHeader: 7,
      beforeSectionTitle: 7,
      afterSectionTitle: 3.2,
      betweenBullets: 0.8,
      afterExperienceEntryWithoutBullets: 1,
      afterExperienceItem: 4.5,
      afterEducationItem: 2.4,
      afterEducationSection: 7,
      betweenListItems: 1.2,
      // Razem z odstępem między wierszami 7 mm po sekcji listowej.
      afterListSection: 5.8
    },
    listSectionLayout: { title: 'above', columns: 2 },
    consentGapMm: 6
  },
  blockViews: {
    header: Header,
    experienceEntry: ExperienceEntry,
    educationEntry: EducationEntry,
    listRow: ListRow
  },
  PageFooter
} as const satisfies TemplateDefinition
