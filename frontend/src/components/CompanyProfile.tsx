import { useState } from 'react'
import type { Summary } from '../types'
import { formatNumber } from '../lib/format'

interface Props {
  summary: Summary
}

export function CompanyProfile({ summary }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { sector, industry, employees, website, description } = summary

  if (!description && !sector) return null

  return (
    <section className="card">
      <h2>About {summary.name}</h2>
      <div className="profile-tags">
        {sector && <span className="tag">{sector}</span>}
        {industry && <span className="tag">{industry}</span>}
        {employees && <span className="tag">{formatNumber(employees, 0)} employees</span>}
        {website && (
          <a className="tag link" href={website} target="_blank" rel="noreferrer">
            {website.replace(/^https?:\/\/(www\.)?/, '')} ↗
          </a>
        )}
      </div>
      {description && (
        <>
          <p className={`profile-text ${expanded ? '' : 'clamped'}`}>{description}</p>
          <button className="link-btn" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show less' : 'Read more'}
          </button>
        </>
      )}
    </section>
  )
}
