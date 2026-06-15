import { useState, type FormEvent } from 'react'
import { AREAS, type Area, type CreatorInput } from '../lib/waitingList'
import { parseName } from './validation'

interface AddFormProps {
  onAdd: (inputs: readonly CreatorInput[]) => void
}

export function AddForm({ onAdd }: AddFormProps) {
  const [name, setName] = useState('')
  const [area, setArea] = useState<Area>(AREAS[0])
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseName(name)
    if (parsed === null) {
      setError('Name cannot be empty.')
      return
    }
    setError(null)
    onAdd([{ name: parsed, area }])
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Add creators" className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Name
          <input
            data-cy="name-input"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError(null)
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
          data-cy="add-btn"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add creator
        </button>
      </div>

      {error && (
        <p data-cy="name-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
