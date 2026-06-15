// The single source of truth for React: a pure reducer over the small scalars.
// State is just `counters` (capacity, head, next) plus the last-taken range for
// UI highlighting — no cohorts, no ledger (the ledger lives in a stable buffer
// next to the reducer; see useWaitingList). Cohort math stays in src/lib.

import { create, take, type Counters, type Creator, type Range } from '../lib/waitingList'

export const DEFAULT_CAPACITY = 10

export interface WaitingListState {
  counters: Counters
  /** Seq range of the most recent non-empty take, for highlighting newly
   *  admitted creators. Null until the first take; cleared on reset. */
  lastTaken: Range | null
}

export type Action =
  | { type: 'reset'; capacity: number }
  | { type: 'add'; records: Creator[] }
  | { type: 'take'; count: number }

export function initWaitingList(capacity: number = DEFAULT_CAPACITY): WaitingListState {
  return { counters: create(capacity), lastTaken: null }
}

export function waitingListReducer(
  state: WaitingListState,
  action: Action,
): WaitingListState {
  switch (action.type) {
    case 'reset':
      return initWaitingList(action.capacity)

    case 'add':
      // The records are appended to the ledger buffer by the caller; here we
      // only advance `next` by the batch size (scalars only).
      return {
        ...state,
        counters: { ...state.counters, next: state.counters.next + action.records.length },
      }

    case 'take': {
      const { counters, taken } = take(state.counters, action.count)
      // A no-op take (count 0, or taking from an empty list) admits nobody, so
      // the highlight stays on the previous take.
      const tookSomething = taken.to > taken.from
      return { counters, lastTaken: tookSomething ? taken : state.lastTaken }
    }
  }
}
