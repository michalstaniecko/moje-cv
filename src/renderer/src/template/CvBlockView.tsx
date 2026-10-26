import type { ComponentType, Ref } from 'react'
import type { CvBlock } from '../domain/blocks'
import type { BlockViewOverrides } from './templateDefinition'

// Wspólne komponenty bloków – szablon może nadpisać dowolny rodzaj bloku (BlockViewOverrides).
function BlockContent({ block }: { block: CvBlock }) {
  switch (block.kind) {
    case 'header':
      return (
        <header className={block.photoUrl ? 'cv-header cv-header--photo' : 'cv-header'}>
          {block.photoUrl && <img className="cv-photo" src={block.photoUrl} alt="" />}
          <div>
            {block.fullName.trim() && <h1 className="cv-name">{block.fullName}</h1>}
            {block.contacts.length > 0 && (
              <div className="cv-contact">
                {block.contacts.map((contact) => (
                  <p key={contact.id}>{contact.label.trim() ? `${contact.label}: ${contact.value}` : contact.value}</p>
                ))}
              </div>
            )}
            {block.summary.trim() && <p className="cv-summary">{block.summary}</p>}
          </div>
        </header>
      )
    case 'sectionTitle':
      return <h2 className="cv-section-title">{block.title}</h2>
    case 'experienceEntry':
      return (
        <div className="cv-entry">
          <div className="cv-date cv-date--dot">{block.dates}</div>
          <div>
            {block.role.trim() && <div className="cv-role">{block.role}</div>}
            {block.companyLine && <div className="cv-company">{block.companyLine}</div>}
            {block.firstBullet !== null && (
              <ul className="cv-bullets">
                <li>{block.firstBullet}</li>
              </ul>
            )}
          </div>
        </div>
      )
    case 'experienceBullet':
      return (
        <div className="cv-entry">
          <div />
          <ul className="cv-bullets">
            <li>{block.text}</li>
          </ul>
        </div>
      )
    case 'educationEntry':
      return (
        <div className="cv-entry">
          <div className="cv-date cv-date--dot">{block.dates}</div>
          <div>{block.text}</div>
        </div>
      )
    case 'listFirst':
      return (
        <div className="cv-two-col">
          {block.title.trim() ? <h2 className="cv-section-title">{block.title}</h2> : <div />}
          <ul className="cv-plain-list">
            <li>{block.text}</li>
          </ul>
        </div>
      )
    case 'listItem':
      return (
        <div className="cv-two-col">
          <div />
          <ul className="cv-plain-list">
            <li>{block.text}</li>
          </ul>
        </div>
      )
  }
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
  return (
    <div
      ref={ref}
      className={oversized ? 'cv-block cv-block--oversized' : 'cv-block'}
      style={{ paddingBottom: `${block.spaceAfterMm}mm` }}
    >
      <Content block={block} />
    </div>
  )
}
