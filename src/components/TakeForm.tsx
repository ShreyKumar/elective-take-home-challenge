// Take up to N creators, oldest first. Takes directly on submit (one step, no
// confirmation modal); disabled when the list is empty. A count larger than the
// total is allowed — the core clamps it to what's waiting.

import { useState, type FormEvent } from 'react'
import { parseCount } from './validation'

interface TakeFormProps {
  /** True when nothing is waiting — the take controls are disabled. */
  disabled: boolean
  onTake: (count: number) => void
}

export function TakeForm({ disabled, onTake }: TakeFormProps) {
  const [raw, setRaw] = useState('1')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseCount(raw)
    if (parsed === null) {
      setError('Enter a positive whole number to take.')
      return
    }
    setError(null)
    onTake(parsed)
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Take creators" className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Take (oldest first)
          <input
            data-cy="take-input"
            type="text"
            inputMode="numeric"
            value={raw}
            disabled={disabled}
            onChange={(event) => {
              setRaw(event.target.value)
              if (error) setError(null) // drop the stale rejection once they start fixing it
            }}
            className="w-28 rounded border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
          />
        </label>
        <button
          type="submit"
          data-cy="take-btn"
          disabled={disabled}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Take
        </button>
      </div>
      {error && (
        <p data-cy="take-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
