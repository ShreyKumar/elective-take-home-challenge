// Create / reset the waiting list. Capacity is fixed at creation, so this same
// control doubles as the reset (requirements.md → "Capacity is fixed at
// creation — reset to change it"). Rejects anything that isn't a positive
// integer at the UI boundary; a valid submit clears the list and starts fresh.

import { useState, type FormEvent } from 'react'
import { DEFAULT_CAPACITY } from '../state/waitingListReducer'
import { parseCapacity } from './validation'

interface CreateFormProps {
  /** The live capacity, shown so the user can see what a reset would keep. */
  capacity: number
  onCreate: (capacity: number) => void
}

export function CreateForm({ capacity, onCreate }: CreateFormProps) {
  const [raw, setRaw] = useState(String(DEFAULT_CAPACITY))
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseCapacity(raw)
    if (parsed === null) {
      setError('Capacity must be a positive whole number.')
      return
    }
    setError(null)
    onCreate(parsed)
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Create or reset list" className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Cohort capacity
          <input
            data-cy="capacity-input"
            type="text"
            inputMode="numeric"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value)
              if (error) setError(null) // drop the stale rejection once they start fixing it
            }}
            className="w-28 rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          data-cy="create-btn"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Create / Reset
        </button>
        <span className="pb-1.5 text-sm text-gray-500">Current capacity: {capacity}</span>
      </div>
      {error && (
        <p data-cy="capacity-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
