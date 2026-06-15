// Read-only headline numbers: total creators waiting and how many cohorts they
// span. Both are O(1) reads derived in App from the counters; this component is
// pure presentation. The full [6, 10]-style cohort visualization arrives in
// Phase 7 (CohortList).

interface SummaryProps {
  total: number
  cohortCount: number
}

export function Summary({ total, cohortCount }: SummaryProps) {
  return (
    <section
      aria-label="Summary"
      className="flex gap-8 rounded border border-gray-200 bg-gray-50 px-4 py-3"
    >
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Total waiting</div>
        <div data-cy="total" className="text-2xl font-bold text-gray-900">
          {total}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Cohorts</div>
        <div data-cy="cohort-count" className="text-2xl font-bold text-gray-900">
          {cohortCount}
        </div>
      </div>
    </section>
  )
}
