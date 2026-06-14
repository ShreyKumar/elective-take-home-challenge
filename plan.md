# Implementation Plan — Cohort Waiting List

Source of truth: `requirements.md`. The work is split into small phases,
each targeting ~150 changed lines or fewer (soft limit). Every phase ends
with a PR against `main` with a detailed description. Phases build on each
other in order; the app is runnable after every phase.

## Process rules

- One branch per phase (`phase-1-scaffold`, `phase-2-core`, …), one PR per
  phase, merged before the next phase starts.
- **Authorship:** commits are authored by Claude Code
  (`Claude Code <noreply@anthropic.com>` via `git commit --author`),
  with the human as committer. PRs are opened with whatever GitHub
  credential is configured; GitHub shows that account as the PR opener
  (see the AI-collaboration writeup for attribution).
- Every change requested **after** this plan is written becomes a new
  numbered phase appended to this file — never folded silently into an
  existing phase. **One documented exception:** the Cypress + CI gate was
  requested after the original plan and would have been appended as
  Phase 11, but because it is a prerequisite for the E2E tests that the UI
  phases write, it has been re-sequenced into its logical execution slot as
  Phase 4 (this renumbered the old phases 4–10 to 5–11). This is a one-time
  reorganization, recorded here; the append rule otherwise still holds.
- Each PR description states: what changed, why (linking the relevant
  requirements section), the decisions made, and how it was verified.
- **Both test suites evolve with every phase.** Tests are never a separate
  phase or a follow-up PR:
  - **Unit tests (Vitest):** any phase that adds or changes logic ships
    the unit tests for that logic in the same PR.
  - **E2E tests (Cypress):** from Phase 4 (the Cypress/CI gate) onward, any
    phase that ships or changes user-facing behavior extends the E2E suite
    in the same PR.
  A change and its coverage merge together, through the gate, never
  separately.

---

## Phase 1 — Project scaffold

**Goal:** Empty but running app with the toolchain in place.

**Scope:**
- **Bun** as package manager and script runner (`bun.lock` committed; no
  npm/yarn artifacts)
- Vite + React + TypeScript scaffold
- Tailwind CSS wired up
- Vitest configured (run through Bun: `bun run test`)
- App shell renders a title; `bun run dev`, `bun run build`, and
  `bun run test` all work

**Est. size:** ~60 lines hand-written (scaffold output excluded).

**PR:** `Phase 1: Bun + Vite + React + TS + Tailwind + Vitest scaffold`
Description covers: tool versions chosen, folder layout
(`src/lib`, `src/state`, `src/components`), why tests run under Vitest
rather than `bun test` (Vite-native config, jsdom environment), and
verification (dev server screenshot, passing empty test run).

## Phase 2 — Core ledger operations (+ tests)

**Goal:** The ledger's state and operations, proven as they land.
(`requirements.md` → "How It Works", "Core Module")

**Scope:** `src/lib/waitingList.ts` + `waitingList.test.ts`
- Types: `Area` union, `Creator`, the counters state
- `create(capacity)`, `add(creators)`, `take(n)`, `total()`
- Input validation (reject negative / non-integer)
- **Unit tests, same PR:** the spec's example flow step by step; add 0 /
  take 0, take > total, take from empty, capacity 1, invalid inputs;
  large-input sanity check (add 100k / take 99k)

**Est. size:** ~90 lines module + ~100 lines tests.

**PR:** `Phase 2: core ledger operations with unit tests`
Description covers: the always-full-middle-cohorts invariant, the
O(1)/O(m) cost table, validation policy, test inventory mapped to the
Edge Cases section.

## Phase 3 — Cohort derivations (+ tests)

**Goal:** Everything the views will read, still no UI.

**Scope:** `src/lib/waitingList.ts` (extended) + tests
- Derivations: cohort-of-seq, oldest/newest cohort, per-cohort counts,
  slice ranges for waiting view / take preview / onboarding view
- **Unit tests, same PR:** counts and ranges across boundaries, emptied
  cohorts disappearing as `head` crosses a boundary, the `[2, 4, 2]`
  picture from requirements.md reproduced as assertions

**Est. size:** ~50 lines module + ~80 lines tests.

**PR:** `Phase 3: cohort derivations with unit tests`
Description covers: why cohorts are derived not stored, how each view
maps to a slice range, boundary-crossing test cases.

## Phase 4 — Cypress setup and CI gate

**Goal:** Cypress wired up, and a CI pipeline that blocks merging unless
all tests pass. (`requirements.md` → "E2E Tests & CI")

**Scope:**
- Cypress installed and configured against the Vite dev server
- One smoke E2E test (app loads, create a list, add a creator)
- GitHub Actions workflow: on every PR, run unit tests (Vitest) and the
  Cypress suite — both jobs install with Bun (`oven-sh/setup-bun` +
  `bun install`) and run scripts via `bun run`
- Branch protection on `main`: both jobs are required status checks —
  a PR cannot merge unless unit tests **and** E2E tests pass

**Est. size:** ~120 lines (config + workflow + smoke test).

**Sequencing note:** this phase lands right after the core logic
(Phases 2–3) and before any UI, so the merge gate protects every UI
phase's PR and each of Phases 6–10 extends the suite it sets up (see the
**E2E:** line in each phase's scope). Nothing in it depends on Phases 5–11,
which is why it slots here. It was requested after the original plan (so
it would have been Phase 11 under the append rule) but has been
re-sequenced into execution order — see the documented exception in the
process rules.

**PR:** `Phase 4: Cypress setup and CI merge gate`
Description covers: workflow structure (unit job + E2E job), how the dev
server/build is served in CI, required-checks configuration, and a link to
a sample failing run proving the gate blocks.

## Phase 5 — Reducer and app state

**Goal:** React state wiring, still minimal UI. (`requirements.md` →
"React State")

**Scope:** `src/state/`
- Reducer with `reset` / `add` / `take` actions over the counters +
  last-taken range
- Ledger held in a stable buffer alongside the reducer
- Root `App` renders raw state (counters + total) to prove wiring
- **Unit tests, same PR:** reducer actions (reset/add/take) including
  last-taken range bookkeeping

**Est. size:** ~80 lines + ~40 lines tests.

**PR:** `Phase 5: reducer and app state`
Description covers: why state is scalars only, one-dispatch-per-batch,
why the modal needs no action of its own.

## Phase 6 — Forms and summary UI

**Goal:** Interactive create / add / take (no modal yet), with totals.

**Scope:** `src/components/`
- `CreateForm` (capacity, default 10, positive-integer validation)
- `AddForm` (name + area dropdown, batch queue, blocks empty names)
- `TakeForm` (number input; direct take this phase, modal comes in
  Phase 8)
- `Summary` (total waiting, cohort count)
- Tailwind layout for the page
- **Unit tests, same PR:** form validation helpers (capacity, name, count
  parsing) — the only new logic; the forms themselves stay thin
- **E2E:** create a list, add creators (single + batch), total updates,
  direct take updates the total; invalid capacity and empty names rejected

**Est. size:** ~150 lines + ~30 lines unit tests + ~60 lines E2E.

**PR:** `Phase 6: create/add/take forms and summary`
Description covers: validation behavior per form, batch-add UX choice,
known temporary state (take without confirmation), new E2E coverage.

## Phase 7 — Cohort visualization

**Goal:** The `[6, 10]`-style view. (`requirements.md` → "Components" →
CohortList)

**Scope:**
- `CohortList`: newest cohort, collapsed "10 ×N full" middle chip, oldest
  cohort marked "next to be served", newest-left ordering
- `CohortRow`: count + fill state, expandable to list creators (seq-range
  read), keyed by cohort number
- **E2E:** the spec's full example flow through the UI (add 3 → add 13 →
  add 22 → take 4 → take 7 → take 20), asserting the cohort view and
  total at each step; cohort expansion shows the right creators

**Est. size:** ~120 lines + ~50 lines E2E.

**PR:** `Phase 7: cohort visualization`
Description covers: why the middle collapses to one chip (constant DOM),
key stability, how expansion reads the ledger, spec flow now asserted
end to end.

## Phase 8 — Take confirmation modal

**Goal:** Two-step take. (`requirements.md` → "Web Component",
`TakeConfirmModal`)

**Scope:**
- `TakeConfirmModal`: previews who would be taken (oldest first, "+k more"
  cap), Confirm dispatches, Cancel closes with no state change
- `TakeForm` switches from direct take to opening the modal
- **E2E:** modal preview lists the oldest creators; confirm removes them;
  cancel leaves the list untouched; take button disabled when empty;
  taking more than total previews only what's there. Update Phase 6/7
  take tests to go through the modal.

**Est. size:** ~100 lines + ~60 lines E2E (including updated older tests).

**PR:** `Phase 8: take confirmation modal`
Description covers: preview as a pure read at `head`, cancel as a no-op,
the display cap for huge takes, which existing E2E tests changed and why.

## Phase 9 — Onboarding view

**Goal:** Second view for taken creators. (`requirements.md` →
`OnboardingView`)

**Scope:**
- Tab navigation between Waiting list and Onboarding views
- `OnboardingView`: all creators below `head` in served order, paginated/
  windowed, most recent take highlighted via the last-taken range
- **E2E:** confirmed creators appear in the Onboarding view in served
  order with the latest take highlighted; waiting view no longer shows
  them; tab switching preserves both views

**Est. size:** ~120 lines + ~40 lines E2E.

**PR:** `Phase 9: onboarding view`
Description covers: one ledger backing both views (`head` as the
boundary), why served order is free, pagination approach, new E2E
coverage.

## Phase 10 — IndexedDB persistence

**Goal:** State survives reload. (`requirements.md` → "Persistence")

**Scope:** `src/persistence/`
- Two stores (`creators`, `meta`) per the schema in requirements.md
- Write-behind: add → records + meta in one transaction; take → meta only
- Hydration on startup with loading state; validation + discard of
  corrupt/old-schema data
- Graceful in-memory fallback when IndexedDB is unavailable, with notice
- Reset clears both stores
- **Unit tests, same PR:** persistence module against a fake IndexedDB
  (e.g. `fake-indexeddb`): write/read round-trip, hydration validation,
  corrupt/old-schema discard, unavailable-database fallback
- **E2E:** add and take, reload the page, both views survive; reset clears
  everything including after a reload

**Est. size:** ~150 lines + ~60 lines unit tests + ~40 lines E2E. If that
exceeds the soft limit in practice, split: 10a module + unit tests,
10b hydration/wiring + E2E.

**PR:** `Phase 10: IndexedDB persistence`
Description covers: two-store layout vs snapshot (O(1) takes), transaction
scope per action, schemaVersion policy, failure handling, why taken
records are kept (onboarding history).

## Phase 11 — README and writeup

**Goal:** Submission-ready documentation.

**Scope:** `README.md`
- Run/test instructions
- Edge cases and how they're handled
- Business-logic decisions (from requirements.md "Decisions to Document")
- Performance/structure notes (ledger design, O(1) take)
- AI collaboration section: where AI helped, where it was overridden, one
  wrong/sloppy AI moment and what was done instead, what was written by
  hand and why

**Est. size:** ~120 lines of prose.

**PR:** `Phase 11: README and writeup`
Description covers: summary of the writeup contents and a final checklist
against the take-home's grading criteria.

---

## Future phases

Every change requested after this plan was written gets appended here as
Phase 12, 13, … with the same structure (goal, scope, est. size, PR), and
ships as its own PR.
