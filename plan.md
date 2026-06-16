# Implementation Plan — Cohort Waiting List

Source of truth: `requirements.md`. The work is split into small phases,
each targeting ~150 changed lines or fewer (soft limit). Every phase ends
with a PR against `main` with a detailed description. Phases build on each
other in order; the app is runnable after every phase.

## Process rules

- One branch per phase (`phase-1-scaffold`, `phase-2-core`, …), one PR per
  phase, merged before the next phase starts.
- **Phases are numbered in execution order** — Phase N is built and merged
  before Phase N+1, and the plan lists them in that order.
- **The README / writeup is always the last phase.** It documents the finished
  app, so it runs after everything else. A change requested later is added as a
  new phase **immediately before the README**, and the README is renumbered to
  stay last — so the numbers always match the execution order.
- **Authorship:** commits are authored by Claude Code
  (`Claude Code <noreply@anthropic.com>` via `git commit --author`),
  with the human as committer. PRs are opened with whatever GitHub
  credential is configured; GitHub shows that account as the PR opener
  (see the AI-collaboration writeup for attribution).
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
- **Changes recorded after the original plan** (kept here so nothing is folded
  in silently):
  - **Cypress + CI gate** was requested after the original plan and re-sequenced
    early (Phase 4) because the merge gate is a prerequisite for every UI phase's
    E2E.
  - **Component performance tests, the WCAG 2.2 accessibility pass, and the
    test-suite consolidation** were each requested after the original plan and
    slotted into their execution-order positions below.
  - **The Take confirmation modal was removed entirely** — taking is a direct
    one-step action (see `requirements.md` → "Web Component", "Edge Cases"); no
    `TakeConfirmModal` ships.
  - **The app must conform to WCAG 2.2 Level AA** throughout (see
    `requirements.md` → "Accessibility"); see Phase 11.
  - **The phases were then renumbered into execution order** so the numbers match
    the order of work and the README is last.

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
(Phases 2–3) and before any UI, so the merge gate protects every UI phase's PR
and each later UI phase extends the suite it sets up (see the **E2E:** line in
each phase's scope). It was requested after the original plan but re-sequenced
into this early execution slot because the gate is a prerequisite for the E2E
tests the UI phases write (recorded in the process rules).

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
Description covers: why state is scalars only, one-dispatch-per-batch, and why
the ledger lives in a stable buffer beside the reducer rather than in state.

## Phase 6 — Forms and summary UI

**Goal:** Interactive create / add / take, with totals.

**Scope:** `src/components/`
- `CreateForm` (capacity, default 10, positive-integer validation)
- `AddForm` (name + area dropdown, batch queue, blocks empty names)
- `TakeForm` (number input; direct one-step take)
- `Summary` (total waiting, cohort count)
- Tailwind layout for the page
- **Unit tests, same PR:** form validation helpers (capacity, name, count
  parsing) — the only new logic; the forms themselves stay thin
- **E2E:** create a list, add creators (single + batch), total updates,
  direct take updates the total; invalid capacity and empty names rejected

**Est. size:** ~150 lines + ~30 lines unit tests + ~60 lines E2E.

**PR:** `Phase 6: create/add/take forms and summary`
Description covers: validation behavior per form, batch-add UX choice,
direct one-step take, new E2E coverage.

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

## Phase 8 — Onboarding view

**Goal:** Second view for taken creators. (`requirements.md` →
`OnboardingView`)

**Scope:**
- Tab navigation between Waiting list and Onboarding views
- `OnboardingView`: all creators below `head` in served order, paginated/
  windowed, most recent take highlighted via the last-taken range
- **E2E:** taken creators appear in the Onboarding view in served order with
  the latest take highlighted; waiting view no longer shows them; tab switching
  preserves both views

**Est. size:** ~120 lines + ~40 lines E2E.

**PR:** `Phase 8: onboarding view`
Description covers: one ledger backing both views (`head` as the
boundary), why served order is free, pagination approach, new E2E
coverage.

## Phase 9 — Component performance tests

**Goal:** Prove the rendering-performance properties from `requirements.md`
hold at the component / E2E level — as **structural DOM-bound assertions**,
not wall-clock timing. (`requirements.md` → "Core Module & Unit Tests",
component-level **Performance** bullet)

**Scope:**
- `CohortList`: load a large list (e.g. add 100k creators across many
  cohorts) and assert the rendered cohort rows stay **bounded** — newest
  cohort + one collapsed "×N full" chip + oldest — regardless of cohort
  count. Proves constant DOM.
- `OnboardingView`: take a large number, then assert only the windowed page
  of rows is in the DOM, not every served creator. Proves windowing.
- A coarse responsiveness check: a large batch add completes without the
  interaction timing out — kept structural/coarse, with no tight millisecond
  budget (wall-clock timing is flaky in a browser).
- These extend the **Cypress** E2E suite from Phase 4 and run in the same CI
  gate. No timing assertions land in the unit suite — the core's O(1)/O(m)
  costs are guaranteed by construction, not measured.

**Est. size:** ~70 lines E2E.

**Sequencing note:** runs right after the Onboarding view (Phase 8) — once every
component exists (`CohortList` in Phase 7, `OnboardingView` in Phase 8) — and
before persistence (Phase 10), since these tests target rendering only and don't
depend on it.

**PR:** `Phase 9: component performance tests`
Description covers: why performance is verified at the component/E2E level
(rendering only manifests in a real browser), why structural DOM-count
assertions beat flaky wall-clock timing, and the constant-DOM and windowing
properties asserted.

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

## Phase 11 — WCAG 2.2 accessibility pass

**Goal:** Bring the whole app to **WCAG 2.2 Level AA** and prove it.
(`requirements.md` → "Accessibility")

**Scope:**
- Audit every view and control with **axe-core** (`cypress-axe`): the Waiting
  and Onboarding views, all forms, and the cohort/onboarding lists; fix all
  serious / critical violations.
- Concrete fixes across the existing components:
  - programmatic labels on every input; errors in a `role="alert"` live region
  - visible focus styles and a logical, keyboard-operable focus order; the
    view tabs operable by keyboard, with focus never obscured (SC 2.4.11)
  - interactive targets ≥ 24×24 CSS px (SC 2.5.8)
  - text-not-colour for the "next to be served" cohort; AA contrast throughout
    (SC 1.4.3, 1.4.11)
  - `role="status"` / `aria-live` announcements for total and take updates
    (SC 4.1.3)
- **E2E:** add `cypress-axe` checks (`cy.injectAxe` / `cy.checkA11y`) on the
  main views, asserting no serious/critical violations; runs in the same CI gate.

**Est. size:** ~60 lines of a11y fixes across components + ~40 lines E2E (plus
the `cypress-axe` dev dependency).

**Sequencing note:** runs after the UI and persistence phases (6–10), so the
whole app — every view and control, including persistence's loading/fallback
states — is in place to audit, and before the README so the writeup can state
WCAG 2.2 AA conformance.

**PR:** `Phase 11: WCAG 2.2 accessibility pass`
Description covers: the `cypress-axe` setup, the conformance target (2.2 AA), the
specific success criteria addressed (including the 2.2 additions 2.5.8 Target
Size and 2.4.11 Focus Not Obscured), and the new accessibility checks in the gate.

## Phase 12 — Consolidate unit tests to the core module

**Goal:** Make `src/lib/waitingList.test.ts` the single home for unit tests —
remove the thin-wrapper suites and lean on the type system plus the Cypress E2E
gate for everything else. A one-time cleanup, requested after the original plan.

**Scope:**
- Delete `src/state/waitingListReducer.test.ts` (Phase 5) and
  `src/components/validation.test.ts` (Phase 6).
- Keep `src/lib/waitingList.test.ts` — the exhaustive core + derivations
  suite — unchanged. No production code changes.
- This is a **one-time** removal of the two suites that exist today, **not** a
  blanket ban: the Phase 10 persistence module still ships its own unit tests
  (real IndexedDB I/O — corrupt / old-schema discard and the in-memory
  fallback — which requirements.md calls for and E2E can't cover cleanly).
- **Why it's safe:** the reducer is a thin scalar wrapper over the core, and
  requirements.md already designates input-validation rejection as a
  component / E2E concern, not a module one. The reducer's reset/add/take wiring
  and the validation rejections (bad capacity, empty / whitespace-only names)
  are already proven end to end in `cypress/e2e/forms.cy.ts`.
- **Trade-off (documented):** the parser lexical edges pinned in
  `validation.test.ts` (leading zeros, exponents, `1,000`, tab/newline trim) are
  no longer asserted at the unit level; E2E still covers the user-visible
  rejections (`abc` / `0` / `-1` / `1.5`) but not every lexical case. Accepted
  as the cost of a single unit-test home.

**Est. size:** ~95 lines removed across two files; 0 added.

**Sequencing note:** the last test change before the README (Phase 13), so the
writeup documents the final, consolidated suite. It only deletes test files, so
it has no code dependencies and can run any time after Phase 6.

**PR:** `Phase 12: consolidate unit tests to the core module`
Description covers: which suites were removed and why each is redundant
(reducer = thin wrapper proven via E2E; validation = component / E2E concern per
requirements.md), the one-time scope (Phase 10 persistence tests retained), the
parser-edge trade-off, and confirmation that `bun run test` and the Cypress gate
stay green.

## Phase 13 — README and writeup

**Goal:** Submission-ready documentation. The final phase — runs after every
other phase so the writeup documents the finished app.

**Scope:** `README.md`
- Run/test instructions
- Edge cases and how they're handled
- Business-logic decisions (from requirements.md "Decisions to Document")
- Performance/structure notes (ledger design, O(1) take)
- Accessibility notes (WCAG 2.2 AA conformance, how it's verified)
- AI collaboration section: where AI helped, where it was overridden, one
  wrong/sloppy AI moment and what was done instead, what was written by
  hand and why

**Est. size:** ~120 lines of prose.

**PR:** `Phase 13: README and writeup`
Description covers: summary of the writeup contents and a final checklist
against the take-home's grading criteria.

---

## Future phases

A change requested after this plan is added as a new phase **immediately before
the README**, and the README is renumbered to stay last — same structure
(goal, scope, est. size, PR), shipped as its own PR.
