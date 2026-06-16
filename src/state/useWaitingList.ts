// Wires the pure reducer to React, holds the ledger in a stable buffer (a ref)
// right next to it, and mirrors every change to IndexedDB (write-behind) so the
// list survives a reload. On mount it hydrates from IndexedDB; if IndexedDB is
// unavailable or hydration fails, it runs in memory and reports that via
// `status`. The reducer stays the source of truth — persistence is a side effect.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { add, create, take, type Creator, type CreatorInput } from '../lib/waitingList'
import {
  DEFAULT_CAPACITY,
  initWaitingList,
  waitingListReducer,
  type WaitingListState,
} from './waitingListReducer'
import {
  hydrate,
  isPersistenceAvailable,
  persistAdd,
  persistReset,
  persistTake,
} from '../persistence/waitingListDB'

/** Durability state: still loading, mirroring to IndexedDB, or memory-only. */
export type PersistenceStatus = 'loading' | 'persisted' | 'memory'

export interface WaitingList {
  state: WaitingListState
  /** The append-only ledger; index === seq. Mutated in place — read its
   *  `.length` or seq-range slices, never use its identity as a dependency. */
  ledger: readonly Creator[]
  status: PersistenceStatus
  reset: (capacity: number) => void
  addCreators: (inputs: readonly CreatorInput[]) => void
  takeCreators: (count: number) => void
}

export function useWaitingList(capacity: number = DEFAULT_CAPACITY): WaitingList {
  const [state, dispatch] = useReducer(waitingListReducer, capacity, initWaitingList)
  const ledgerRef = useRef<Creator[]>([])
  const [status, setStatus] = useState<PersistenceStatus>('loading')
  // Write-behind is enabled only after a successful hydrate; false in memory mode.
  const canPersist = useRef(false)

  // Hydrate once on mount: load persisted state, else fall back to memory.
  useEffect(() => {
    let cancelled = false
    if (!isPersistenceAvailable()) {
      setStatus('memory')
      return
    }
    hydrate()
      .then((persisted) => {
        if (cancelled) return
        if (persisted) {
          // Rebuild the ledger so index === seq, with [head, next) populated.
          const ledger: Creator[] = []
          ledger.length = persisted.counters.next
          for (const record of persisted.records) ledger[record.seq] = record
          ledgerRef.current = ledger
          dispatch({ type: 'hydrate', counters: persisted.counters })
        }
        canPersist.current = true
        setStatus('persisted')
      })
      .catch(() => {
        if (!cancelled) setStatus('memory') // a DB error → run in memory, don't crash
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reset = useCallback((nextCapacity: number) => {
    ledgerRef.current = []
    const counters = create(nextCapacity)
    dispatch({ type: 'reset', capacity: nextCapacity })
    if (canPersist.current) void persistReset(counters).catch(() => {})
  }, [])

  const addCreators = useCallback(
    (inputs: readonly CreatorInput[]) => {
      // `next` comes from the live ledger length (next === ledger.length), robust
      // across rapid dispatches where reducer state would be a stale closure.
      const { records, counters } = add(
        { capacity: state.counters.capacity, head: state.counters.head, next: ledgerRef.current.length },
        inputs,
      )
      for (const record of records) ledgerRef.current.push(record)
      dispatch({ type: 'add', count: records.length })
      if (canPersist.current && records.length > 0) void persistAdd(records, counters).catch(() => {})
    },
    [state.counters.capacity, state.counters.head],
  )

  const takeCreators = useCallback(
    (count: number) => {
      // Records aren't touched — head moves and they fall onto the served side.
      const { counters } = take(state.counters, count)
      dispatch({ type: 'take', count })
      if (canPersist.current) void persistTake(counters).catch(() => {})
    },
    [state.counters],
  )

  return { state, ledger: ledgerRef.current, status, reset, addCreators, takeCreators }
}
