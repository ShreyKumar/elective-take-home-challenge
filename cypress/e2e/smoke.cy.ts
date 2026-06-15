// Smoke test: proves the Cypress pipeline runs against the built app. The app
// is still the Phase 1 scaffold (a title only), so this asserts the page loads
// and renders its heading. Real user-flow E2E (create / add / take / onboard)
// arrives with the UI in Phases 6–9.
describe('app smoke test', () => {
  it('loads and renders the heading', () => {
    cy.visit('/')
    cy.get('h1').should('contain.text', 'Cohort Waiting List')
  })
})
