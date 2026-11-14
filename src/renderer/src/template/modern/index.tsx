import { CompanyLine, CvText, EducationDetails, useShown } from '../editable'
import type { BlockContentView, PageFooterView, TemplateDefinition } from '../templateDefinition'
import './modern.css'

// „Nowoczesny” – wygląd z projektu Claude Design „Moje CV – Szablon Nowoczesny” (issue #37).
// Tytuł sekcji i kolejne punkty doświadczenia rysuje wspólny markup – wystarcza im arkusz.

const Header: BlockContentView<'header'> = ({ block }) => {
  const shownName = useShown(block, 'fullName', block.fullName)
  const shownSummary = useShown(block, 'summary', block.summary)
  return (
    <header className="cv-header">
      <div className="cv-header-main">
        {shownName && (
          <>
            <h1 className="cv-name">
              <CvText block={block} slot="fullName" text={block.fullName} />
            </h1>
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
        {shownSummary && (
          <p className="cv-summary">
            <CvText block={block} slot="summary" text={block.summary} />
          </p>
        )}
      </div>
      {block.photoUrl && <img className="cv-photo" src={block.photoUrl} alt="" />}
    </header>
  )
}

const ExperienceEntry: BlockContentView<'experienceEntry'> = ({ block }) => {
  const shownRole = useShown(block, 'role', block.role)
  const shownCompany = useShown(block, 'company', block.companyLine)
  return (
    <div className="cv-entry">
      <span className="cv-dot" aria-hidden />
      {(shownRole || block.dates) && (
        <div className="cv-role-row">
          <div className="cv-role">
            <CvText block={block} slot="role" text={block.role} />
          </div>
          <div className="cv-date">{block.dates}</div>
        </div>
      )}
      {shownCompany && (
        <div className="cv-company">
          <CompanyLine block={block} />
        </div>
      )}
      {block.firstBullet !== null && (
        <ul className="cv-bullets">
          <li>
            <CvText block={block} slot="bullet" text={block.firstBullet} />
          </li>
        </ul>
      )}
    </div>
  )
}

const EducationEntry: BlockContentView<'educationEntry'> = ({ block }) => {
  const shownLevel = useShown(block, 'level', block.level)
  const shownDetails = useShown(block, 'field', block.details)
  return (
    <div className="cv-entry">
      <span className="cv-dot" aria-hidden />
      <div className="cv-role-row">
        <div>
          {shownLevel && (
            <strong className="cv-education-level">
              <CvText block={block} slot="level" text={block.level} />
            </strong>
          )}
          {shownLevel && shownDetails && ', '}
          <EducationDetails block={block} />
        </div>
        <div className="cv-date">{block.dates}</div>
      </div>
    </div>
  )
}

const ListRow: BlockContentView<'listRow'> = ({ block }) => (
  <ul className="cv-list-row">
    {block.items.map((item) => (
      <li key={item.id}>
        <CvText block={block} slot="item" part={item.id} text={item.text} />
      </li>
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
