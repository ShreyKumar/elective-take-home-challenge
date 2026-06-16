import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deletePersistence,
  hydrate,
  isPersistenceAvailable,
  persistAdd,
  persistReset,
  persistTake,
} from './waitingListDB'
import { type Creator } from '../lib/waitingList'

/** N creator records with seqs [from, to), all area 'Design'. */
function creators(from: number, to: number): Creator[] {
  return Array.from({ length: to - from }, (_, i) => ({
    seq: from + i,
    name: `C${from + i}`,
    area: 'Design',
  }))
}

/** Write a raw record straight to a store, bypassing the module's validation. */
async function writeRaw(store: 'meta' | 'creators', value: unknown) {
  const db = await openDB('elective-waiting-list', 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('creators')) d.createObjectStore('creators', { keyPath: 'seq' })
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' })
    },
  })
  await db.put(store, value as never)
  db.close()
}

describe('waitingListDB', () => {
  // Each test starts from a clean database.
  afterEach(async () => {
    await deletePersistence()
  })

  // A fresh add round-trips: hydrate returns the same counters and records.
  it('round-trips an add', async () => {
    const records = creators(0, 3)
    await persistAdd(records, { capacity: 10, head: 0, next: 3 })
    expect(await hydrate()).toEqual({
      counters: { capacity: 10, head: 0, next: 3 },
      records,
    })
  })

  // No data yet → start empty.
  it('hydrate returns null when nothing is stored', async () => {
    expect(await hydrate()).toBeNull()
  })

  // Take writes only meta; the creator records are untouched (O(1)), and hydrate
  // loads just the waiting range [head, next) — the served ones stay in the store.
  it('take writes only meta and retains served records (O(1))', async () => {
    await persistAdd(creators(0, 5), { capacity: 10, head: 0, next: 5 })
    await persistTake({ capacity: 10, head: 2, next: 5 })

    // Served records (seq 0, 1) must remain physically in the store — take only
    // moves head; it must never delete or shift consumed records.
    const db = await openDB('elective-waiting-list', 1)
    const all = await db.getAll('creators')
    db.close()
    expect(all.map((r) => r.seq).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])

    // hydrate still surfaces only the waiting window [head, next).
    const state = await hydrate()
    expect(state!.counters).toEqual({ capacity: 10, head: 2, next: 5 })
    expect(state!.records.map((r) => r.seq)).toEqual([2, 3, 4])
  })

  // A fully-drained list persists as empty (head === next), no records loaded.
  it('persists a drained list as empty', async () => {
    await persistAdd(creators(0, 3), { capacity: 10, head: 0, next: 3 })
    await persistTake({ capacity: 10, head: 3, next: 3 })
    expect(await hydrate()).toEqual({ counters: { capacity: 10, head: 3, next: 3 }, records: [] })
  })

  // Reset clears all creator records (even served ones) and resets the counters.
  it('reset clears creators and resets the counters', async () => {
    await persistAdd(creators(0, 5), { capacity: 10, head: 0, next: 5 })
    await persistReset({ capacity: 7, head: 0, next: 0 })
    expect(await hydrate()).toEqual({ counters: { capacity: 7, head: 0, next: 0 }, records: [] })
  })

  // A meta record from a different schema version is discarded (start empty).
  it('discards data from an old/unknown schema version', async () => {
    await writeRaw('meta', { id: 'current', schemaVersion: 99, capacity: 10, head: 0, next: 3 })
    expect(await hydrate()).toBeNull()
  })

  // Meta claims 3 waiting but the creator records are missing → discard.
  it('discards when waiting creator records are missing', async () => {
    await writeRaw('meta', { id: 'current', schemaVersion: 1, capacity: 10, head: 0, next: 3 })
    expect(await hydrate()).toBeNull()
  })

  // Out-of-range counters in an otherwise-shaped meta are corrupt → discard
  // (degrades to empty, never throws — the next >= head guard runs before getAll).
  it('discards meta with out-of-range counters', async () => {
    const cases = [
      { id: 'current', schemaVersion: 1, capacity: 10, head: 4, next: 2 }, // next < head
      { id: 'current', schemaVersion: 1, capacity: 0, head: 0, next: 0 }, // capacity < 1
      { id: 'current', schemaVersion: 1, capacity: 1.5, head: 0, next: 0 }, // non-integer capacity
      { id: 'current', schemaVersion: 1, capacity: 10, head: -1, next: 0 }, // negative head
    ]
    for (const bad of cases) {
      await writeRaw('meta', bad) // keyPath 'id' = 'current', overwrites each time
      expect(await hydrate()).toBeNull()
    }
  })

  // A malformed creator record (bad area) in the waiting range → discard.
  it('discards when a waiting creator record is malformed', async () => {
    await persistAdd(creators(0, 2), { capacity: 10, head: 0, next: 3 })
    await writeRaw('creators', { seq: 2, name: 'Bad', area: 'NotAnArea' })
    expect(await hydrate()).toBeNull()
  })

  // The availability probe reflects whether IndexedDB exists.
  it('detects whether IndexedDB is available', () => {
    expect(isPersistenceAvailable()).toBe(true)
    const saved = globalThis.indexedDB
    // @ts-expect-error simulate a browser without IndexedDB
    globalThis.indexedDB = undefined
    expect(isPersistenceAvailable()).toBe(false)
    globalThis.indexedDB = saved
  })
})
