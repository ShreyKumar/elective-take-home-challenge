// The single source of truth for React: a pure reducer over the small scalars.
// State is just `counters` (capacity, head, next) — no cohorts, no ledger (the
// ledger lives in a stable buffer next to the reducer; see useWaitingList).
// Cohort math stays in src/lib.

import { create, take, type Counters } from '../lib/waitingList'

export const DEFAULT_CAPACITY = 10

export interface WaitingListState {
  counters: Counters
}

export type Action =
  | { type: 'reset'; capacity: number }
  | { type: 'add'; count: number }
  | { type: 'take'; count: number }

export function initWaitingList(capacity: number = DEFAULT_CAPACITY): WaitingListState {
  return { counters: create(capacity) }
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
        counters: { ...state.counters, next: state.counters.next + action.count },
      }

    case 'take': {
      const { counters } = take(state.counters, action.count)
      return { counters }
    }
  }
}
