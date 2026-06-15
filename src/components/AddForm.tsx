// Add creators to the waiting list. Creators are staged into a local batch
// queue (name + area each) and then added in one action — which becomes a
// single dispatch downstream regardless of batch size. Empty / whitespace-only
// names are rejected at the queue step; a single add is just a batch of one.

import { useRef, useState, type FormEvent } from 'react'
import { AREAS, type Area, type CreatorInput } from '../lib/waitingList'
import { parseName } from './validation'

interface AddFormProps {
  onAdd: (inputs: readonly CreatorInput[]) => void
}

/** A queued creator carries a stable local id so list keys never use the array
 *  index (the id is dropped before the batch reaches the core). */
interface QueuedCreator extends CreatorInput {
  id: number
}

export function AddForm({ onAdd }: AddFormProps) {
  const [name, setName] = useState('')
  const [area, setArea] = useState<Area>(AREAS[0])
  const [queue, setQueue] = useState<QueuedCreator[]>([])
  const [error, setError] = useState<string | null>(null)
  const nextId = useRef(0)

  function handleQueue(event: FormEvent) {
    event.preventDefault()
    const parsed = parseName(name)
    if (parsed === null) {
      setError('Name cannot be empty.')
      return
    }
    setError(null)
    setQueue((current) => [...current, { id: nextId.current++, name: parsed, area }])
    setName('') // keep the area selected for fast repeated entry
  }

  function removeQueued(id: number) {
    setQueue((current) => current.filter((creator) => creator.id !== id))
  }

  function addAll() {
    if (queue.length === 0) return
    onAdd(queue.map(({ name, area }) => ({ name, area })))
    setQueue([])
  }

  return (
    <form onSubmit={handleQueue} aria-label="Add creators" className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Name
          <input
            data-cy="name-input"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError(null) // drop the stale rejection once they start fixing it
            }}
            className="w-48 rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Area
          <select
            data-cy="area-select"
            value={area}
            onChange={(event) => setArea(event.target.value as Area)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            {AREAS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          data-cy="queue-btn"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
        >
          Add to batch
        </button>
      </div>

      {error && (
        <p data-cy="name-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {queue.length > 0 && (
        <div className="space-y-2">
          <ul data-cy="queue" className="space-y-1">
            {queue.map((creator) => (
              <li
                key={creator.id}
                data-cy="queue-item"
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <span>
                  {creator.name} — {creator.area}
                </span>
                <button
                  type="button"
                  data-cy="queue-remove"
                  onClick={() => removeQueued(creator.id)}
                  aria-label={`Remove ${creator.name}`}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-cy="add-btn"
            onClick={addAll}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Add {queue.length} creator{queue.length === 1 ? '' : 's'} to list
          </button>
        </div>
      )}
    </form>
  )
}
