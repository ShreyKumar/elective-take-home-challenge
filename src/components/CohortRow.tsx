// One end-cohort in the CohortList — a toggle button showing its current
// waiting count and fill state, with the oldest cohort marked "next to be
// served". Clicking it expands the cohort to list its creators (the panel is
// owned by CohortList). Keyed by cohort number upstream; the count comes from
// the core's cohortRange, so this component does no cohort math of its own.

import { memo } from 'react'
import { cohortRange, type Counters } from '../lib/waitingList'

interface CohortRowProps {
  counters: Counters
  /** The cohort number (stable forever) this row renders. */
  cohort: number
  /** Marks this as the oldest cohort — the next one to be served. */
  nextToServe?: boolean
  expanded: boolean
  /** id of the disclosure panel this row controls, for aria-controls. */
  panelId: string
  onToggle: (cohort: number) => void
}

export const CohortRow = memo(function CohortRow({
  counters,
  cohort,
  nextToServe,
  expanded,
  panelId,
  onToggle,
}: CohortRowProps) {
  const { from, to } = cohortRange(counters, cohort)
  const count = to - from
  const full = count === counters.capacity

  return (
    <button
      type="button"
      data-cy="cohort-row"
      data-cohort={cohort}
      aria-expanded={expanded}
      aria-controls={expanded ? panelId : undefined}
      onClick={() => onToggle(cohort)}
      className={`flex min-w-24 flex-col items-center gap-0.5 rounded border px-4 py-3 text-center ${
        nextToServe ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
      }`}
    >
      <span data-cy="cohort-row-count" className="text-2xl font-bold text-gray-900">
        {count}
      </span>
      <span className="text-xs text-gray-500">
        of {counters.capacity} · {full ? 'full' : 'filling'}
      </span>
      {nextToServe && (
        <span data-cy="cohort-next" className="text-xs font-medium text-amber-700">
          next to be served
        </span>
      )}
      <span className="text-[10px] uppercase tracking-wide text-gray-400">
        {expanded ? 'hide' : 'show'} creators
      </span>
    </button>
  )
})
