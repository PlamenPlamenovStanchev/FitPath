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

## Main CI

The main `CI` workflow runs on every push and pull request. It runs linting,
type checking, unit tests, and a production build after `npm ci`. It does not
start FitPath services and requires no Neon, Clerk, R2, database, or other
application secrets.

## Full E2E workflow

The separate `Full E2E` workflow is manual-only (`workflow_dispatch`). It
starts the client and API, then uses the dedicated Clerk, Neon, R2, and seeded
test environment to verify complete authenticated user flows.

Configure these GitHub Actions secrets before manually running Full E2E:

```text
TEST_DATABASE_URL
TEST_CLERK_PUBLISHABLE_KEY
TEST_CLERK_SECRET_KEY
TEST_R2_ACCOUNT_ID
TEST_R2_ACCESS_KEY_ID
TEST_R2_SECRET_ACCESS_KEY
TEST_R2_BUCKET_NAME
TEST_R2_ENDPOINT
CYPRESS_USER_EMAIL
CYPRESS_USER_PASSWORD
CYPRESS_INCOMPLETE_USER_EMAIL
CYPRESS_INCOMPLETE_USER_PASSWORD
CYPRESS_TRAINER_EMAIL
CYPRESS_TRAINER_PASSWORD
CYPRESS_ADMIN_EMAIL
CYPRESS_ADMIN_PASSWORD
CYPRESS_ASSIGNED_CLIENT_CLERK_USER_ID
CYPRESS_PENDING_TRAINER_APPLICATION_ID
CYPRESS_UNRELATED_PLAN_ID
```

Neither workflow runs database migrations or destructive resets. Prepare the
test database and pending trainer application through a separate,
test-environment-only reset process before the manual E2E workflow runs.
Cypress videos, screenshots, and the service log are uploaded only if E2E
fails.
