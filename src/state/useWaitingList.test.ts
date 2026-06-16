// @vitest-environment happy-dom
// Tests for the persistence-wiring hook — the branches Cypress can't reach:
// the hydrate-on-mount effect, the StrictMode double-invoke guard, the
// memory-mode fallback, write-behind gating, and the sparse-ledger rebuild.
// The persistence module is mocked so we drive availability/hydration and
// observe writes without touching IndexedDB.

import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../persistence/waitingListDB', () => ({
  isPersistenceAvailable: vi.fn(() => true),
  hydrate: vi.fn(async () => null),
  persistAdd: vi.fn(async () => {}),
  persistTake: vi.fn(async () => {}),
  persistReset: vi.fn(async () => {}),
}))

import { useWaitingList } from './useWaitingList'
import * as db from '../persistence/waitingListDB'
import { type Creator } from '../lib/waitingList'

const mocked = vi.mocked(db)

beforeEach(() => {
  vi.clearAllMocks()
  mocked.isPersistenceAvailable.mockReturnValue(true)
  mocked.hydrate.mockResolvedValue(null)
})

describe('useWaitingList', () => {
  // A fresh (empty) database hydrates to the persisted status with an empty list.
  it('hydrates an empty database to the persisted status', async () => {
    const { result } = renderHook(() => useWaitingList())
    await waitFor(() => expect(result.current.status).toBe('persisted'))
    expect(result.current.state.counters).toEqual({ capacity: 10, head: 0, next: 0 })
  })

  // Persisted state rebuilds a sparse ledger (index === seq, next === length),
  // and a subsequent add continues from `next` and persists the new counters.
  it('rebuilds a sparse ledger from persisted state', async () => {
    const records: Creator[] = [
      { seq: 2, name: 'C2', area: 'Design' },
      { seq: 3, name: 'C3', area: 'Design' },
      { seq: 4, name: 'C4', area: 'Design' },
    ]
    mocked.hydrate.mockResolvedValue({ counters: { capacity: 10, head: 2, next: 5 }, records })

    const { result } = renderHook(() => useWaitingList())
    await waitFor(() => expect(result.current.status).toBe('persisted'))

    expect(result.current.state.counters).toEqual({ capacity: 10, head: 2, next: 5 })
    expect(result.current.ledger.length).toBe(5) // next === ledger.length
    expect(result.current.ledger[2]).toEqual(records[0]) // [head, next) populated
    expect(result.current.ledger[4]).toEqual(records[2])
    expect(result.current.ledger[0]).toBeUndefined() // served prefix is a hole

    act(() => result.current.addCreators([{ name: 'New', area: 'Music' }]))
    expect(result.current.ledger[5]).toMatchObject({ seq: 5, name: 'New' }) // lands at next
    await waitFor(() => expect(mocked.persistAdd).toHaveBeenCalledTimes(1))
    expect(mocked.persistAdd).toHaveBeenCalledWith(expect.any(Array), {
      capacity: 10,
      head: 2,
      next: 6,
    })
  })

  // IndexedDB unavailable → memory mode: hydrate is never tried, the app still
  // works in memory, but nothing is written to the database.
  it('falls back to memory mode when IndexedDB is unavailable and never persists', async () => {
    mocked.isPersistenceAvailable.mockReturnValue(false)
    const { result } = renderHook(() => useWaitingList())
    await waitFor(() => expect(result.current.status).toBe('memory'))
    expect(mocked.hydrate).not.toHaveBeenCalled()

    act(() => result.current.addCreators([{ name: 'A', area: 'Design' }]))
    act(() => result.current.takeCreators(1))
    expect(result.current.state.counters.next).toBe(1) // memory state still updates
    expect(mocked.persistAdd).not.toHaveBeenCalled()
    expect(mocked.persistTake).not.toHaveBeenCalled()
  })

  // A hydration error degrades to memory mode rather than crashing.
  it('falls back to memory mode when hydration fails', async () => {
    mocked.hydrate.mockRejectedValue(new Error('db error'))
    const { result } = renderHook(() => useWaitingList())
    await waitFor(() => expect(result.current.status).toBe('memory'))
  })

  // After a successful hydrate, add and take write the right counters behind.
  it('writes behind after add and take', async () => {
    const { result } = renderHook(() => useWaitingList())
    await waitFor(() => expect(result.current.status).toBe('persisted'))

    act(() =>
      result.current.addCreators([
        { name: 'A', area: 'Design' },
        { name: 'B', area: 'Music' },
      ]),
    )
    await waitFor(() => expect(mocked.persistAdd).toHaveBeenCalledTimes(1))

    act(() => result.current.takeCreators(1))
    await waitFor(() => expect(mocked.persistTake).toHaveBeenCalledTimes(1))
    expect(mocked.persistTake).toHaveBeenCalledWith({ capacity: 10, head: 1, next: 2 })
  })

  // StrictMode double-invokes the mount effect; the guard must not double-apply
  // the hydration (ledger rebuilt once, not appended twice).
  it('handles a StrictMode double-mount without double-applying hydration', async () => {
    mocked.hydrate.mockResolvedValue({
      counters: { capacity: 10, head: 0, next: 1 },
      records: [{ seq: 0, name: 'C0', area: 'Design' }],
    })
    const { result } = renderHook(() => useWaitingList(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.status).toBe('persisted'))
    expect(result.current.state.counters).toEqual({ capacity: 10, head: 0, next: 1 })
    expect(result.current.ledger.length).toBe(1) // not doubled
  })
})
