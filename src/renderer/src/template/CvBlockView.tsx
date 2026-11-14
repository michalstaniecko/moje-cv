import type { ComponentType, Ref } from 'react'
import type { CvBlock } from '../domain/blocks'
import { CompanyLine, CvText, DateRange, EducationLine, useShown } from './editable'
import type { BlockViewOverrides } from './templateDefinition'

// Wspólne komponenty bloków – szablon może nadpisać dowolny rodzaj bloku (BlockViewOverrides). Tekst pól przez sloty
// edycji (editable.tsx).
function BlockContent({ block }: { block: CvBlock }) {
  switch (block.kind) {
    case 'header':
      return <Header block={block} />
    case 'sectionTitle':
      return (
        <h2 className="cv-section-title">
          <CvText block={block} slot="title" text={block.title} />
        </h2>
      )
    case 'listRow':
      return <ListRow block={block} />
  }
  return <EntryContent block={block} />
}

function Header({ block }: { block: Extract<CvBlock, { kind: 'header' }> }) {
  const shownName = useShown(block, 'fullName', block.fullName)
  const shownSummary = useShown(block, 'summary', block.summary)
  return (
    <header className={block.photoUrl ? 'cv-header cv-header--photo' : 'cv-header'}>
      {block.photoUrl && <img className="cv-photo" src={block.photoUrl} alt="" />}
      <div>
        {shownName && (
          <h1 className="cv-name">
            <CvText block={block} slot="fullName" text={block.fullName} />
          </h1>
        )}
        {block.contacts.length > 0 && (
          <div className="cv-contact">
            {block.contacts.map((contact) => (
              <p key={contact.id}>{contact.label.trim() ? `${contact.label}: ${contact.value}` : contact.value}</p>
            ))}
          </div>
        )}
        {shownSummary && (
          <p className="cv-summary">
            <CvText block={block} slot="summary" text={block.summary} />
          </p>
        )}
      </div>
    </header>
  )
}

// Tytuł obok listy (`listSectionLayout.title: 'beside'`) w pierwszym wierszu; w pozostałych wierszach puste miejsce.
function ListRow({ block }: { block: Extract<CvBlock, { kind: 'listRow' }> }) {
  const shownTitle = useShown(block, 'title', block.title)
  return (
    <div className="cv-two-col">
      {shownTitle ? (
        <h2 className="cv-section-title">
          <CvText block={block} slot="title" text={block.title} />
        </h2>
      ) : (
        <div />
      )}
      <ul className="cv-plain-list">
        {block.items.map((item) => (
          <li key={item.id}>
            <CvText block={block} slot="item" part={item.id} text={item.text} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function EntryContent({ block }: { block: Exclude<CvBlock, { kind: 'header' | 'sectionTitle' | 'listRow' }> }) {
  switch (block.kind) {
    case 'experienceEntry':
      return <ExperienceEntry block={block} />
    case 'experienceBullet':
      return (
        <div className="cv-entry">
          <div />
          <ul className="cv-bullets">
            <li>
              <CvText block={block} slot="bullet" text={block.text} />
            </li>
          </ul>
        </div>
      )
    case 'educationEntry':
      return (
        <div className="cv-entry">
          <div className="cv-date cv-date--dot">
            <DateRange block={block} />
          </div>
          <div>
            <EducationLine block={block} />
          </div>
        </div>
      )
  }
}

function ExperienceEntry({ block }: { block: Extract<CvBlock, { kind: 'experienceEntry' }> }) {
  const shownRole = useShown(block, 'role', block.role)
  const shownCompany = useShown(block, 'company', block.companyLine)
  return (
    <div className="cv-entry">
      <div className="cv-date cv-date--dot">
        <DateRange block={block} />
      </div>
      <div>
        {shownRole && (
          <div className="cv-role">
            <CvText block={block} slot="role" text={block.role} />
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
    </div>
  )
}

export function CvBlockView({
  block,
  views = {},
  ref,
  oversized = false
}: {
  block: CvBlock
  views?: BlockViewOverrides
  ref?: Ref<HTMLDivElement>
  oversized?: boolean
}) {
  // Nadpisanie jest typowane per rodzaj bloku, a tu wybierane po block.kind.
  const Content = (views[block.kind] as ComponentType<{ block: CvBlock }> | undefined) ?? BlockContent
  // Rodzaj bloku i jego położenie w sekcji – dla arkusza szablonu (np. oś czasu rysowana na całej wysokości bloku).
  return (
    <div
      ref={ref}
      className={oversized ? 'cv-block cv-block--oversized' : 'cv-block'}
      data-block={block.kind}
      data-block-id={block.id}
      data-section-position={'sectionPosition' in block ? block.sectionPosition : undefined}
      style={{ paddingBottom: `${block.spaceAfterMm}mm` }}
    >
      <Content block={block} />
    </div>
  )
}
