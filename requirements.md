# Requirements — Cohort Waiting List (Elective Take-home)

## Overview

Elective onboards course creators in **cohorts** — fixed-size groups that move
through onboarding together — to cap inflow into the Ops team. This app manages
the waiting list: add creators in, pull cohorts out for onboarding, and always
serve whoever has waited longest first (FIFO).

A creator counts as `1` toward cohort capacity — adding 10 creators adds 10.
Each creator additionally has attributes:

- **Name** — free-text string
- **Area** — one of 5 fixed options selected from a dropdown
  (e.g. `Design`, `Development`, `Marketing`, `Music`, `Writing`)

## Tech Stack

- **Runtime/tooling:** Bun — package manager and script runner throughout
  (`bun install`, `bun run dev`, `bun run test`), locally and in CI
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **State:** In-memory client state (reducer as source of truth), persisted
  to **IndexedDB** so the waiting list survives page reloads; no backend

## The Model

- A **waiting list** holds zero or more **cohorts**.
- A **cohort** has a fixed **capacity** (default 10), can be partially filled,
  and holds the individual **creator records** (name + area) in it.
- Cohorts are ordered: **newest on the left, oldest on the right.**
  Serving (removal) always happens **from the right**.
- The state is visualized as a list of cohort counts, e.g. `[6, 10]` =
  a newer cohort with 6 creators and an older, full cohort of 10. The `10`
  is next to be served.
- Within a single cohort, creator order doesn't matter — only the ordering
  **between** cohorts does.

## Functional Requirements

### FR1 — Create a waiting list

- Create a waiting list with a configurable **cohort capacity**, default **10**.
- Capacity must be a positive integer (capacity of 1 must work).
- A new list is empty: `[]`.

### FR2 — Add N creators (single call)

- Add any number of creators in one call. Each creator carries a **name**
  and an **area** (one of the 5 dropdown options).
- **No cohort may exceed capacity.** New creators first fill the remaining
  space in the newest (leftmost) cohort, then overflow opens as many new
  cohorts on the left as needed.
- Adds are never rejected for size — they always succeed by opening new cohorts.
- Examples (capacity 10):
  - `[]` + add 3 → `[3]`
  - `[3]` + add 13 → `[6, 10]` (7 fill the existing cohort, 6 open a new one)
  - `[6, 10]` + add 22 → `[8, 10, 10, 10]`

### FR3 — Take up to N creators (FIFO)

- Remove up to N creators, **oldest first** — i.e. drain from the **right**.
- A cohort emptied by a take is removed from the list (no empty cohorts linger).
- Taking more than the total takes everything; the list may become `[]`.
- Examples (capacity 10):
  - `[8, 10, 10, 10]` take 4 → `[8, 10, 10, 6]`
  - `[8, 10, 10, 6]` take 7 → `[8, 10, 9]`
  - `[8, 10, 9]` take 20 → `[7]`

### FR4 — Total waiting

- Report the total number of creators currently waiting (sum across cohorts).
- E.g. `[8, 10, 9]` → 27.

## Web Component

A simple page wrapping the system:

- Create/reset the waiting list with a capacity input (default 10).
- An **Add creators** control: name input, **area dropdown** (5 options),
  and a way to add one or more creators in a single action.
- A **Take N** control (numeric input + button). Taking is a two-step flow:
  the button opens a **confirmation modal** listing the creators who would
  be taken (name + area, oldest first); confirming removes them from the
  waiting list, cancelling changes nothing.
- An **Onboarding view** — a second view (e.g. a tab) listing all creators
  taken so far. Confirmed creators move from the waiting list into this
  view.
- A visualization of the current cohort state (the `[6, 10]`-style list,
  newest left / oldest right) and the total waiting.
- Look and feel are explicitly **not graded** — it just needs to work and be
  sensible. No visual polish required.

## How It Works: the Ledger

One observation makes the whole design simple and fast: **new creators always
fill the newest cohort before a new one opens, and we only ever serve the
oldest.** So every cohort between the newest and the oldest is always full.

That means we never need to store cohorts. We store:

- a **ledger** — every creator ever added, in arrival order. Each creator's
  position in this list is their **seq** number, and it never changes.
- **`head`** — the seq of the oldest creator still waiting
- **`next`** — the seq the next creator will get
- **`capacity`**

Everything else is simple math:

- **Total waiting** = `next − head`
- **Which cohort is creator s in?** = `floor(s / capacity)` — fixed forever
- **Add m creators** = append them to the ledger (`next` moves up by m)
- **Take n creators** = move `head` up by n. That's it — no records are
  touched, which is why take is O(1) no matter how big n or the list is.

### Picture (capacity 4)

```
         cohort 0          cohort 1           cohort 2          cohort 3
      (fully served)  (oldest, partial)       (full)       (newest, filling)
     ┌───┬───┬───┬───┐ ┌───┬───┬───┬───┐ ┌───┬───┬───┬───┐ ┌───┬───┬───┬───┐
seq  │ 0 │ 1 │ 2 │ 3 │ │ 4 │ 5 │ 6 │ 7 │ │ 8 │ 9 │ 10│ 11│ │ 12│ 13│   │   │
     └───┴───┴───┴───┘ └───┴───┴───┴───┘ └───┴───┴───┴───┘ └───┴───┴───┴───┘
      ░░░░ taken ░░░░░░░░░░░░░░│◄────────────── waiting ──────────►│
                            head = 6                            next = 14
```

The UI's `[2, 4, 2]` view is just this picture read right-to-left: cohort 3
has 2 creators (still filling), cohort 2 is full, cohort 1 has 2 left (next
to be served). When `head` crosses a cohort boundary, that cohort simply
stops existing — no cleanup code needed.

The records to the left of `head` are not garbage: they are the
**Onboarding view's** data — everyone taken so far, in the order they were
served. One ledger backs both views; `head` is the boundary between them.

### Costs

| Operation | Cost | Why |
| --- | --- | --- |
| Take n | **O(1)** | move `head` |
| Total | **O(1)** | `next − head` |
| Add m | O(m) | must read m inputs — can't do better |
| Render | **O(1)** | middle cohorts are all full, shown as one "×N full" chip |

The **area** field is typed as a union of the 5 options (not `string`), so
an invalid area can't compile.

## Core Module & Unit Tests

All waiting-list logic lives in one plain TypeScript module (e.g.
`src/lib/waitingList.ts`) with **no React imports** — pure functions over
the counters and the ledger: create, add, take, total, plus the derivations
(cohort counts, cohort-of-seq, slice ranges for each view). React
components and the reducer only *call* this module; they contain no cohort
math of their own. If a piece of logic needs a component to test it, it's
in the wrong file.

**Input validation lives in the React components, not the core module.** The
components are the only place that guards against invalid input — non-positive
or non-integer capacity, non-numeric or negative take counts, empty or
whitespace-only names — and they reject it before anything reaches the core.
The core functions trust their inputs: they assume capacity is a positive
integer and counts are non-negative integers, and carry no defensive guards of
their own. Validation has one home, the UI boundary, never two.

The module is unit-tested directly (Vitest), with no rendering involved.
Tests assert concrete values and behaviour — **no snapshot testing**
(`toMatchSnapshot`); snapshots hide what an assertion actually checks and rot
into rubber-stamps. Unit tests are written **alongside the code they prove, in
the same PR** — never as a separate later deliverable — and grow with every
phase that adds or changes logic. Required coverage:

- The full example flow from the spec, step by step:
  `[]` → add 3 → add 13 → add 22 → take 4 → take 7 → total 27 → take 20 →
  total 7
- Every edge case from the Edge Cases section: add 0 / take 0, take more
  than total, take from empty, capacity 1, and cohorts disappearing when
  emptied (rejecting invalid input is a component concern, not the module's —
  see below)
- The derivations: total, per-cohort counts, oldest/newest cohort numbers,
  and the slice ranges used by the modal and the onboarding view
- A large-input **correctness** check (e.g. add 100k, take 99k, plus
  interleaved batches) confirming the counters stay correct at scale. This
  proves correctness, not speed — the core operations are O(1)/O(m) by
  construction, so *performance* is measured at the React-component level
  (see below), never in this module

Component tests are minimal — the components are thin enough that the type
system plus a render smoke test covers most of them. Two things, though, are
proven at the component level rather than in the module:

- **Input validation** — because rejecting invalid input is the components'
  job, the tests that prove rejection (bad capacity, empty names, non-numeric
  counts) live with the components and the E2E suite, not the module.
- **Performance** — the core operations are O(1)/O(m) by construction, so the
  thing actually worth proving is that the *components* stay responsive with
  large inputs: a large cohort list renders in constant DOM (the collapsed
  "×N full" middle), the onboarding view stays windowed, and a big batch add
  doesn't block the UI. These performance checks run at the React-component /
  E2E level, never against the core module.

The cohort/ledger edge-case behavior is still proven in the module tests,
once, not re-proven through the UI.

## E2E Tests & CI

**Cypress** E2E tests cover the real user flows in a browser against the
built app:

- Create a list, add creators (single and batch), see the cohort view and
  total update
- The spec's example flow end to end through the UI
- Take flow: open the confirmation modal, verify the preview, confirm, see
  creators appear in the Onboarding view; cancel and verify nothing changed
- Edge cases at the UI level: invalid capacity, empty name, take when
  empty (button disabled), take more than total
- Persistence: add and take, reload the page, verify the state survived

The suite is **built incrementally**: every phase that ships user-facing
behavior adds or updates the E2E tests for that behavior in the same PR —
the suite is never a separate, after-the-fact deliverable.

**CI gating:** every PR runs the unit tests and the Cypress suite
(GitHub Actions). Merging is blocked unless **both** pass — they're
required status checks on `main`. E2E tests don't replace the unit tests:
the module tests prove the logic exhaustively; Cypress proves the wiring.

## React State

One `useReducer` in the root component is the single source of truth. Three
actions:

- **Reset** — new empty list with the given capacity
- **Add** — a batch of creators (one dispatch no matter the batch size)
- **Take** — a count; remembers which seq range was taken so the UI can
  highlight the newly admitted creators

The confirmation modal needs no action of its own: previewing "who would be
taken" is a pure read of the ledger range starting at `head` — nothing is
dispatched until the user confirms.

The reducer state is just the small numbers (`head`, `next`, `capacity`,
last-taken range), so every update is cheap. The ledger itself sits in a
stable buffer next to the reducer — safe to share because records are never
changed after they're added.

## Components

Two levels: the root owns the state, children get props and callbacks.
Dispatch is passed down directly — no context or state library needed at
this size.

- **CreateForm** — capacity input + create/reset button; rejects anything
  that isn't a positive integer
- **AddForm** — name input + area dropdown; can queue several creators and
  submit them as one batch; blocks empty names
- **TakeForm** — number input + take button; disabled when the list is
  empty. The button opens the confirmation modal rather than taking
  directly.
- **TakeConfirmModal** — lists the creators who would be taken (oldest
  first, capped with a "+k more" line for huge takes), with Confirm and
  Cancel. Confirm dispatches Take; Cancel just closes.
- **Summary** — total waiting and cohort count
- **CohortList** — shows the newest cohort, one collapsed "10 ×N full" chip
  for the middle, and the oldest cohort (marked "next to be served"). A
  cohort can be expanded to list its creators.
- **OnboardingView** — the second view (tab): all creators taken so far, in
  served order, with the most recent take highlighted. Paginated/windowed,
  since it grows without bound.

React keys come from seq / cohort numbers (stable forever), never array
indexes.

## Persistence (IndexedDB)

State survives page reloads. The reducer stays the source of truth;
IndexedDB just mirrors it from a single persistence module (a thin promise
wrapper like `idb` is fine).

Two object stores:

```ts
// Store 'creators' (keyPath: 'seq') — written once at add time, never updated
interface CreatorRecord {
  seq: number;
  name: string;
  area: 'Design' | 'Development' | 'Marketing' | 'Music' | 'Writing';
}

// Store 'meta' (keyPath: 'id') — exactly one record, id = 'current'
interface MetaRecord {
  id: 'current';
  schemaVersion: number; // discard the data if it doesn't match
  capacity: number;
  head: number;
  next: number;
}
```

How writes work:

- **Add** → put the new creator records + the meta record (one transaction)
- **Take** → put just the meta record (O(1) — creator records aren't
  touched; they stay where they are and simply fall on the onboarded side
  of `head`)
- Records below `head` are **kept** — they back the Onboarding view. They
  are only removed by a reset.
- **Reset** → clear both stores (waiting list *and* onboarding history)

On startup, read meta, load creators from `0` to `next − 1`, and show a
brief loading state. If IndexedDB is unavailable (e.g. private browsing),
run in-memory and tell the user changes won't survive a reload. If the
stored data is corrupt or from an old schema version, discard it and start
empty.

## Edge Cases

- `add(0)` / `take(0)` — no-ops
- Take more than the total, or take from an empty list — the modal previews
  (and a confirm takes) only what's actually there
- Cancelling the confirmation modal — no state change at all
- Capacity of 1
- Emptied cohorts disappear (free, via the head-crosses-boundary math)
- Negative / non-integer / non-numeric input — rejected in the React
  components; the core module trusts its inputs and does not re-check them
- Empty or whitespace-only names — rejected; duplicate names are fine
  (names are labels, not identifiers)
- Huge adds/takes — covered by the O(1)/O(m) costs above

## Decisions to Document in the Writeup

- `take(n)` returns the taken creators (via seq range), not just a count
- Taking more than available is a success, not an error
- Invalid form input is rejected (not silently clamped)
- Input validation lives only in the React components; the core module trusts
  its inputs and carries no defensive guards
- Capacity is fixed at creation — reset to change it

## Out of Scope

- Authentication, backend, cross-device sync (persistence is local-only)
- Creator attributes beyond name and area
- Filtering/searching creators
- Visual polish
