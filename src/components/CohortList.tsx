// The [6, 10]-style cohort visualization: newest cohort on the left, oldest on
// the right (marked "next to be served"), and the always-full middle collapsed
// into one "capacity ×N full" chip so the rendered DOM stays bounded no matter
// how many cohorts exist (requirements.md → Components → CohortList; the
// constant-DOM property is asserted in Phase 11). Cohorts are derived from the
// counters by the core module — this component only arranges what the lib
// reports, and reads the ledger by seq range to list a cohort's creators when
// it's expanded.

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

  // Only the two end cohorts are expandable. If the open cohort is no longer an
  // end — served away, collapsed into the full middle, or cleared by a reset —
  // drop the stale expansion so it can never silently re-open when that cohort
  // number reappears as an end. (Adjusting state during render is React's escape
  // hatch for derived state; the update is conditional and converges to null.)
  const openCohort =
    expanded !== null && (expanded === newest || expanded === oldest) ? expanded : null
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

  // Every cohort strictly between the two ends is full (the always-full-middle
  // invariant) and collapses into a single chip.
  const middleCount = cohortCount(counters) - 2
  const single = newest === oldest
  const toggle = (cohort: number) =>
    setExpanded((current) => (current === cohort ? null : cohort))

  return (
    <section aria-label="Cohorts" data-cy="cohort-list" className="space-y-3">
      {/* newest on the left, oldest on the right */}
      <div className="flex flex-wrap items-start gap-2">
        <CohortRow
          counters={counters}
          cohort={newest}
          nextToServe={single}
          expanded={openCohort === newest}
          panelId={panelId(newest)}
          onToggle={() => toggle(newest)}
        />
        {middleCount > 0 && (
          <div
            data-cy="cohort-middle"
            className="flex min-w-24 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center"
          >
            <span className="text-sm font-medium text-gray-700">
              {counters.capacity} ×{middleCount} full
            </span>
            <span className="text-xs text-gray-400">collapsed</span>
          </div>
        )}
        {!single && (
          <CohortRow
            counters={counters}
            cohort={oldest}
            nextToServe
            expanded={openCohort === oldest}
            panelId={panelId(oldest)}
            onToggle={() => toggle(oldest)}
          />
        )}
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
