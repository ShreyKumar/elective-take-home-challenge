// The [6, 10]-style cohort visualization: newest cohort on the left, oldest on
// the right (marked "next to be served"). All cohorts are shown as regular rows.
// Cohorts are derived from the counters by the core module — this component only
// arranges what the lib reports, and reads the ledger by seq range to list a
// cohort's creators when it's expanded.

import { useState } from 'react'
import {
  cohortCount,
  cohortRange,
  newestCohort,
  oldestCohort,
  type Counters,
  type Creator,
} from '../lib/waitingList'
import { CohortRow } from './CohortRow'

interface CohortListProps {
  counters: Counters
  /** The append-only ledger; index === seq. Read by seq range on expansion. */
  ledger: readonly Creator[]
}

const panelId = (cohort: number) => `cohort-${cohort}-creators`

export function CohortList({ counters, ledger }: CohortListProps) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const newest = newestCohort(counters)
  const oldest = oldestCohort(counters)

  // Drop stale expansion if the cohort no longer exists (served away or reset).
  const openCohort =
    expanded !== null && newest !== undefined && oldest !== undefined &&
    expanded >= oldest && expanded <= newest
      ? expanded
      : null
  if (expanded !== null && openCohort === null) setExpanded(null)

  if (newest === undefined || oldest === undefined) {
    return (
      <section aria-label="Cohorts" data-cy="cohort-list">
        <p data-cy="cohort-empty" className="text-sm text-gray-500">
          No cohorts yet — add creators to open the first one.
        </p>
      </section>
    )
  }

  const count = cohortCount(counters)
  const cohorts = Array.from({ length: count }, (_, i) => newest - i)
  const toggle = (cohort: number) =>
    setExpanded((current) => (current === cohort ? null : cohort))

  return (
    <section aria-label="Cohorts" data-cy="cohort-list" className="space-y-3">
      {/* newest on the left, oldest on the right */}
      <div className="flex flex-wrap items-start gap-2">
        {cohorts.map((cohort) => (
          <CohortRow
            key={cohort}
            counters={counters}
            cohort={cohort}
            nextToServe={cohort === oldest}
            expanded={openCohort === cohort}
            panelId={panelId(cohort)}
            onToggle={() => toggle(cohort)}
          />
        ))}
      </div>

      {openCohort !== null && (
        <ExpandedCohort
          counters={counters}
          ledger={ledger}
          cohort={openCohort}
          id={panelId(openCohort)}
        />
      )}
    </section>
  )
}

function ExpandedCohort({
  counters,
  ledger,
  cohort,
  id,
}: {
  counters: Counters
  ledger: readonly Creator[]
  cohort: number
  id: string
}) {
  const { from, to } = cohortRange(counters, cohort)
  const creators = ledger.slice(from, to)

  return (
    <ul
      id={id}
      data-cy="cohort-creators"
      className="space-y-1 rounded border border-gray-200 bg-gray-50 p-3"
    >
      {creators.map((creator) => (
        <li key={creator.seq} data-cy="cohort-creator" className="text-sm text-gray-700">
          <span className="font-mono text-xs text-gray-400">#{creator.seq}</span> {creator.name} —{' '}
          {creator.area}
        </li>
      ))}
    </ul>
  )
}
