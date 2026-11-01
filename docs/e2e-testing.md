# FitPath E2E testing

The Cypress suite runs only against a dedicated Clerk development instance and dedicated test database/R2 bucket. Never run it against production data or commit `cypress.env.json`.

## Test data

Create password-authenticated Clerk test users and reset their dedicated FitPath database data before every run:

- `user`: onboarded USER, assigned to `trainer`;
- `incompleteUser`: USER with incomplete onboarding;
- `trainer`: TRAINER actively assigned to `user`;
- `admin`: ADMIN;
- a fresh PENDING trainer application; and
- a plan owned by a client not assigned to `trainer`.

The approval test changes the pending application, so the reset must create a new one each run.

## Required configuration

Copy `cypress.env.example.json` to the ignored `cypress.env.json`, then replace every placeholder. It supplies the four dedicated test-account credentials, the assigned client Clerk ID, pending-application UUID, and unrelated-plan UUID.

Provide these only from a shell or CI secret store:

```text
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

Start the client with `VITE_CLERK_PUBLISHABLE_KEY` and the API with its normal test-only environment configuration. Do not commit passwords, Clerk secret keys, database URLs, or R2 credentials.

## Run headlessly

With the client and API already running against the test environment:

```bash
npm run e2e:run -- --spec cypress/e2e/critical-workflows.cy.ts
```

The suite uses Clerk's supported `@clerk/testing` integration and `cy.clerkSignIn()` command; it does not automate or assert Clerk internals.
