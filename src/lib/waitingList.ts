// Core waiting-list ledger. Pure functions, no React. Cohorts are never
// stored — the entire waiting list is three scalars (capacity, head, next)
// plus the append-only ledger of creator records. See requirements.md →
// "How It Works: the Ledger".
//
// This module holds the core operations (create / add / take / total) and the
// cohort derivations the views read: per-cohort counts, cohort-of-seq, the
// oldest/newest cohort numbers, and the seq ranges for the cohort view and a
// cohort's creator list. Components and the reducer only call this module; they
// contain no cohort math of their own.

export type Area = 'Design' | 'Development' | 'Marketing' | 'Music' | 'Writing'

export const AREAS = [
  'Design',
  'Development',
  'Marketing',
  'Music',
  'Writing',
] as const satisfies readonly Area[]

/** A creator once it has joined the ledger. `seq` is its arrival index. */
export interface Creator {
  seq: number
  name: string
  area: Area
}

/** A creator before it joins the ledger — no seq assigned yet. */
export type CreatorInput = Omit<Creator, 'seq'>

/**
 * The whole waiting-list state. `head` is the seq of the oldest creator still
 * waiting; `next` is the seq the next arrival will get. Total waiting is
 * `next - head`; cohort k holds seqs `[k*capacity, (k+1)*capacity)`.
 */
export interface Counters {
  capacity: number
  head: number
  next: number
}

/** A half-open seq range `[from, to)`. Empty when `from === to`. */
export interface Range {
  from: number
  to: number
}

export interface AddResult {
  counters: Counters
  /** Newly created records, seqs assigned in arrival order from the old `next`. */
  records: Creator[]
}

export interface TakeResult {
  counters: Counters
  /** The seq range that was taken (oldest first). */
  taken: Range
}

function assertInt(value: number, label: string, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    const kind = min > 0 ? 'a positive' : 'a non-negative'
    throw new RangeError(`${label} must be ${kind} integer, got ${value}`)
  }
}

// --- Core operations ---

/** FR1 — a fresh, empty waiting list with the given cohort capacity. */
export function create(capacity: number): Counters {
  assertInt(capacity, 'capacity', 1)
  return { capacity, head: 0, next: 0 }
}

/** FR4 — total creators currently waiting. O(1). */
export function total(counters: Counters): number {
  return counters.next - counters.head
}

/**
 * FR2 — append creators to the ledger. Adds never fail for size: each input
 * gets the next seq in arrival order and `next` advances by the batch length.
 * Returns the new counters and the created records for the caller's ledger.
 * O(m) in the batch size; an empty batch is a no-op.
 */
export function add(counters: Counters, inputs: readonly CreatorInput[]): AddResult {
  const records = inputs.map((input, i) => ({
    seq: counters.next + i,
    name: input.name,
    area: input.area,
  }))
  return {
    counters: { ...counters, next: counters.next + inputs.length },
    records,
  }
}

/**
 * The seq range the next `take(n)` would remove — the `n` oldest waiting
 * creators — without mutating anything: a pure read at `head` that `take` reuses
 * to compute its range. Taking more than the total previews only what's there.
 * Rejects negative / non-integer counts.
 */
export function previewRange(counters: Counters, n: number): Range {
  assertInt(n, 'take count', 0)
  const from = counters.head
  const to = from + Math.min(n, total(counters))
  return { from, to }
}

/**
 * FR3 — take up to `n` creators, oldest first, by moving `head` to the end of
 * the previewed range. Taking more than the total takes only what's there
 * (success, not an error); `take(0)` and taking from an empty list are no-ops.
 * O(1) — no records are touched; taken records simply fall on the onboarded
 * side of `head`.
 */
export function take(counters: Counters, n: number): TakeResult {
  const taken = previewRange(counters, n)
  return {
    counters: { ...counters, head: taken.to },
    taken,
  }
}

// --- Cohort derivations (what the views read) ---

/** The cohort a given seq belongs to — `floor(seq / capacity)`, fixed forever. */
export function cohortOf(seq: number, capacity: number): number {
  return Math.floor(seq / capacity)
}

/** Cohort number of the oldest waiting creator, or `undefined` when empty. */
export function oldestCohort(counters: Counters): number | undefined {
  if (counters.next <= counters.head) return undefined
  return cohortOf(counters.head, counters.capacity)
}

/** Cohort number of the newest waiting creator, or `undefined` when empty. */
export function newestCohort(counters: Counters): number | undefined {
  if (counters.next <= counters.head) return undefined
  return cohortOf(counters.next - 1, counters.capacity)
}

/**
 * How many cohorts the waiting list currently spans — `0` when empty. O(1):
 * cohorts run contiguously from oldest to newest (the middle ones are always
 * full), so the span is just `newest - oldest + 1`. Equivalent to
 * `cohortCounts(counters).length` but without materializing the array.
 */
export function cohortCount(counters: Counters): number {
  const newest = newestCohort(counters)
  const oldest = oldestCohort(counters)
  if (newest === undefined || oldest === undefined) return 0
  return newest - oldest + 1
}

/**
 * The waiting seq range within a single cohort, for expanding a cohort row to
 * list its creators. Returns an empty range (`from === to`) for a cohort with
 * nothing currently waiting.
 */
export function cohortRange(counters: Counters, cohort: number): Range {
  const { capacity, head, next } = counters
  const from = Math.max(cohort * capacity, head)
  const to = Math.max(from, Math.min((cohort + 1) * capacity, next))
  return { from, to }
}

/**
 * Waiting count per cohort, newest cohort first (the `[8, 10, 10, 10]` view).
 * Every cohort between newest and oldest is full, so only the two ends can be
 * partial. Each entry is the width of the matching `cohortRange`, so counts and
 * ranges share one source of truth. An empty list yields `[]`.
 */
export function cohortCounts(counters: Counters): number[] {
  const newest = newestCohort(counters)
  const oldest = oldestCohort(counters)
  if (newest === undefined || oldest === undefined) return []
  const result: number[] = []
  for (let k = newest; k >= oldest; k--) {
    const { from, to } = cohortRange(counters, k)
    result.push(to - from)
  }
  return result
}
