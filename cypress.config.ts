import { defineConfig } from 'cypress'

// E2E runs against the Vite dev server (default port 5173). The suite is built
// incrementally: this phase ships only a smoke test; the UI phases (6–9) and
// the performance phase (11) extend it.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
    fixturesFolder: false,
  },
})
