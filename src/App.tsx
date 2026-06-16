import { cohortCount, total } from './lib/waitingList'
import { useWaitingList } from './state/useWaitingList'
import { CreateForm } from './components/CreateForm'
import { Summary } from './components/Summary'
import { AddForm } from './components/AddForm'
import { TakeForm } from './components/TakeForm'
import { CohortList } from './components/CohortList'

function App() {
  const wl = useWaitingList()
  const { counters } = wl.state
  const totalWaiting = total(counters)
  const cohorts = cohortCount(counters)

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Elective — Cohort Waiting List
        </h1>
        <p className="text-gray-600">
          Add course creators to the waiting list and pull cohorts out for
          onboarding, oldest first.
        </p>
      </header>

      {wl.status === 'loading' ? (
        <p data-cy="loading" role="status" className="text-sm text-gray-500">
          Loading…
        </p>
      ) : (
        <>
          {wl.status === 'memory' && (
            <p
              data-cy="persistence-warning"
              role="status"
              className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800"
            >
              IndexedDB isn't available — your changes won't be saved across reloads.
            </p>
          )}
          <CreateForm capacity={counters.capacity} onCreate={wl.reset} />
          <Summary total={totalWaiting} cohortCount={cohorts} />
          <AddForm onAdd={wl.addCreators} />
          <TakeForm disabled={totalWaiting === 0} onTake={wl.takeCreators} />
          <CohortList counters={counters} ledger={wl.ledger} />
        </>
      )}
    </main>
  )
}

export default App
