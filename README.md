# FitPath

FitPath is a small university project built as a React SPA with a Node.js API.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- A PostgreSQL database (the project targets Neon)

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

The client runs at `http://localhost:5173` and the API runs at
`http://localhost:3000`. The API health check is available at
`http://localhost:3000/health`.

## Commands

- `npm run dev` - run the client and server in watch mode
- `npm run build` - create production builds for both applications
- `npm run lint` - lint the full repository
- `npm run typecheck` - type-check both applications without emitting files
- `npm run format` - format supported files with Prettier
- `npm run e2e` - open Cypress interactively
- `npm run e2e:run` - run Cypress headlessly (requires the dev server)
- `npm run admin:promote -- --clerk-user-id user_xxx` - promote an existing
  local FitPath user to ADMIN (development administration only)
- `npm run db:generate` - generate Drizzle migrations
- `npm run db:migrate` - apply Drizzle migrations
- `npm run db:studio` - open Drizzle Studio

## Project layout

- `client/` - React, TypeScript, Vite, and Tailwind CSS SPA
- `server/` - Express and TypeScript API
- `drizzle/` - generated SQL migrations
- `cypress/` - end-to-end tests
- `docs/` - project documentation
- `scripts/` - future project automation scripts

Copy `.env.example` to `.env` and fill in your own local values. Never commit
real credentials.

## Development admin promotion

This is a server-side administrative development operation, not a browser or
API feature. It can only promote an existing FitPath user to `ADMIN`.

1. Register or sign in normally through Clerk.
2. Open FitPath once so `/api/me` creates the local FitPath user.
3. Copy that user's Clerk user ID (`user_...`) from the Clerk Dashboard.
4. Run:

   ```bash
   npm run admin:promote -- --clerk-user-id user_xxx
   ```

5. Log out and sign back in, or refresh FitPath.
6. Confirm `/api/me` now returns `role: "ADMIN"`.

The command never creates a user or accepts arbitrary role assignment. It
prints only the local FitPath user ID and the prior/new roles.
