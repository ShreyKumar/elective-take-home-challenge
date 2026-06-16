// Phase 10 — WCAG 2.2 AA checks. axe-core (cypress-axe) covers the
// machine-checkable criteria (contrast, names, roles, landmarks); checkA11y is
// configured to fail on axe violations at ANY impact level across the app's
// states (empty, with creators + an expanded cohort, the windowed/paginated
// list, validation errors, and the no-IndexedDB fallback). The 2.2-specific
// behaviors axe cannot verify — the SC 4.1.3 live region, the disclosure's
// aria-controls/aria-expanded, and focus staying on the trigger after expand
// (SC 2.4.11) — are asserted structurally below.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

function checkA11y() {
  cy.injectAxe()
  cy.checkA11y(undefined, { runOnly: { type: 'tag', values: WCAG_TAGS } })
}

function addCreator(name: string, area = 'Design') {
  cy.get('[data-cy=name-input]').clear().type(name)
  cy.get('[data-cy=area-select]').select(area)
  cy.get('[data-cy=add-btn]').click()
}

describe('accessibility (WCAG 2.2 AA)', () => {
  beforeEach(() => cy.visit('/'))

  it('has no violations in the empty state', () => {
    checkA11y()
  })

  it('has no violations with creators and an expanded cohort', () => {
    addCreator('Ada', 'Design')
    addCreator('Grace', 'Development')

    // SC 4.1.3 Status Messages: the summary is a polite live region (axe can't verify).
    cy.get('section[aria-label="Summary"]').should('have.attr', 'aria-live', 'polite')

    // Expanding keeps focus on the trigger (SC 2.4.11 — the revealed panel must
    // not move/obscure focus), aria-expanded flips, and aria-controls resolves to
    // the now-visible panel. None of these are machine-checkable by axe.
    cy.get('[data-cy=cohort-row][data-cohort="0"]').click().should('have.focus')
    cy.get('[data-cy=cohort-row][data-cohort="0"]')
      .should('have.attr', 'aria-expanded', 'true')
      .invoke('attr', 'aria-controls')
      .then((id) => {
        expect(id, 'aria-controls is set when expanded').to.be.a('string').and.not.be.empty
        cy.get(`#${id}`).should('be.visible')
      })

    checkA11y()
  })

  it('has no violations in the windowed (paginated) cohort list', () => {
    cy.get('[data-cy=capacity-input]').clear().type('1')
    cy.get('[data-cy=create-btn]').click()
    for (let i = 0; i < 15; i++) cy.get('[data-cy=name-input]').type(`W${i}{enter}`)
    cy.get('[data-cy=cohort-page-info]').should('be.visible')
    checkA11y()
  })

  it('has no violations with validation errors showing', () => {
    cy.get('[data-cy=capacity-input]').clear().type('0')
    cy.get('[data-cy=create-btn]').click()
    cy.get('[data-cy=capacity-error]').should('be.visible')
    cy.get('[data-cy=name-input]').clear()
    cy.get('[data-cy=add-btn]').click()
    cy.get('[data-cy=name-error]').should('be.visible')
    checkA11y()
  })

  it('has no violations in the memory-mode (no-IndexedDB) fallback', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // Simulate a browser without IndexedDB so the memory-mode notice renders.
        Object.defineProperty(win, 'indexedDB', { configurable: true, value: undefined })
      },
    })
    cy.get('[data-cy=persistence-warning]')
      .should('be.visible')
      .and('have.attr', 'role', 'status') // the notice is a status message, not an alert
    checkA11y()
  })
})
