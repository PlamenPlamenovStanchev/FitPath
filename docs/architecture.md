# Architecture

FitPath is a small monorepo containing two npm workspaces:

- `client` is a React single-page application built by Vite.
- `server` is an Express HTTP API compiled with TypeScript.

The browser application communicates with the API over HTTP. During local
development, Vite proxies `/api` requests to the Express server. PostgreSQL
access will use Drizzle ORM and Neon's serverless driver. Authentication will
use Clerk, and file storage will use Cloudflare R2's S3-compatible API.

Integrations should be introduced alongside the first feature that needs them,
rather than through speculative service layers.
