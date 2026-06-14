import { describe, expect, it } from 'vitest'
import {
  AREAS,
  add,
  create,
  take,
  total,
  type CreatorInput,
} from './waitingList'

/** N distinct creator inputs cycling through the five areas. */
function inputs(n: number): CreatorInput[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Creator ${i}`,
    area: AREAS[i % AREAS.length]!,
  }))
}

describe('create', () => {
  // A freshly created list has the given capacity, head=0, next=0, and total=0.
  it('starts empty', () => {
    expect(create(10)).toEqual({ capacity: 10, head: 0, next: 0 })
    expect(total(create(10))).toBe(0)
  })

  // Capacity of 1 is the minimum valid value; it must be accepted without error.
  it('allows capacity 1', () => {
    expect(create(1)).toEqual({ capacity: 1, head: 0, next: 0 })
  })

  // Zero, negatives, fractions, NaN, and Infinity are all invalid capacities and must throw RangeError.
  it('rejects non-positive / non-integer capacity', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => create(bad)).toThrow(RangeError)
    }
  })
})

describe('add', () => {
  // Each creator in a batch gets the next available seq, and `next` advances by the batch size.
  it('assigns sequential seqs and advances next', () => {
    const { counters, records } = add(create(10), inputs(3))
    expect(records.map((r) => r.seq)).toEqual([0, 1, 2])
    expect(counters.next).toBe(3)
    expect(total(counters)).toBe(3)
  })

  // The name and area fields are copied exactly from the input onto the created record.
  it('preserves name and area on each record', () => {
    const { records } = add(create(10), [{ name: 'Ada', area: 'Development' }])
    expect(records[0]).toEqual({ seq: 0, name: 'Ada', area: 'Development' })
  })

  // Seqs from a second batch pick up immediately after the last seq of the first — no resets or gaps.
  it('continues seqs across successive batches', () => {
    const first = add(create(10), inputs(3))
    const second = add(first.counters, inputs(2))
    expect(second.records.map((r) => r.seq)).toEqual([3, 4])
    expect(second.counters.next).toBe(5)
  })

  // An empty batch returns zero records and leaves all counters unchanged.
  it('add 0 is a no-op', () => {
    const c = create(10)
    const { counters, records } = add(c, [])
    expect(records).toEqual([])
    expect(counters).toEqual(c)
  })
})

describe('take', () => {
  // Taking n creators advances head by n and returns the half-open range [from, from+n).
  it('moves head and reports the taken range', () => {
    const c = add(create(10), inputs(10)).counters
    const { counters, taken } = take(c, 4)
    expect(taken).toEqual({ from: 0, to: 4 })
    expect(counters.head).toBe(4)
    expect(total(counters)).toBe(6)
  })

  // Taking zero leaves head and next unchanged and returns an empty range [head, head).
  it('take 0 is a no-op', () => {
    const c = add(create(10), inputs(5)).counters
    const { counters, taken } = take(c, 0)
    expect(taken).toEqual({ from: 0, to: 0 })
    expect(counters).toEqual(c)
  })

  // Requesting more creators than are waiting clamps to what is available — not an error.
  it('taking more than the total takes only what is there', () => {
    const c = add(create(10), inputs(5)).counters
    const { counters, taken } = take(c, 100)
    expect(taken).toEqual({ from: 0, to: 5 })
    expect(total(counters)).toBe(0)
  })

  // Taking from a brand-new empty list (head=0, next=0) is a no-op returning { from: 0, to: 0 }.
  it('taking from an empty list is a no-op', () => {
    const c = create(10)
    const { counters, taken } = take(c, 3)
    expect(taken).toEqual({ from: 0, to: 0 })
    expect(counters).toEqual(c)
  })

  // When head has already advanced (e.g. after prior takes drain the list), the empty-range is
  // { from: head, to: head } — not { from: 0, to: 0 }.
  it('taking from an empty list after prior takes uses the current head', () => {
    const afterAdd = add(create(10), inputs(5))
    const afterTake = take(afterAdd.counters, 5) // head=5, next=5 — list is now empty
    const { counters, taken } = take(afterTake.counters, 3)
    expect(taken).toEqual({ from: 5, to: 5 })
    expect(total(counters)).toBe(0)
  })

  // Negative, fractional, NaN, and Infinity are all invalid take counts and must throw RangeError.
  it('rejects negative / non-integer counts', () => {
    const c = add(create(10), inputs(5)).counters
    for (const bad of [-1, 1.5, NaN, Infinity]) {
      expect(() => take(c, bad)).toThrow(RangeError)
    }
  })
})

describe('the spec example flow (capacity 10)', () => {
  // Walks the exact add/take sequence from the requirements spec, asserting total, head, next,
  // and the taken range at every step. Cohort-array assertions ([8,10,10,10] etc.) come in Phase 3.
  // Note: bracket notation in comments lists cohorts newest-first, e.g. [partial, ..., oldest-full].
  it('matches total/head/next at every step', () => {
    let c = create(10)
    expect(total(c)).toBe(0)

    c = add(c, inputs(3)).counters // [] + 3 -> [3]
    expect(total(c)).toBe(3)

    c = add(c, inputs(13)).counters // [3] + 13 -> [6, 10]
    expect(total(c)).toBe(16)

    c = add(c, inputs(22)).counters // [6, 10] + 22 -> [8, 10, 10, 10]
    expect(total(c)).toBe(38)
    expect(c.next).toBe(38)

    let t = take(c, 4) // [8, 10, 10, 10] take 4 -> [8, 10, 10, 6]
    expect(t.taken).toEqual({ from: 0, to: 4 })
    c = t.counters
    expect(total(c)).toBe(34)

    t = take(c, 7) // [8, 10, 10, 6] take 7 -> [8, 10, 9]
    expect(t.taken).toEqual({ from: 4, to: 11 })
    c = t.counters
    expect(total(c)).toBe(27) // spec checkpoint

    t = take(c, 20) // [8, 10, 9] take 20 -> [7]
    expect(t.taken).toEqual({ from: 11, to: 31 })
    c = t.counters
    expect(total(c)).toBe(7) // spec checkpoint
    expect(c.head).toBe(31)
    expect(c.next).toBe(38)
  })
})

describe('scale', () => {
  // Proves that add and take remain practical at 100k/99k scale: add is O(m) in batch size,
  // take is O(1) — only the head counter moves regardless of how many creators are taken.
  it('handles add 100k / take 99k on O(1) counters', () => {
    const added = add(create(10), inputs(100_000))
    expect(added.counters.next).toBe(100_000)
    expect(added.records).toHaveLength(100_000)

    const { counters, taken } = take(added.counters, 99_000)
    expect(taken).toEqual({ from: 0, to: 99_000 })
    expect(counters.head).toBe(99_000)
    expect(total(counters)).toBe(1_000)
  })
})
