// IndexedDB (Phase 9 persistence) is not cleared between tests the way Cypress
// clears localStorage, so the waiting list would leak from one test into the
// next. Override cy.visit to delete the database before each page load, so every
// test starts from a clean slate. Reload-survival tests use cy.reload(), which
// keeps IndexedDB intact within a single test.

import 'cypress-axe' // Phase 10: cy.injectAxe / cy.checkA11y for WCAG 2.2 checks

const DB_NAME = 'elective-waiting-list'

Cypress.Commands.overwrite('visit', (originalFn, url, options) => {
  const opts = (options ?? {}) as Partial<Cypress.VisitOptions>
  return originalFn(url as string, {
    ...opts,
    onBeforeLoad(win) {
      win.indexedDB.deleteDatabase(DB_NAME)
      opts.onBeforeLoad?.(win)
    },
  })
})
