import { describe, expect, it } from 'vitest'
import {
  AREAS,
  add,
  cohortCounts,
  cohortOf,
  cohortRange,
  create,
  newestCohort,
  oldestCohort,
  onboardingRange,
  previewRange,
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
    expect(cohortCounts(create(10))).toEqual([]) // freshly created list has no cohorts
  })

  // Capacity of 1 is the minimum valid value; it must be accepted without error.
  it('allows capacity 1', () => {
    expect(create(1)).toEqual({ capacity: 1, head: 0, next: 0 })
    expect(cohortCounts(create(1))).toEqual([]) // freshly created capacity-1 list has no cohorts
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
    expect(cohortCounts(counters)).toEqual([3]) // one partial cohort with 3 of 10 filled
  })

  // Seqs from a second batch pick up immediately after the last seq of the first — no resets or gaps.
  it('continues seqs across successive batches', () => {
    const first = add(create(10), inputs(3))
    const second = add(first.counters, inputs(2))
    expect(second.records.map((r) => r.seq)).toEqual([3, 4])
    expect(second.counters.next).toBe(5)
    expect(cohortCounts(second.counters)).toEqual([5]) // still one partial cohort with 5 of 10 filled
  })
})

describe('take', () => {
  // Taking n creators advances head by n and returns the half-open range [from, from+n).
  it('moves head and reports the taken range', () => {
    const c = add(create(10), inputs(10)).counters
    expect(cohortCounts(c)).toEqual([10]) // one full cohort before taking
    const { counters, taken } = take(c, 4)
    expect(taken).toEqual({ from: 0, to: 4 })
    expect(counters.head).toBe(4)
    expect(total(counters)).toBe(6)
    expect(cohortCounts(counters)).toEqual([6]) // same cohort, now 6 remaining
  })

  // Requesting more creators than are waiting clamps to what is available — not an error.
  it('taking more than the total takes only what is there', () => {
    const c = add(create(10), inputs(5)).counters
    const { counters, taken } = take(c, 100)
    expect(taken).toEqual({ from: 0, to: 5 })
    expect(total(counters)).toBe(0)
    expect(cohortCounts(counters)).toEqual([]) // list is empty; no cohorts remain
  })

  // When head has already advanced (e.g. after prior takes drain the list), the empty-range is
  // { from: head, to: head } — not { from: 0, to: 0 }.
  it('taking from an empty list after prior takes uses the current head', () => {
    const afterAdd = add(create(10), inputs(5))
    const afterTake = take(afterAdd.counters, 5) // head=5, next=5 — list is now empty
    const { counters, taken } = take(afterTake.counters, 3)
    expect(taken).toEqual({ from: 5, to: 5 })
    expect(total(counters)).toBe(0)
    expect(cohortCounts(counters)).toEqual([]) // empty list has no cohorts, regardless of head position
  })
})

describe('the spec example flow (capacity 10)', () => {
  // Walks the exact add/take sequence from the requirements spec, asserting cohort-level
  // totals (newest-first), head, next, and the taken range at every step.
  // Bracket notation lists cohorts newest-first: [partial-newest, ..., oldest-full].
  it('matches cohort totals/head/next at every step', () => {
    let c = create(10)
    expect(cohortCounts(c)).toEqual([]) // empty list has no cohorts

    c = add(c, inputs(3)).counters // [] + 3 -> [3]
    expect(cohortCounts(c)).toEqual([3]) // one partial cohort, 3 waiting

    c = add(c, inputs(13)).counters // [3] + 13 -> [6, 10]
    expect(cohortCounts(c)).toEqual([6, 10]) // newest cohort has 6, oldest is full

    c = add(c, inputs(22)).counters // [6, 10] + 22 -> [8, 10, 10, 10]
    expect(cohortCounts(c)).toEqual([8, 10, 10, 10])
    expect(c.next).toBe(38)

    let t = take(c, 4) // [8, 10, 10, 10] take 4 -> [8, 10, 10, 6]
    expect(t.taken).toEqual({ from: 0, to: 4 })
    c = t.counters
    expect(cohortCounts(c)).toEqual([8, 10, 10, 6]) // oldest cohort now has 6 remaining

    t = take(c, 7) // [8, 10, 10, 6] take 7 -> [8, 10, 9]
    expect(t.taken).toEqual({ from: 4, to: 11 })
    c = t.counters
    expect(cohortCounts(c)).toEqual([8, 10, 9]) // oldest cohort fully consumed; next oldest has 9
    expect(total(c)).toBe(27) // spec checkpoint: total still derivable from sum of cohorts

    t = take(c, 20) // [8, 10, 9] take 20 -> [7]
    expect(t.taken).toEqual({ from: 11, to: 31 })
    c = t.counters
    expect(cohortCounts(c)).toEqual([7]) // spec checkpoint
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

  // Interleaved large adds and takes: total must equal next - head at every checkpoint.
  it('interleaved large adds and takes keep total consistent', () => {
    let c = create(50)
    c = add(c, inputs(50_000)).counters  // total = 50k
    c = take(c, 30_000).counters         // total = 20k
    c = add(c, inputs(40_000)).counters  // total = 60k
    c = take(c, 20_000).counters         // total = 40k

    expect(total(c)).toBe(40_000)
    expect(c.next - c.head).toBe(40_000)
    expect(c.head).toBe(50_000)   // 30k + 20k taken
    expect(c.next).toBe(90_000)   // 50k + 40k added
  })

  // Ten successive takes of 10k each drain a 100k list to zero; each take returns
  // a contiguous non-overlapping range covering exactly [0, 100k).
  it('successive large takes drain the list with contiguous ranges', () => {
    let c = add(create(10), inputs(100_000)).counters
    const ranges: { from: number; to: number }[] = []

    for (let i = 0; i < 10; i++) {
      const result = take(c, 10_000)
      ranges.push(result.taken)
      c = result.counters
    }

    expect(total(c)).toBe(0)
    expect(c.head).toBe(100_000)
    for (let i = 0; i < ranges.length - 1; i++) {
      expect(ranges[i]!.to).toBe(ranges[i + 1]!.from)
    }
    expect(ranges[0]!.from).toBe(0)
    expect(ranges[ranges.length - 1]!.to).toBe(100_000)
  })

  // With capacity 1 every creator is its own cohort; take must still be O(1)
  // even though a cohort boundary falls after every single creator.
  it('capacity 1 at scale: add 50k and take half', () => {
    let c = create(1)
    c = add(c, inputs(50_000)).counters
    expect(total(c)).toBe(50_000)

    const { counters, taken } = take(c, 25_000)
    expect(taken).toEqual({ from: 0, to: 25_000 })
    expect(total(counters)).toBe(25_000)
    expect(counters.head).toBe(25_000)
    expect(counters.next).toBe(50_000)
  })
})

describe('cohortOf', () => {
  // seq s lives in cohort floor(s / capacity); boundaries fall every `capacity` seqs.
  it('maps seqs to cohorts by capacity', () => {
    expect(cohortOf(0, 10)).toBe(0)
    expect(cohortOf(9, 10)).toBe(0)
    expect(cohortOf(10, 10)).toBe(1) // boundary: first seq of cohort 1
    expect(cohortOf(23, 10)).toBe(2)
  })

  // Capacity 1 makes every creator its own cohort: cohort number == seq.
  it('capacity 1 puts each creator in its own cohort', () => {
    expect(cohortOf(0, 1)).toBe(0)
    expect(cohortOf(7, 1)).toBe(7)
  })
})

describe('cohortCounts boundaries', () => {
  // The [2, 4, 2] picture from requirements.md (capacity 4, head=6, next=14):
  // cohort 3 has seqs 12,13 (2 waiting); cohort 2 is full (8-11); cohort 1 has 6,7 (2).
  it('reproduces the [2, 4, 2] picture', () => {
    let c = create(4)
    c = add(c, inputs(14)).counters // [2, 4, 4, 4]
    c = take(c, 6).counters // drop seqs 0-5 -> head=6
    expect(cohortCounts(c)).toEqual([2, 4, 2])
  })

  // A cohort emptied by a take simply stops existing as head crosses its boundary —
  // no cleanup, the count array just gets shorter from the right.
  it('emptied cohorts disappear as head crosses a boundary', () => {
    let c = add(create(4), inputs(8)).counters
    expect(cohortCounts(c)).toEqual([4, 4])
    c = take(c, 4).counters // head=4, cohort 0 fully served
    expect(cohortCounts(c)).toEqual([4]) // cohort 0 gone
    c = take(c, 1).counters // head=5, cohort 1 now partial
    expect(cohortCounts(c)).toEqual([3])
    c = take(c, 3).counters // head=8, list empty
    expect(cohortCounts(c)).toEqual([])
  })

  // Capacity 1 is the densest boundary case: every seq is its own cohort, so a
  // boundary falls after every creator. Counts must still be a run of 1s.
  it('handles capacity 1 (every creator its own cohort)', () => {
    let c = add(create(1), inputs(3)).counters // seqs 0,1,2 -> cohorts 0,1,2
    expect(cohortCounts(c)).toEqual([1, 1, 1])
    c = take(c, 1).counters // head=1, cohort 0 gone
    expect(cohortCounts(c)).toEqual([1, 1])
  })
})

describe('oldest / newest cohort numbers', () => {
  it('are undefined for an empty list', () => {
    expect(oldestCohort(create(10))).toBeUndefined()
    expect(newestCohort(create(10))).toBeUndefined()
  })

  // With 25 creators at capacity 10 the cohorts are 0,1,2; after taking 12 the
  // oldest waiting creator (seq 12) is in cohort 1, the newest (seq 24) in cohort 2.
  it('track the head and newest waiting seq', () => {
    let c = add(create(10), inputs(25)).counters
    expect(oldestCohort(c)).toBe(0)
    expect(newestCohort(c)).toBe(2)
    c = take(c, 12).counters // head=12
    expect(oldestCohort(c)).toBe(1)
    expect(newestCohort(c)).toBe(2)
    // cohortCounts spans exactly oldest..newest, newest-first.
    expect(cohortCounts(c)).toHaveLength(newestCohort(c)! - oldestCohort(c)! + 1)
  })
})

describe('cohortRange (row expansion)', () => {
  // head=12, next=25, capacity 10: cohort 1 holds waiting seqs [12,20), cohort 2 [20,25),
  // and the fully-served cohort 0 yields an empty range clamped to head.
  it('returns the waiting seq range within a cohort', () => {
    const c = take(add(create(10), inputs(25)).counters, 12).counters
    expect(cohortRange(c, 1)).toEqual({ from: 12, to: 20 })
    expect(cohortRange(c, 2)).toEqual({ from: 20, to: 25 })
    expect(cohortRange(c, 0)).toEqual({ from: 12, to: 12 }) // fully served -> empty
    const beyond = cohortRange(c, 9) // beyond newest -> empty range
    expect(beyond.from).toBe(beyond.to)
  })

  // Capacity 1: each cohort spans exactly one seq, so ranges are unit-width.
  it('handles capacity 1 (single-seq cohorts)', () => {
    const c = take(add(create(1), inputs(3)).counters, 1).counters // head=1, next=3
    expect(cohortRange(c, 1)).toEqual({ from: 1, to: 2 })
    expect(cohortRange(c, 2)).toEqual({ from: 2, to: 3 })
    expect(cohortRange(c, 0)).toEqual({ from: 1, to: 1 }) // served -> empty
  })
})

describe('previewRange (take preview)', () => {
  it('previews the n oldest, clamps to total, and is a no-op for 0', () => {
    const c = add(create(10), inputs(5)).counters
    expect(previewRange(c, 3)).toEqual({ from: 0, to: 3 })
    expect(previewRange(c, 100)).toEqual({ from: 0, to: 5 }) // clamps to total
    expect(previewRange(c, 0)).toEqual({ from: 0, to: 0 })
  })

  // The preview must match exactly what take(n) actually removes.
  it('agrees with take(n).taken', () => {
    const c = add(create(10), inputs(5)).counters
    expect(take(c, 3).taken).toEqual(previewRange(c, 3))
    expect(take(c, 100).taken).toEqual(previewRange(c, 100))
  })

  // After a prior take the preview starts at the current head, not 0.
  it('starts at the current head', () => {
    const c = take(add(create(10), inputs(5)).counters, 2).counters // head=2
    expect(previewRange(c, 2)).toEqual({ from: 2, to: 4 })
  })

  it('rejects negative / non-integer counts', () => {
    const c = add(create(10), inputs(5)).counters
    for (const bad of [-1, 1.5, NaN, Infinity]) {
      expect(() => previewRange(c, bad)).toThrow(RangeError)
    }
  })
})

describe('onboardingRange (served history)', () => {
  // Everything below head, [0, head): empty until something is taken, and it only
  // ever grows — adding creators never changes what has already been served.
  it('covers [0, head) and grows only on take', () => {
    expect(onboardingRange(create(10))).toEqual({ from: 0, to: 0 })
    let c = add(create(10), inputs(5)).counters
    expect(onboardingRange(c)).toEqual({ from: 0, to: 0 }) // nothing taken yet
    c = take(c, 3).counters
    expect(onboardingRange(c)).toEqual({ from: 0, to: 3 }) // 3 served
    c = add(c, inputs(4)).counters // adding does not change served history
    expect(onboardingRange(c)).toEqual({ from: 0, to: 3 })
    c = take(c, 2).counters // head=5
    expect(onboardingRange(c)).toEqual({ from: 0, to: 5 })
  })
})

describe('immutability', () => {
  // The reducer/stable-buffer design depends on the counters never being mutated
  // in place. Reads and operations must leave their input object untouched.
  it('operations and derivations never mutate the input counters', () => {
    const c = add(create(10), inputs(5)).counters
    const snapshot = { ...c }
    add(c, inputs(2))
    take(c, 3)
    previewRange(c, 4)
    cohortCounts(c)
    cohortRange(c, 0)
    onboardingRange(c)
    expect(c).toEqual(snapshot)
  })
})
