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
