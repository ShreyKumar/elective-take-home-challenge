import { cohortCount, total } from './lib/waitingList'
import { useWaitingList } from './state/useWaitingList'
import { CreateForm } from './components/CreateForm'
import { Summary } from './components/Summary'
import { AddForm } from './components/AddForm'
import { TakeForm } from './components/TakeForm'

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

      <CreateForm capacity={counters.capacity} onCreate={wl.reset} />
      <Summary total={totalWaiting} cohortCount={cohorts} />
      <AddForm onAdd={wl.addCreators} />
      <TakeForm disabled={totalWaiting === 0} onTake={wl.takeCreators} />
    </main>
  )
}

export default App
