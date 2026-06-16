// E2E for the Phase 7 cohort visualization (CohortList / CohortRow): all cohorts
// shown as regular rows, newest on the left, oldest on the right marked "next to
// be served". Drives the spec's full example flow through the UI and asserts the
// cohort view + total at each step, including expansion while head sits mid-cohort
// after a take.

/** Add `count` creators named C{start}..C{start+count-1} through the single-add
 *  form. Seq === arrival order, so names map directly onto cohort seq ranges. */
function addRange(start: number, count: number) {
  for (let i = start; i < start + count; i++) {
    cy.get('[data-cy=name-input]').type(`C${i}{enter}`)
  }
}

function take(n: number) {
  cy.get('[data-cy=take-input]').clear().type(String(n))
  cy.get('[data-cy=take-btn]').click()
}

/** Assert the cohort row for a given cohort number shows the given waiting count. */
function expectRow(cohort: number, count: number) {
  cy.get(`[data-cy=cohort-row][data-cohort="${cohort}"] [data-cy=cohort-row-count]`).should(
    'have.text',
    String(count),
  )
}

describe('cohort visualization', () => {
  beforeEach(() => cy.visit('/'))

  it('shows an empty state until creators are added', () => {
    cy.get('[data-cy=cohort-empty]').should('be.visible')
    cy.get('[data-cy=cohort-row]').should('not.exist')
  })

  it('renders the spec example flow at every step (capacity 10)', () => {
    // [] + 3 -> [3]: one cohort, marked next to be served.
    addRange(0, 3)
    cy.get('[data-cy=total]').should('have.text', '3')
    cy.get('[data-cy=cohort-row]').should('have.length', 1)
    expectRow(0, 3)
    cy.get('[data-cy=cohort-next]').should('be.visible')

    // [3] + 13 -> [6, 10]: newest 6 (cohort 1, filling), oldest 10 (cohort 0, full).
    addRange(3, 13)
    cy.get('[data-cy=total]').should('have.text', '16')
    cy.get('[data-cy=cohort-row]').should('have.length', 2)
    expectRow(1, 6)
    expectRow(0, 10)
    cy.get('[data-cy=cohort-row][data-cohort="1"]').should('contain.text', 'filling')
    cy.get('[data-cy=cohort-row][data-cohort="0"]').should('contain.text', 'full')

    // [6, 10] + 22 -> [8, 10, 10, 10]: 4 cohorts all shown as rows.
    addRange(16, 22)
    cy.get('[data-cy=total]').should('have.text', '38')
    cy.get('[data-cy=cohort-row]').should('have.length', 4)
    expectRow(3, 8)
    expectRow(2, 10)
    expectRow(1, 10)
    expectRow(0, 10)

    // Expansion reads the ledger: newest cohort 3 holds seqs 30..37 -> C30..C37, area defaults to Design.
    cy.get('[data-cy=cohort-row][data-cohort="3"]').click()
    cy.get('[data-cy=cohort-creator]').should('have.length', 8)
    cy.get('[data-cy=cohort-creators]')
      .should('contain.text', '#30') // seq label render
      .and('contain.text', 'C30')
      .and('contain.text', 'C37')
      .and('contain.text', 'Design') // area render
      .and('not.contain.text', 'C29') // C29 is in cohort 2, not cohort 3
    cy.get('[data-cy=cohort-row][data-cohort="3"]').click() // collapse
    cy.get('[data-cy=cohort-creators]').should('not.exist')

    // take 4 -> [8, 10, 10, 6]: oldest (cohort 0) drops to 6, still next to serve.
    take(4)
    cy.get('[data-cy=total]').should('have.text', '34')
    cy.get('[data-cy=cohort-row]').should('have.length', 4)
    expectRow(3, 8)
    expectRow(0, 6)

    // Expand the oldest cohort while head=4 sits mid-cohort 0: the head-clamp in
    // cohortRange must drop the served C0..C3 and list only C4..C9 (seqs 4..9).
    cy.get('[data-cy=cohort-row][data-cohort="0"]').click()
    cy.get('[data-cy=cohort-creator]').should('have.length', 6)
    cy.get('[data-cy=cohort-creators]')
      .should('contain.text', 'C4') // new oldest waiting creator
      .and('contain.text', 'C9')
      .and('not.contain.text', 'C3') // C3 was taken — must not reappear
    cy.get('[data-cy=cohort-row][data-cohort="0"]').click() // collapse

    // take 7 -> [8, 10, 9]: cohort 0 drained away, oldest is now cohort 1 (count 9).
    take(7)
    cy.get('[data-cy=total]').should('have.text', '27')
    cy.get('[data-cy=cohort-row]').should('have.length', 3)
    expectRow(3, 8)
    expectRow(1, 9)
    cy.get('[data-cy=cohort-row][data-cohort="0"]').should('not.exist') // emptied cohort is gone

    // Expanding the now-partial oldest cohort 1 hides the served boundary creator:
    // seq 10 (C10) was served; only seqs 11..19 (C11..C19) remain waiting.
    cy.get('[data-cy=cohort-row][data-cohort="1"]').click()
    cy.get('[data-cy=cohort-creator]').should('have.length', 9)
    cy.get('[data-cy=cohort-creators]')
      .should('not.contain.text', 'C10') // served boundary creator is hidden
      .and('contain.text', 'C11') // oldest still-waiting creator
      .and('contain.text', 'C19')
    cy.get('[data-cy=cohort-row][data-cohort="1"]').click() // collapse

    // take 20 -> [7]: single cohort 3, marked next to be served.
    take(20)
    cy.get('[data-cy=total]').should('have.text', '7')
    cy.get('[data-cy=cohort-row]').should('have.length', 1)
    expectRow(3, 7)
    cy.get('[data-cy=cohort-next]').should('be.visible')
  })

  it('expands the oldest cohort to its served-order creators', () => {
    addRange(0, 12) // [2, 10]: cohort 1 (newest, 2) + cohort 0 (oldest, 10)
    cy.get('[data-cy=cohort-row][data-cohort="0"]').click()
    cy.get('[data-cy=cohort-creator]').should('have.length', 10)
    cy.get('[data-cy=cohort-creators]')
      .should('contain.text', '#0') // seq label render
      .and('contain.text', 'C0') // oldest waiting creator
      .and('contain.text', 'C9')
      .and('not.contain.text', 'C10') // C10 is in cohort 1 (newest), not cohort 0
  })

  it('clears a stale expansion across a reset (no cohort auto-expands)', () => {
    // Open the lone cohort, then reset and re-add: the panel must NOT reopen on
    // its own — expanded state must not survive the list going empty.
    addRange(0, 5)
    cy.get('[data-cy=cohort-row][data-cohort="0"]').click()
    cy.get('[data-cy=cohort-creators]').should('be.visible')

    cy.get('[data-cy=capacity-input]').clear().type('10')
    cy.get('[data-cy=create-btn]').click() // reset -> empty
    cy.get('[data-cy=cohort-empty]').should('be.visible')

    addRange(0, 5) // cohort 0 reappears as the only end
    cy.get('[data-cy=cohort-creators]').should('not.exist') // not auto-expanded
    cy.get('[data-cy=cohort-row][data-cohort="0"]').should('have.attr', 'aria-expanded', 'false')
  })
})
