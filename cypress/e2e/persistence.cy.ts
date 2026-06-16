// E2E for Phase 9 persistence: the waiting list is mirrored to IndexedDB, so it
// survives a page reload. cy.reload() keeps IndexedDB intact within a test; the
// cy.visit override in support/e2e.ts clears it between tests, so each test
// starts clean.
//
// The DOM assertions (e.g. data-cy=total) are driven synchronously by the
// reducer dispatch, so they do NOT prove the fire-and-forget IndexedDB write has
// flushed. settlePersisted() polls the persisted meta record and is called
// before each reload, so the reload-survival assertions are deterministic.

const DB_NAME = 'elective-waiting-list'

function addCreator(name: string, area = 'Design') {
  cy.get('[data-cy=name-input]').clear().type(name)
  cy.get('[data-cy=area-select]').select(area)
  cy.get('[data-cy=add-btn]').click()
}

/** Wait until IndexedDB has committed the expected head/next (write-behind settled). */
function settlePersisted(head: number, next: number) {
  cy.window({ log: false }).then(
    (win) =>
      new Cypress.Promise<void>((resolve) => {
        const poll = () => {
          const open = win.indexedDB.open(DB_NAME)
          open.onsuccess = () => {
            const database = open.result
            const req = database.transaction('meta', 'readonly').objectStore('meta').get('current')
            req.onsuccess = () => {
              const meta = req.result
              database.close()
              if (meta && meta.head === head && meta.next === next) resolve()
              else setTimeout(poll, 20)
            }
          }
        }
        poll()
      }),
  )
}

describe('persistence (IndexedDB)', () => {
  beforeEach(() => cy.visit('/'))

  it('a fresh visit starts empty (the database was cleared)', () => {
    cy.get('[data-cy=total]').should('have.text', '0')
    cy.get('[data-cy=cohort-empty]').should('be.visible')
  })

  it('survives a reload after add and take', () => {
    addCreator('Ada', 'Design') // seq 0
    addCreator('Grace', 'Development') // seq 1
    addCreator('Linus', 'Writing') // seq 2
    cy.get('[data-cy=total]').should('have.text', '3')

    cy.get('[data-cy=take-input]').clear().type('1')
    cy.get('[data-cy=take-btn]').click()
    cy.get('[data-cy=total]').should('have.text', '2') // Ada taken

    settlePersisted(1, 3) // head=1 (Ada served), next=3 — write-behind committed
    cy.reload()

    // State restored from IndexedDB: counts intact, and the remaining waiting
    // creators are exactly Grace + Linus (Ada was served before the reload).
    cy.get('[data-cy=total]').should('have.text', '2')
    cy.get('[data-cy=cohort-count]').should('have.text', '1')
    cy.get('[data-cy=cohort-row][data-cohort="0"]').click()
    cy.get('[data-cy=cohort-creators]')
      .should('contain.text', 'Grace')
      .and('contain.text', 'Linus')
      .and('not.contain.text', 'Ada')
  })

  it('persists a chosen capacity across a reload', () => {
    cy.get('[data-cy=capacity-input]').clear().type('3')
    cy.get('[data-cy=create-btn]').click()
    for (const name of ['A', 'B', 'C', 'D']) addCreator(name) // [1, 3] at capacity 3
    cy.get('[data-cy=total]').should('have.text', '4')
    cy.get('[data-cy=cohort-count]').should('have.text', '2')

    settlePersisted(0, 4)
    cy.reload()

    cy.get('[data-cy=total]').should('have.text', '4')
    cy.get('[data-cy=cohort-count]').should('have.text', '2')
    cy.contains('Current capacity: 3').should('be.visible')
  })

  it('reset clears everything, even after a reload', () => {
    addCreator('Ada')
    addCreator('Grace')
    cy.get('[data-cy=total]').should('have.text', '2')

    cy.get('[data-cy=capacity-input]').clear().type('10')
    cy.get('[data-cy=create-btn]').click() // reset
    cy.get('[data-cy=total]').should('have.text', '0')
    cy.get('[data-cy=cohort-empty]').should('be.visible')

    settlePersisted(0, 0)
    cy.reload()

    cy.get('[data-cy=total]').should('have.text', '0') // stays empty
    cy.get('[data-cy=cohort-empty]').should('be.visible')
  })

  it('runs in memory with a warning when IndexedDB is unavailable', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // Simulate a browser without IndexedDB (e.g. some private-browsing modes).
        Object.defineProperty(win, 'indexedDB', { configurable: true, value: undefined })
      },
    })
    cy.get('[data-cy=persistence-warning]').should('be.visible')

    addCreator('Ada') // the app still works in memory
    cy.get('[data-cy=total]').should('have.text', '1')

    cy.reload() // IndexedDB is back on reload; the in-memory add was never saved
    cy.get('[data-cy=total]').should('have.text', '0')
  })
})
