import { CompanyLine, CvText, EducationDetails, useShown } from '../editable'
import type { BlockContentView, PageFooterView, TemplateDefinition } from '../templateDefinition'
import './bold.css'

// „Wyrazisty” – akcent jako wypełnienie: pas nagłówka ze spadem, tytuły-pigułki, kwadratowe znaczniki (issue #39).
// Tytuł sekcji i kolejne punkty doświadczenia rysuje wspólny markup – wystarcza im arkusz.

const Header: BlockContentView<'header'> = ({ block }) => {
  const shownName = useShown(block, 'fullName', block.fullName)
  const shownSummary = useShown(block, 'summary', block.summary)
  const hasBand = shownName || block.contacts.length > 0 || block.photoUrl
  return (
    <header className={block.photoUrl ? 'cv-header cv-header--photo' : 'cv-header'}>
      {hasBand && (
        <div className="cv-band">
          <div className="cv-band-main">
            {shownName && (
              <h1 className="cv-name">
                <CvText block={block} slot="fullName" text={block.fullName} />
              </h1>
            )}
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
      {shownSummary && (
        <p className="cv-summary">
          <CvText block={block} slot="summary" text={block.summary} />
        </p>
      )}
    </header>
  )
}

// Daty na jasnym odcieniu akcentu – tylko gdy niepuste, żeby nie zostawało puste tło.
const ExperienceEntry: BlockContentView<'experienceEntry'> = ({ block }) => {
  const shownRole = useShown(block, 'role', block.role)
  const shownCompany = useShown(block, 'company', block.companyLine)
  return (
    <div className="cv-entry">
      {(shownRole || block.dates) && (
        <div className="cv-role-row">
          <div className="cv-role">
            <CvText block={block} slot="role" text={block.role} />
          </div>
          {block.dates && <div className="cv-date">{block.dates}</div>}
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
        {block.dates && <div className="cv-date">{block.dates}</div>}
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
