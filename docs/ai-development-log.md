# AI-Assisted Development Log

This log records evidence of AI-assisted development for the assignment. Each
entry captures the prompt, generated work, human review, validation, outcome,
and observations needed for the final comparison of AI tools.

## Reusable Entry Template

### Date:

### Development Day:

### Module:

### Task:

### AI Tool:

### Goal:

### Prompt:

```text
[exact important prompt]
```

### Generated Result:

[what the AI created or changed]

### Manual Review / Corrections:

[what a human reviewed, rejected, corrected or improved]

### Validation:

[commands, tests or manual checks performed]

### Outcome:

[PASS / PARTIAL / FAIL and short explanation]

### Lessons / Observations:

[anything useful for the final AI tool comparison]

---

## Day 1 - Project Foundation

### Date:

2026-10-30

### Development Day:

Day 1

### Module:

Project Foundation

### Task:

Create the initial FitPath monorepo structure and development toolchain.

### AI Tool:

Codex

### Goal:

Create a simple, maintainable foundation for the FitPath client and server
without implementing business functionality.

### Prompt:

```text
We are starting a small university project called FitPath.

Technology stack:
- React + TypeScript + Vite
- Tailwind CSS
- Node.js + Express + TypeScript
- PostgreSQL hosted on Neon
- Drizzle ORM
- Clerk authentication
- Cloudflare R2 for object storage
- Cypress for E2E testing
- GitHub Actions

Create a clean monorepo-style project structure with separate client and server applications.

Requirements:
1. Keep the architecture simple and appropriate for a small SPA.
2. Configure TypeScript for both frontend and backend.
3. Configure Tailwind CSS in the React application.
4. Add ESLint and formatting configuration.
5. Add useful npm scripts for dev, build, lint and typecheck.
6. Configure a development command that can run client and server conveniently.
7. Do not implement business functionality yet.
8. Do not add unnecessary libraries, frameworks or abstractions.
9. Never hardcode secrets.
10. Create .env.example with placeholders only.
11. Make sure all real .env files are ignored by Git.

Before modifying files:
- show the proposed folder structure
- explain important architectural decisions
The structure should look something like this:                                                 fitpath/
├── client/
├── server/
├── drizzle/
├── scripts/
├── docs/
├── .github/
│   └── workflows/
├── .env.example
├── .gitignore
├── README.md
└── package.json

After implementation:
- list created files
- list installation commands
- list commands required to start FitPath locally
- run lint, typecheck and build and report any failures .
```

### Generated Result:

- Created monorepo-style npm workspaces for `client` and `server`.
- Created a React, Vite, and TypeScript client.
- Created an Express and TypeScript server with a minimal health endpoint.
- Configured Tailwind CSS for the client.
- Added repository-wide ESLint and Prettier configuration.
- Prepared the `drizzle/` migration directory, an empty schema file, and Drizzle
  configuration without creating application tables.
- Added `.env.example` with placeholder values and Git ignore rules for real
  environment files.
- Added root and workspace scripts for development, builds, linting, and
  TypeScript checks.
- Added Cypress configuration and a GitHub Actions validation workflow.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run dev` started both the Vite client and Express server successfully.
- The client returned HTTP 200 at `http://localhost:5173`.
- The API health endpoint returned `status: "ok"` at
  `http://localhost:3000/health`.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed for both workspaces.

### Outcome:

**PASS** — development startup, lint, TypeScript typecheck, and the production
build all completed successfully.

### Lessons / Observations:

- The deprecated `@clerk/clerk-react` package was replaced during setup with
  the supported `@clerk/react` package.
- Dependency installation encountered a temporary Windows lock on
  `esbuild.exe`; a clean retry completed successfully.
- The first Vite build attempt was blocked by the restricted execution
  environment while inspecting parent path metadata. The same build passed
  when run with the required filesystem permission.

---

## Day 1 - Authentication and Authorization

### Date:

2026-10-30

### Development Day:

Day 1

### Module:

Authentication and Authorization

### Task:

Clerk authentication and local user synchronization.

### AI Tool:

Codex

### Goal:

Authenticate users with Clerk and safely synchronize verified Clerk identities
to existing FitPath users without changing the database schema.

### Prompt:

Implement Clerk authentication in the React SPA and Express API, add protected
`/api/me` synchronization using the existing unique `clerk_user_id` constraint,
prepare server-side role authorization, and keep Clerk identity data separate
from FitPath application data.

### Generated Result:

- Added Clerk provider, sign-in/sign-up routes, a public landing page, and a
  protected application shell with a Clerk account control.
- Added an in-memory authenticated API helper using Clerk's supported session
  token API; tokens are not stored in browser storage.
- Added Clerk Express middleware, reusable authenticated-request and role
  authorization helpers, and `GET /api/me`.
- Implemented race-safe local user creation with `ON CONFLICT DO NOTHING` and
  lookup by the verified Clerk user ID.
- Configured Vite to load browser-safe environment variables from the root
  `.env` file and documented the optional browser API origin.
- Added `react-router-dom` for the requested SPA routes.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — the requested authentication, local synchronization, and role
authorization preparation were implemented without creating or changing a
database migration.

### Lessons / Observations:

Clerk remains the source of truth for identity and sessions, while PostgreSQL
stores only FitPath-specific user data.

---

## Day 1 - User Profile / Onboarding

### Date:

2026-10-30

### Development Day:

Day 1

### Module:

User Profile / Onboarding

### Task:

First-login onboarding wizard.

### AI Tool:

Codex

### Goal:

Require a new authenticated FitPath user to provide their personal details,
activity level, and fitness goal before accessing the dashboard, while keeping
the persisted onboarding status authoritative.

### Generated Result:

- Added authenticated `PUT /api/me/onboarding` validation and profile upsert.
- Updated `GET /api/me` to include the current profile when present.
- Added a responsive three-step React onboarding wizard and persisted-state
  routing from the authenticated application shell.
- Used an atomic database transaction to save the profile and complete
  onboarding together.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — the API and frontend compile and build successfully. Live Clerk and
Neon verification remains a manual environment-dependent check.

### Lessons / Observations:

The existing unique `profiles.user_id` constraint makes the onboarding write a
safe upsert without a schema change.

---

## Day 1 - BMI Calculator

### Date:

2026-10-30

### Development Day:

Day 1

### Module:

User Profile / Dashboard

### Task:

Informational BMI calculator.

### AI Tool:

Codex

### Goal:

Provide an informational dashboard BMI calculation using the authenticated
user's stored height and current weight without changing profile data.

### Generated Result:

- Added a reusable BMI calculation utility that validates finite positive
  inputs and rounds to one decimal place.
- Added a dashboard BMI card with temporary, editable height and weight
  values initialized from the user profile.
- Added focused unit tests using Node's built-in test runner.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run test:unit` passed (5 tests).
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — the informational BMI calculator, focused tests, and production
build completed successfully.

### Lessons / Observations:

The calculator deliberately remains local UI state; it does not write profile
or progress data.

---

## Day 1 - Authenticated User Dashboard

### Date:

2026-10-30

### Development Day:

Day 1

### Module:

Authenticated User Dashboard

### Task:

Finish the Day 1 authenticated USER dashboard shell.

### AI Tool:

Codex

### Goal:

Create a responsive dashboard shell using the existing authenticated user,
completed profile, and BMI calculator data without adding Day 2 functionality.

### Generated Result:

- Added an authenticated header with FitPath branding, Clerk account control,
  and navigation.
- Added working Dashboard and Profile views with user-friendly enum labels.
- Added placeholder states for My Plans, My Coach, and Progress.
- Displayed profile summary values, current BMI, and the existing BMI card on
  the dashboard.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — the Day 1 dashboard shell builds successfully without adding
training-plan, coach, or progress functionality.

### Lessons / Observations:

The profile data returned by the existing authenticated endpoint is sufficient
for the Day 1 dashboard; no backend API changes were needed.

---

## Day 2 - Object Storage

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Object Storage

### Task:

Cloudflare R2 integration

### AI Tool:

Codex

### Goal:

Add a private, server-side Cloudflare R2 storage service for future avatar and
trainer-certificate uploads, with generated object keys and a cleanup-safe
connectivity verification command.

### Generated Result:

- Added server-only R2 environment validation and an S3-compatible R2 client.
- Added reusable upload, retrieve, and delete operations that work with private
  object keys and Buffer content.
- Added server-side generated keys and 5 MB MIME-type validation policies for
  avatars and trainer certificates.
- Added a development-only connectivity command that uploads, reads, verifies,
  deletes, and confirms removal of a generated `_test` object.
- Updated the environment template to document the private R2 endpoint without
  a public bucket URL.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- R2 connectivity verification passed: upload, read, delete, and post-delete
  absence check.

### Outcome:

**PASS** — private R2 storage utilities and connectivity verification completed
without adding HTTP upload routes, public URLs, or database migrations.

### Lessons / Observations:

R2 object keys are generated only on the server and stored as private bucket
keys, allowing future backend authorization before downloads.

---

## Day 2 - Trainer Application Flow

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Trainer Applications

### Task:

Authenticated trainer application submission and status display.

### AI Tool:

Codex

### Goal:

Allow authenticated FitPath users to submit a specialization, biography, and
private PDF certificate for trainer review without implementing approval.

### Generated Result:

- Added authenticated USER-only endpoints to create a trainer application and
  retrieve the caller's most recent application status.
- Added backend multipart validation for one PDF certificate no larger than
  5 MB, including a PDF file signature check.
- Uploaded validated certificates with server-generated private R2 keys and
  persisted only the key in `trainer_applications`.
- Added cleanup when database insertion fails after an R2 upload and relied on
  the existing partial unique database index to prevent concurrent pending
  submissions.
- Added an authenticated Become a Trainer page with client-side guidance,
  status display, and disabled resubmission while pending.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — trainer application submission and status display are implemented
without exposing certificates, raw object keys, or approval functionality.

### Lessons / Observations:

The backend remains authoritative for the local FitPath user, role, file
validation, R2 key generation, and pending-application constraint.

---

## Day 2 - Trainer Application Administration

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Trainer Applications

### Task:

ADMIN review of trainer applications.

### AI Tool:

Codex

### Goal:

Allow ADMIN users to review pending trainer applications, download private
certificates through the backend, and approve or reject applications safely.

### Generated Result:

- Added ADMIN-only list, certificate download, approval, and rejection API
  endpoints protected by Clerk authentication and the local FitPath role.
- Implemented approval as one atomic PostgreSQL CTE statement that gates on a
  pending application, creates one trainer profile, changes the user role to
  TRAINER, and records the approval reviewer and timestamps.
- Implemented rejection as a conditional pending-to-rejected update while
  leaving the applicant role unchanged.
- Added an ADMIN-only dashboard page to review pending applications, download
  certificates through the authorized endpoint, and approve or reject them.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — ADMIN review functionality is implemented without public R2 access
or client-supplied authorization data.

### Lessons / Observations:

The approval query only returns a row when every required state transition is
valid, so repeated or concurrent approval attempts leave the application state
unchanged after the first success.

---

## Day 2 - Trainer Discovery and Assignment

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Trainer Assignments

### Task:

Trainer discovery, client assignment, and active-client list.

### AI Tool:

Codex

### Goal:

Allow users to discover approved trainers, select or replace an active trainer,
and allow trainers to view their currently assigned clients.

### Generated Result:

- Added authenticated trainer discovery that returns only users with a
  trainer profile and TRAINER role.
- Added authorized backend delivery for private trainer profile photos without
  exposing R2 URLs or credentials.
- Added USER-only assignment and current-trainer endpoints with an atomic
  replacement statement that preserves inactive assignment history.
- Added a TRAINER-only active client list endpoint.
- Added My Coach discovery and selection UI for users and My Clients UI for
  trainers.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — trainer selection and active-client discovery are implemented
without chat, ratings, payments, or public object storage access.

### Lessons / Observations:

The database's partial unique active-assignment index remains the final
integrity guard for one active trainer per client.

---

## Day 2 - Training Plans

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Training Plans

### Task:

Training Plan REST API

### AI Tool:

Codex

### Goal:

Provide server-authorized CRUD operations for relational training plans,
workout days, and ordered exercises without changing the database schema.

### Generated Result:

- Added authenticated REST endpoints for listing, reading, creating, replacing,
  and deleting training plans.
- Added server-side USER, TRAINER, and ADMIN access checks using the local
  FitPath role and current active trainer assignments.
- Added complete nested plan reads ordered by workout-day and exercise position.
- Added input validation for plan dates, statuses, text, positions, exercise
  values, and duplicate positions before database writes.
- Added normalized in-memory exercise-library lookup to reuse matching exercise
  rows and create missing rows within the nested write batch.
- Used Neon HTTP batch transactions for atomic creation and replacement of plan
  metadata, exercises, workout days, and workout exercises.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — relational training-plan persistence is exposed through an
authorized REST API without PDF persistence or frontend plan-builder work.

### Lessons / Observations:

For Neon HTTP, a Drizzle batch provides transaction semantics for the known
write statements while reusable exercises remain independent of plan deletion.

---

## Day 2 - Training Plan Editor

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Training Plans

### Task:

Training plan editor frontend.

### AI Tool:

Codex

### Goal:

Provide a simple responsive editor for authorized users and trainers using the
existing training plan REST API.

### Generated Result:

- Added typed training-plan API client methods.
- Replaced the My Plans placeholder with a plan list and editor for USER and
  TRAINER roles.
- Added fields for plan metadata, workout days, and exercises, including
  add/remove controls and up/down ordering controls.
- Added loading, save, success, and server/client validation states.
- Added active-client selection for trainers when creating a new plan.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — a dependency-free training-plan editor is connected to the existing
authorized API without adding advanced templates or AI generation.

### Lessons / Observations:

Simple up/down controls keep ordering explicit and avoid unnecessary
drag-and-drop dependencies for the MVP.

---

## Day 2 - Training Plan PDF Export

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Training Plans

### Task:

Authorized on-demand PDF export.

### AI Tool:

Codex

### Goal:

Generate a clean A4 PDF from the current authorized PostgreSQL training plan
without storing a PDF as application data.

### Generated Result:

- Added an authenticated `GET /api/training-plans/:id/pdf` endpoint.
- Reused existing plan access checks before loading nested plan data or
  generating the document.
- Added on-demand PDFKit rendering with FitPath branding, available client and
  trainer identity labels, plan metadata, ordered workouts, exercise details,
  and a generated-date footer.
- Returned PDF bytes directly with download response headers; no R2 storage or
  database persistence was added.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- A representative PDF generation completed successfully. Poppler was not
  available in the environment for local page rendering.

### Outcome:

**PASS** — PDF export is generated on demand from authorized current plan data.

### Lessons / Observations:

The exported document remains a derived download; PostgreSQL continues to be
the editable source of truth.

---

## Day 2 - Training Plan PDF Download UX

### Date:

2026-10-31

### Development Day:

Day 2

### Module:

Training Plans

### Task:

Authenticated PDF download UX.

### AI Tool:

Codex

### Goal:

Expose the existing authorized training-plan PDF endpoint through the React
plan editor without changing PDF generation or persistence.

### Generated Result:

- Added a typed authenticated `downloadTrainingPlanPdf` API client method that
  returns a Blob from the existing endpoint.
- Added a Download PDF control for persisted plans only.
- Added disabled/loading and error handling states while a PDF is requested.
- Triggered browser download using the plan-specific FitPath filename.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — the frontend reuses backend authorization and PDF output without
client-side generation, new dependencies, or R2 storage.

### Lessons / Observations:

The Blob download path keeps authorization in the existing Bearer-token API
request flow rather than relying on a public PDF URL.

---

## Day 3 - Progress Measurements

### Date:

2026-10-31

### Development Day:

Day 3

### Module:

Progress Tracking

### Task:

Progress measurement REST APIs.

### AI Tool:

Codex

### Goal:

Persist user weight measurements with server-calculated BMI and allow actively
assigned trainers to read their clients' measurement history.

### Generated Result:

- Added authenticated GET and POST endpoints for a user's historical progress
  measurements.
- Added server-side profile-height lookup, onboarding-range weight validation,
  and one-decimal informational BMI calculation.
- Added TRAINER and ADMIN client-progress reads, with trainers verified against
  the active assignment in PostgreSQL for every request.
- Returned numeric database values as API numbers ordered newest first.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — historical progress measurement APIs are implemented without charts,
workout completion, progress photo upload, or schema changes.

### Lessons / Observations:

BMI is calculated only from the authenticated user's stored height and the
submitted weight; client-provided BMI and ownership fields are ignored.

---

## Day 3 - Workout Completion Tracking

### Date:

2026-10-31

### Development Day:

Day 3

### Module:

Workout Completion Tracking

### Task:

Record and undo authenticated users' workout-day completions and display the
completion state in the training-plan editor.

### AI Tool:

Codex

### Generated Result:

- Added authenticated completion create, undo, and current-user list endpoints.
- Added trainer/admin client completion reads; TRAINER reads are authorized from
  the active assignment in PostgreSQL.
- Enforced USER-only completion writes and verified the workout day belongs to
  the authenticated user's training plan before either write.
- Reused the database unique `(user_id, workout_day_id)` constraint to reject
  duplicate completions.
- Added persisted-plan completion controls and a completed/total workout-day
  summary for USERs in the React editor.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — workout completion writes, reads, ownership checks, and editor
controls are implemented without gamification or schema changes.

### Lessons / Observations:

Completion ownership is derived from the workout day and its training plan on
the server; no client-supplied user or trainer relationship is trusted.

---

## Day 3 - Private Progress Photos

### Date:

2026-10-31

### Development Day:

Day 3

### Module:

Progress Tracking

### Task:

Private R2-backed progress-photo upload, retrieval, and deletion.

### AI Tool:

Codex

### Generated Result:

- Added private `progress-photos/` object-key generation for JPEG, PNG, and
  WebP uploads, limited to 5 MB.
- Added backend MIME and magic-byte signature validation before R2 upload.
- Added authenticated owner upload/list/view/delete routes and assigned-trainer
  client list/view routes.
- Kept object keys private: APIs return photo metadata and authenticated image
  bytes, never public R2 URLs or storage credentials.
- Added a USER progress-photo upload form, private Blob-backed gallery, and
  deletion controls.
- Added delete compensation: if R2 deletion fails after a record removal, the
  database record is restored.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — private progress-photo storage and the USER gallery are complete
without public R2 URLs or social-sharing features.

---

## Day 3 - Progress Charts

### Date:

2026-10-31

### Development Day:

Day 3

### Module:

Progress Tracking

### Task:

Add exactly two responsive, accessible progress charts.

### AI Tool:

Codex

### Generated Result:

- Added an SVG weight-over-time line chart using authenticated historical
  progress measurements.
- Added an SVG weekly workout-completion chart. It shows each week’s share of
  recorded completions and explicitly avoids representing this as an adherence
  percentage because the current data model has no planned workout schedule.
- Added loading, empty, and insufficient-data states for both charts.
- Added accessible chart titles, descriptions, point/bar labels, and
  screen-reader data tables.
- Reused native SVG and existing APIs; no chart dependency was added.

### Manual Review / Corrections:

Not recorded.

### Validation:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

### Outcome:

**PASS** — exactly two responsive progress charts are implemented with native
SVG and no visualization dependency.
