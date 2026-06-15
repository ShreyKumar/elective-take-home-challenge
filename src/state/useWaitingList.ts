// Wires the pure reducer to React and holds the ledger in a stable buffer (a
// ref) right next to it. Records are append-only and never mutated, so sharing
// the buffer is safe. The hook is the only place that bridges the two: it asks
// the core module to assign seqs, appends the records to the buffer, then
// dispatches the counter change.

import { useCallback, useReducer, useRef } from 'react'
import { add, type Creator, type CreatorInput } from '../lib/waitingList'
import {
  DEFAULT_CAPACITY,
  initWaitingList,
  waitingListReducer,
  type WaitingListState,
} from './waitingListReducer'

export interface WaitingList {
  state: WaitingListState
  /** The append-only ledger; index === seq. Mutated in place, so read its
   *  `.length` or seq-range slices — do not use it as a memo/effect dependency,
   *  since its identity does not change as it grows. */
  ledger: readonly Creator[]
  reset: (capacity: number) => void
  addCreators: (inputs: readonly CreatorInput[]) => void
  takeCreators: (count: number) => void
}

export function useWaitingList(capacity: number = DEFAULT_CAPACITY): WaitingList {
  const [state, dispatch] = useReducer(waitingListReducer, capacity, initWaitingList)
  const ledgerRef = useRef<Creator[]>([])

  const reset = useCallback((nextCapacity: number) => {
    ledgerRef.current = []
    dispatch({ type: 'reset', capacity: nextCapacity })
  }, [])

  const addCreators = useCallback((inputs: readonly CreatorInput[]) => {
    // Assign seqs via the core module. `next` comes from the live ledger length
    // (the invariant next === ledger.length), which is robust across rapid
    // dispatches where reducer state would be a stale closure.
    const { records } = add(
      { ...state.counters, next: ledgerRef.current.length },
      inputs,
    )
    // Append one at a time — a spread `push(...records)` overflows the call
    // stack for very large batches.
    for (const record of records) ledgerRef.current.push(record)
    dispatch({ type: 'add', count: records.length })
  }, [state.counters])

  const takeCreators = useCallback((count: number) => {
    // Records are not touched — head moves and they fall onto the served side.
    dispatch({ type: 'take', count })
  }, [])

  return { state, ledger: ledgerRef.current, reset, addCreators, takeCreators }
}
