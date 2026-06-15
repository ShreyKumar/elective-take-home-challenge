// Core waiting-list ledger. Pure functions, no React. Cohorts are never
// stored — the entire waiting list is four scalars plus the append-only
// ledger of creator records. See requirements.md → "How It Works: the Ledger".
//
// Cohort derivations (counts, cohort-of-seq, slice ranges) arrive in Phase 3;
// this module is just create / add / take / total over the counters.

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

export interface AddResult {
  counters: Counters
  /** Newly created records, seqs assigned in arrival order from the old `next`. */
  records: Creator[]
}

export interface TakeResult {
  counters: Counters
  /** Half-open seq range `[from, to)` that was taken (oldest first). */
  taken: { from: number; to: number }
}

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer, got ${value}`)
  }
}

function assertNonNegativeInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer, got ${value}`)
  }
}

/** FR1 — a fresh, empty waiting list with the given cohort capacity. */
export function create(capacity: number): Counters {
  assertPositiveInt(capacity, 'capacity')
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
 * FR3 — take up to `n` creators, oldest first, by moving `head` forward.
 * Taking more than the total takes only what's there (success, not an error);
 * `take(0)` and taking from an empty list are no-ops. O(1) — no records are
 * touched; taken records simply fall on the onboarded side of `head`.
 */
export function take(counters: Counters, n: number): TakeResult {
  assertNonNegativeInt(n, 'take count')
  const count = Math.min(n, total(counters))
  const from = counters.head
  const to = from + count
  return {
    counters: { ...counters, head: to },
    taken: { from, to },
  }
}
