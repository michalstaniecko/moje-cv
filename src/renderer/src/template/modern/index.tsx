import type { BlockContentView, PageFooterView, TemplateDefinition } from '../templateDefinition'
import './modern.css'

// „Nowoczesny” – wygląd z projektu Claude Design „Moje CV – Szablon Nowoczesny” (issue #37).
// Tytuł sekcji i kolejne punkty doświadczenia rysuje wspólny markup – wystarcza im arkusz.

const Header: BlockContentView<'header'> = ({ block }) => (
  <header className="cv-header">
    <div className="cv-header-main">
      {block.fullName.trim() && (
        <>
          <h1 className="cv-name">{block.fullName}</h1>
          <div className="cv-name-bar" aria-hidden />
        </>
      )}
      {block.contacts.length > 0 && (
        <div className="cv-contact">
          {block.contacts.map((contact) => (
            <div key={contact.id}>
              {contact.label.trim() && <div className="cv-contact-label">{contact.label}</div>}
              <div>{contact.value}</div>
            </div>
          ))}
        </div>
      )}
      {block.summary.trim() && <p className="cv-summary">{block.summary}</p>}
    </div>
    {block.photoUrl && <img className="cv-photo" src={block.photoUrl} alt="" />}
  </header>
)

const ExperienceEntry: BlockContentView<'experienceEntry'> = ({ block }) => (
  <div className="cv-entry">
    <span className="cv-dot" aria-hidden />
    {(block.role.trim() || block.dates) && (
      <div className="cv-role-row">
        <div className="cv-role">{block.role}</div>
        <div className="cv-date">{block.dates}</div>
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
    <span className="cv-dot" aria-hidden />
    <div className="cv-role-row">
      <div>
        {block.level && <strong className="cv-education-level">{block.level}</strong>}
        {block.level && block.details && ', '}
        {block.details}
      </div>
      <div className="cv-date">{block.dates}</div>
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

// Stopka w dolnym marginesie strony: imię i nazwisko po lewej, „n / N” po prawej.
const PageFooter: PageFooterView = ({ fullName, pageNumber, pageCount }) => (
  <footer className="cv-page-footer">
    {fullName.trim() && <span>{fullName}</span>}
    <span className="cv-page-number">
      {pageNumber} / {pageCount}
    </span>
  </footer>
)

export const modernTemplate = {
  className: 'cv-template-modern',
  geometry: {
    // Marginesy 14 / 15 / 12 / 15 mm → obszar treści 180 × 271 mm.
    pageMarginsMm: { top: 14, right: 15, bottom: 12, left: 15 },
    // Odstępy z projektu (px przy 96 dpi → mm).
    blockSpacingMm: {
      afterHeader: 6,
      beforeSectionTitle: 6,
      afterSectionTitle: 3,
      betweenBullets: 0.8,
      afterExperienceEntryWithoutBullets: 0.8,
      afterExperienceItem: 4.2,
      afterEducationItem: 2,
      afterEducationSection: 6,
      betweenListItems: 1,
      // Razem z odstępem między wierszami ≈ 6 mm po sekcji listowej.
      afterListSection: 5
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
