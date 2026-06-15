import { total } from './lib/waitingList'
import { useWaitingList } from './state/useWaitingList'

function App() {
  const wl = useWaitingList()
  const { counters, lastTaken } = wl.state

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Elective — Cohort Waiting List
      </h1>
      <p className="mt-2 text-gray-600">
        State wiring (Phase 5) — reducer + ledger buffer. Forms and views arrive
        in later phases.
      </p>

      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 font-mono text-sm">
        <dt className="text-gray-500">capacity</dt>
        <dd>{counters.capacity}</dd>
        <dt className="text-gray-500">head</dt>
        <dd>{counters.head}</dd>
        <dt className="text-gray-500">next</dt>
        <dd>{counters.next}</dd>
        <dt className="text-gray-500">total waiting</dt>
        <dd>{total(counters)}</dd>
        <dt className="text-gray-500">ledger size</dt>
        <dd>{wl.ledger.length}</dd>
        <dt className="text-gray-500">last taken</dt>
        <dd>{lastTaken ? `[${lastTaken.from}, ${lastTaken.to})` : '—'}</dd>
      </dl>

      {/* Temporary debug controls to prove the wiring; real forms land in Phase 6. */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => wl.addCreators([{ name: `Creator ${wl.ledger.length}`, area: 'Design' }])}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
        >
          add 1
        </button>
        <button
          type="button"
          onClick={() =>
            wl.addCreators(
              Array.from({ length: 10 }, (_, i) => ({
                name: `Creator ${wl.ledger.length + i}`,
                area: 'Development' as const,
              })),
            )
          }
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
        >
          add 10
        </button>
        <button
          type="button"
          onClick={() => wl.takeCreators(1)}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white"
        >
          take 1
        </button>
        <button
          type="button"
          onClick={() => wl.reset(10)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
        >
          reset
        </button>
      </div>
    </main>
  )
}

export default App
