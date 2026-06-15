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
      lastTaken: { from: 0, to: 3 },
    }
    expect(waitingListReducer(dirty, { type: 'reset', capacity: 5 })).toEqual({
      counters: { capacity: 5, head: 0, next: 0 },
      lastTaken: null,
    })
  })

  it('add advances next by the batch size, leaving head and lastTaken alone', () => {
    const s0 = initWaitingList(10)
    const s1 = waitingListReducer(s0, { type: 'add', count: 3 })
    expect(s1.counters).toEqual({ capacity: 10, head: 0, next: 3 })
    expect(s1.lastTaken).toBeNull()

    const s2 = waitingListReducer(s1, { type: 'add', count: 2 })
    expect(s2.counters.next).toBe(5)
    expect(s2.counters.head).toBe(0)
  })

  it('add preserves the previous take highlight', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 10 })
    s = waitingListReducer(s, { type: 'take', count: 4 }) // lastTaken -> {0,4}
    expect(s.lastTaken).toEqual({ from: 0, to: 4 })
    s = waitingListReducer(s, { type: 'add', count: 3 }) // an add must not clear it
    expect(s.lastTaken).toEqual({ from: 0, to: 4 })
    expect(s.counters.next).toBe(13)
  })

  it('take moves head and records the taken range', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 10 })
    s = waitingListReducer(s, { type: 'take', count: 4 })
    expect(s.counters.head).toBe(4)
    expect(s.lastTaken).toEqual({ from: 0, to: 4 })
  })

  it('take clamps to the total and highlights the clamped range', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 5 })
    s = waitingListReducer(s, { type: 'take', count: 100 })
    expect(s.counters.head).toBe(5)
    expect(s.lastTaken).toEqual({ from: 0, to: 5 })
  })

  it('a no-op take leaves lastTaken on the previous take', () => {
    let s = waitingListReducer(initWaitingList(10), { type: 'add', count: 5 })
    s = waitingListReducer(s, { type: 'take', count: 3 })
    expect(s.lastTaken).toEqual({ from: 0, to: 3 })

    const afterZero = waitingListReducer(s, { type: 'take', count: 0 })
    expect(afterZero.lastTaken).toEqual({ from: 0, to: 3 })

    const drained = waitingListReducer(s, { type: 'take', count: 2 })
    expect(drained.lastTaken).toEqual({ from: 3, to: 5 })
    const fromEmpty = waitingListReducer(drained, { type: 'take', count: 5 })
    expect(fromEmpty.counters.head).toBe(5)
    expect(fromEmpty.lastTaken).toEqual({ from: 3, to: 5 })
  })
})
