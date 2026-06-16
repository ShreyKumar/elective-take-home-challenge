import { describe, expect, it } from 'vitest'
import {
  initWaitingList,
  waitingListReducer,
  type WaitingListState,
} from './waitingListReducer'

describe('waitingListReducer', () => {
  it('reset starts a fresh list with the given capacity, clearing everything', () => {
    const dirty: WaitingListState = {
      counters: { capacity: 4, head: 3, next: 9 },
    }
    expect(waitingListReducer(dirty, { type: 'reset', capacity: 5 })).toEqual({
      counters: { capacity: 5, head: 0, next: 0 },
    })
  })

  it('add advances next by the batch size, leaving head alone', () => {
    const s0 = initWaitingList(10)
    const s1 = waitingListReducer(s0, { type: 'add', count: 3 })
    expect(s1.counters).toEqual({ capacity: 10, head: 0, next: 3 })

    const s2 = waitingListReducer(s1, { type: 'add', count: 2 })
    expect(s2.counters.next).toBe(5)
    expect(s2.counters.head).toBe(0)
  })

  it('take moves head', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 10 })
    s = waitingListReducer(s, { type: 'take', count: 4 })
    expect(s.counters.head).toBe(4)
  })

  it('take clamps to the total', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 5 })
    s = waitingListReducer(s, { type: 'take', count: 100 })
    expect(s.counters.head).toBe(5)
  })

  it('a no-op take leaves head unchanged', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 5 })
    s = waitingListReducer(s, { type: 'take', count: 3 })
    expect(s.counters.head).toBe(3)

    const afterZero = waitingListReducer(s, { type: 'take', count: 0 })
    expect(afterZero.counters.head).toBe(3)

    // Drain to empty, then take from empty — head stays at 5
    const drained = waitingListReducer(s, { type: 'take', count: 2 })
    expect(drained.counters.head).toBe(5)
    const fromEmpty = waitingListReducer(drained, { type: 'take', count: 5 })
    expect(fromEmpty.counters.head).toBe(5)
  })

  it('hydrate replaces the counters wholesale (from persisted state)', () => {
    const loaded = { capacity: 4, head: 6, next: 14 }
    expect(
      waitingListReducer(initWaitingList(10), { type: 'hydrate', counters: loaded }),
    ).toEqual({ counters: loaded })
  })
})
