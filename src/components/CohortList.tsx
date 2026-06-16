// The [6, 10]-style cohort visualization: newest cohort on the left, oldest on
// the right (marked "next to be served"). Cohorts render as rows, but the list
// is WINDOWED — at most PAGE_SIZE rows are in the DOM at once, with Prev/Next
// paging — so a list with thousands of cohorts stays at constant DOM (the
// rendering-performance property asserted in Phase 8). Cohorts are derived from
// the counters by the core module; this component only arranges what the lib
// reports and reads the ledger by seq range to list a cohort's creators when
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

/** Cohort rows rendered per page — caps the DOM regardless of cohort count. */
const PAGE_SIZE = 12

const panelId = (cohort: number) => `cohort-${cohort}-creators`

export function CohortList({ counters, ledger }: CohortListProps) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const newest = newestCohort(counters)
  const oldest = oldestCohort(counters)

  if (newest === undefined || oldest === undefined) {
    // Empty: drop any stale window/expansion so a later re-add starts fresh.
    if (expanded !== null) setExpanded(null)
    if (page !== 0) setPage(0)
    return (
      <section aria-label="Cohorts" data-cy="cohort-list">
        <p data-cy="cohort-empty" className="text-sm text-gray-500">
          No cohorts yet — add creators to open the first one.
        </p>
      </section>
    )
  }

  const total = cohortCount(counters)
  const pageCount = Math.ceil(total / PAGE_SIZE)
  // Clamp the page if cohorts were served away since the last render.
  const current = Math.min(page, pageCount - 1)
  if (current !== page) setPage(current)

  // Cohorts are numbered newest..oldest; render only the current page of them.
  const start = current * PAGE_SIZE
  const windowSize = Math.min(PAGE_SIZE, total - start)
  const windowCohorts = Array.from({ length: windowSize }, (_, i) => newest - start - i)

  // Only the cohort that's both expanded AND on the current page shows a panel;
  // a stale expansion (served away or paged off-screen) is dropped.
  const openCohort = expanded !== null && windowCohorts.includes(expanded) ? expanded : null
  if (expanded !== null && openCohort === null) setExpanded(null)

  const toggle = (cohort: number) =>
    setExpanded((curr) => (curr === cohort ? null : cohort))

  return (
    <section aria-label="Cohorts" data-cy="cohort-list" className="space-y-3">
      {/* newest on the left, oldest on the right */}
      <div className="flex flex-wrap items-start gap-2">
        {windowCohorts.map((cohort) => (
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

      {pageCount > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            data-cy="cohort-page-prev"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={current === 0}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
          >
            ← newer
          </button>
          <span data-cy="cohort-page-info" className="text-gray-500">
            cohorts {start + 1}–{start + windowSize} of {total}
          </span>
          <button
            type="button"
            data-cy="cohort-page-next"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={current >= pageCount - 1}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
          >
            older →
          </button>
        </div>
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
