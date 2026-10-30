# FitPath Project Context

This document provides persistent project context and implementation guardrails
for AI coding agents working on FitPath.

## Project

FitPath is a fitness management SPA that allows users to create and track
workout plans, monitor progress, and work with approved personal trainers.

## Technology Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Node.js
- Express
- PostgreSQL hosted on Neon
- Drizzle ORM
- Clerk authentication
- Cloudflare R2
- Cypress
- GitHub Actions

## Roles

### User

- Manages their own profile.
- Creates their own workout plans.
- Tracks workout completion and progress.
- May choose an approved trainer.

### Trainer

- Is created through an admin-approved trainer application.
- Manages assigned clients.
- Creates or modifies workout plans for assigned clients.
- Monitors assigned client progress.

### Admin

- Manages users and trainers.
- Approves or rejects trainer applications.
- Has administrative access to training plans.

## MVP Architecture Principles

- Keep the application simple.
- Avoid overengineering.
- Maintain clear frontend/backend boundaries.
- Prefer readable code over unnecessary abstractions.
- Do not implement functionality outside the frozen MVP scope.

## Database Rules

- Drizzle schema definitions describe the application database model.
- Versioned Drizzle SQL migrations committed to Git are the source of truth for
  schema evolution.
- Never use `drizzle-kit push`.
- Never manually mutate the Neon schema.
- Every schema change must create a new migration.
- Never modify an already-applied migration.

## Security Rules

- Never expose server secrets to React.
- Authorization must always be enforced by the Express backend.
- Frontend role checks are presentation logic only.
- Never trust roles or ownership identifiers supplied by the client.
- Validate all external input.
- Private files must not be exposed through unrestricted public URLs.

## Testing Expectations

- Lint and typecheck must remain green.
- Important utilities should have unit tests where appropriate.
- Critical user workflows will be tested with Cypress.
- GitHub Actions will run automated checks.

## Scope Freeze

The following features are explicitly **OUT OF SCOPE for the MVP**:

- Chat
- Payments
- Subscriptions
- Nutrition planning
- Calorie databases
- Notifications
- Smartwatch/wearable integrations
- Social networking
- AI-generated workout plans
- Video exercise platform
- Trainer ratings/reviews

Future ideas may be documented, but they must not be implemented during the
MVP.
