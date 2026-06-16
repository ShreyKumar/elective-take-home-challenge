// IndexedDB persistence for the waiting list. The reducer stays the source of
// truth (see useWaitingList); this module just mirrors it to two object stores
// so the list survives a reload (requirements.md → "Persistence"). All access
// goes through one open-use-close helper; callers never touch IndexedDB directly.

import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb'
import { AREAS, type Area, type Counters, type Creator } from '../lib/waitingList'

const DB_NAME = 'elective-waiting-list'
const DB_VERSION = 1
/** Bump when the stored shape changes; a meta record with another version is discarded. */
const SCHEMA_VERSION = 1
const META_KEY = 'current'

interface MetaRecord {
  id: typeof META_KEY
  schemaVersion: number
  capacity: number
  head: number
  next: number
}

interface WaitingListSchema extends DBSchema {
  // Store 'creators' (keyPath 'seq') — written once at add time, never updated.
  creators: { key: number; value: Creator }
  // Store 'meta' (keyPath 'id') — exactly one record, id = 'current'.
  meta: { key: string; value: MetaRecord }
}

/** The state read back from IndexedDB: the counters plus the still-waiting records. */
export interface PersistedState {
  counters: Counters
  /** Creators with seq in `[head, next)` — the ones still waiting. */
  records: Creator[]
}

/** True when IndexedDB exists (false in e.g. some private-browsing modes). */
export function isPersistenceAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

async function withDb<T>(fn: (db: IDBPDatabase<WaitingListSchema>) => Promise<T>): Promise<T> {
  const db = await openDB<WaitingListSchema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('creators', { keyPath: 'seq' })
      database.createObjectStore('meta', { keyPath: 'id' })
    },
  })
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}

// Serialize write-behind so commits always land in call order. Each write opens
// its own short-lived connection, so without this a later take could commit
// before an earlier add and persist a stale head/next. A failed write never
// stalls the chain (the queue swallows rejections; callers still see theirs).
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(op, op)
  writeQueue = run.catch(() => {})
  return run
}

function metaRecord(counters: Counters): MetaRecord {
  return {
    id: META_KEY,
    schemaVersion: SCHEMA_VERSION,
    capacity: counters.capacity,
    head: counters.head,
    next: counters.next,
  }
}

const AREA_SET = new Set<string>(AREAS)

function isValidMeta(meta: unknown): meta is MetaRecord {
  if (typeof meta !== 'object' || meta === null) return false
  const m = meta as Record<string, unknown>
  return (
    m.schemaVersion === SCHEMA_VERSION &&
    Number.isInteger(m.capacity) &&
    (m.capacity as number) >= 1 &&
    Number.isInteger(m.head) &&
    (m.head as number) >= 0 &&
    Number.isInteger(m.next) &&
    (m.next as number) >= (m.head as number)
  )
}

function isValidCreator(rec: unknown): rec is Creator {
  if (typeof rec !== 'object' || rec === null) return false
  const r = rec as Record<string, unknown>
  return (
    Number.isInteger(r.seq) &&
    typeof r.name === 'string' &&
    typeof r.area === 'string' &&
    AREA_SET.has(r.area as Area)
  )
}

/**
 * Read persisted state, or `null` to start empty. Returns null when there's no
 * data, when the meta record is corrupt or from an old schema version, or when
 * any waiting creator record is missing or malformed — discard rather than
 * render half a list.
 */
export async function hydrate(): Promise<PersistedState | null> {
  return withDb(async (db) => {
    const meta = await db.get('meta', META_KEY)
    if (!isValidMeta(meta)) return null
    const counters: Counters = { capacity: meta.capacity, head: meta.head, next: meta.next }
    if (meta.next === meta.head) return { counters, records: [] } // nothing waiting
    const records = await db.getAll('creators', IDBKeyRange.bound(meta.head, meta.next - 1))
    if (records.length !== meta.next - meta.head || !records.every(isValidCreator)) {
      return null
    }
    return { counters, records }
  })
}

/** FR2 persistence: write the new creator records + meta in one transaction. */
export function persistAdd(records: readonly Creator[], counters: Counters): Promise<void> {
  return enqueue(() =>
    withDb(async (db) => {
      const tx = db.transaction(['creators', 'meta'], 'readwrite')
      for (const record of records) tx.objectStore('creators').put(record)
      tx.objectStore('meta').put(metaRecord(counters))
      await tx.done
    }),
  )
}

/** FR3 persistence: take only moves head — write just the meta record (O(1)). */
export function persistTake(counters: Counters): Promise<void> {
  return enqueue(() => withDb((db) => db.put('meta', metaRecord(counters)).then(() => undefined)))
}

/** Reset clears both stores: all creator records and the waiting-list state. */
export function persistReset(counters: Counters): Promise<void> {
  return enqueue(() =>
    withDb(async (db) => {
      const tx = db.transaction(['creators', 'meta'], 'readwrite')
      tx.objectStore('creators').clear()
      tx.objectStore('meta').put(metaRecord(counters))
      await tx.done
    }),
  )
}

/** Delete the whole database — used for a hard reset and by tests for isolation. */
export async function deletePersistence(): Promise<void> {
  await deleteDB(DB_NAME)
}
