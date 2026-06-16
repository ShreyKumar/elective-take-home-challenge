// E2E for the Phase 6 forms: create/reset, add, direct take, and the two
// UI-level rejections (invalid capacity, empty name). The cohort visualization
// has its own spec (cohorts.cy.ts); here we assert the summary numbers (total
// waiting + cohort count) and the rejections.

/** Add one creator directly via the name + area + "Add creator" flow. */
function addCreator(name: string, area = 'Design') {
  cy.get('[data-cy=name-input]').clear().type(name)
  cy.get('[data-cy=area-select]').select(area)
  cy.get('[data-cy=add-btn]').click()
}

describe('waiting-list forms', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('starts empty with the default capacity and a disabled take', () => {
    cy.get('[data-cy=total]').should('have.text', '0')
    cy.get('[data-cy=cohort-count]').should('have.text', '0')
    cy.get('[data-cy=take-btn]').should('be.disabled')
  })

  it('adds creators and updates the summary (total + cohort count)', () => {
    addCreator('Ada', 'Design')
    addCreator('Grace', 'Development')
    addCreator('Linus', 'Writing')
    cy.get('[data-cy=total]').should('have.text', '3')
    cy.get('[data-cy=cohort-count]').should('have.text', '1') // 3 of 10 — one cohort
  })

  it('takes creators directly and lowers the total', () => {
    for (const name of ['A', 'B', 'C', 'D', 'E']) addCreator(name)
    cy.get('[data-cy=total]').should('have.text', '5')

    cy.get('[data-cy=take-input]').clear().type('2')
    cy.get('[data-cy=take-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '3')

    // Taking more than the total drains the list to empty and disables take.
    cy.get('[data-cy=take-input]').clear().type('99')
    cy.get('[data-cy=take-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '0')
    cy.get('[data-cy=take-btn]').should('be.disabled')
  })

  it('rejects invalid capacity without resetting the list', () => {
    addCreator('Ada')
    addCreator('Grace')
    cy.get('[data-cy=total]').should('have.text', '2')

    for (const bad of ['abc', '0', '-1', '1.5']) {
      cy.get('[data-cy=capacity-input]').clear().type(bad)
      cy.get('[data-cy=create-btn]').click()
      cy.get('[data-cy=capacity-error]').should('be.visible')
      cy.get('[data-cy=total]').should('have.text', '2') // list untouched
    }

    // Recovery: a valid capacity after a rejection clears the error and resets.
    cy.get('[data-cy=capacity-input]').clear().type('5')
    cy.get('[data-cy=create-btn]').click()
    cy.get('[data-cy=capacity-error]').should('not.exist')
    cy.get('[data-cy=total]').should('have.text', '0')
  })

  it('rejects empty and whitespace-only names', () => {
    cy.get('[data-cy=name-input]').clear()
    cy.get('[data-cy=add-btn]').click()
    cy.get('[data-cy=name-error]').should('be.visible')

    cy.get('[data-cy=name-input]').type('   ')
    cy.get('[data-cy=add-btn]').click()
    cy.get('[data-cy=name-error]').should('be.visible')

    // Recovery: a valid name adds immediately and clears the error banner.
    addCreator('Ada')
    cy.get('[data-cy=total]').should('have.text', '1')
    cy.get('[data-cy=name-error]').should('not.exist')
  })

  it('creating with a new capacity resets the list', () => {
    addCreator('Ada')
    addCreator('Grace')
    cy.get('[data-cy=total]').should('have.text', '2')

    cy.get('[data-cy=capacity-input]').clear().type('5')
    cy.get('[data-cy=create-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '0')
    cy.contains('Current capacity: 5').should('be.visible')
  })
})
