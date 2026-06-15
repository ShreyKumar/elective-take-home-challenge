// Smoke test: proves the Cypress pipeline runs against the built app — the page
// loads and renders its heading. The real user-flow E2E lives in the per-feature
// specs (forms.cy.ts from Phase 6 onward); this stays a minimal liveness check.
describe('app smoke test', () => {
  it('loads and renders the heading', () => {
    cy.visit('/')
    cy.get('h1').should('contain.text', 'Cohort Waiting List')
  })
})
