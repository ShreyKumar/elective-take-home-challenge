// E2E for the Phase 6 forms: create/reset, add (single + batch), direct take,
// and the two UI-level rejections (invalid capacity, empty name). The cohort
// visualization and the take confirmation modal arrive in later phases; here we
// assert the summary numbers (total waiting + cohort count) and the rejections.

/** Stage one creator into the add batch via the name + area + "Add to batch" flow. */
function queueCreator(name: string, area = 'Design') {
  cy.get('[data-cy=name-input]').clear().type(name)
  cy.get('[data-cy=area-select]').select(area)
  cy.get('[data-cy=queue-btn]').click()
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

  it('adds a single creator and updates the summary', () => {
    queueCreator('Ada', 'Design')
    cy.get('[data-cy=queue-item]').should('have.length', 1)
    cy.get('[data-cy=add-btn]').click()

    cy.get('[data-cy=total]').should('have.text', '1')
    cy.get('[data-cy=cohort-count]').should('have.text', '1')
    cy.get('[data-cy=queue-item]').should('not.exist') // queue cleared after add
  })

  it('adds a batch of creators in a single action', () => {
    queueCreator('Ada', 'Design')
    queueCreator('Grace', 'Development')
    queueCreator('Linus', 'Writing')
    cy.get('[data-cy=queue-item]').should('have.length', 3)
    // Each staged item carries its own area through the select onChange -> payload.
    cy.get('[data-cy=queue-item]').eq(0).should('contain.text', 'Ada').and('contain.text', 'Design')
    cy.get('[data-cy=queue-item]').eq(1).should('contain.text', 'Grace').and('contain.text', 'Development')
    cy.get('[data-cy=queue-item]').eq(2).should('contain.text', 'Linus').and('contain.text', 'Writing')
    cy.get('[data-cy=add-btn]').click()

    cy.get('[data-cy=total]').should('have.text', '3')
    cy.get('[data-cy=cohort-count]').should('have.text', '1') // 3 of 10 — one cohort
  })

  it('lets a queued creator be removed before adding', () => {
    queueCreator('Ada')
    queueCreator('Grace')
    cy.get('[data-cy=queue-remove]').first().click()
    cy.get('[data-cy=queue-item]').should('have.length', 1)
    cy.get('[data-cy=add-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '1')
  })

  it('takes creators directly and lowers the total', () => {
    for (const name of ['A', 'B', 'C', 'D', 'E']) queueCreator(name)
    cy.get('[data-cy=add-btn]').click()
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
    queueCreator('Ada')
    queueCreator('Grace')
    cy.get('[data-cy=add-btn]').click()
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
    cy.get('[data-cy=queue-btn]').click()
    cy.get('[data-cy=name-error]').should('be.visible')
    cy.get('[data-cy=queue-item]').should('not.exist')

    cy.get('[data-cy=name-input]').type('   ')
    cy.get('[data-cy=queue-btn]').click()
    cy.get('[data-cy=name-error]').should('be.visible')
    cy.get('[data-cy=queue-item]').should('not.exist')

    // Recovery: a valid name queues and clears the error banner.
    queueCreator('Ada')
    cy.get('[data-cy=queue-item]').should('have.length', 1)
    cy.get('[data-cy=name-error]').should('not.exist')
  })

  it('creating with a new capacity resets the list', () => {
    queueCreator('Ada')
    queueCreator('Grace')
    cy.get('[data-cy=add-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '2')

    cy.get('[data-cy=capacity-input]').clear().type('5')
    cy.get('[data-cy=create-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '0')
    cy.contains('Current capacity: 5').should('be.visible')
  })
})
