# KlipFlow

KlipFlow is a mobile-first creator workflow for generating, posting, and tracking short-form clips for content-rewards submissions.

## Reconstructed source layout

- `client/` — Vite React frontend
- `server/` — Express and tRPC backend
- `server/integrations/` — Supabase workflow helpers, storage, OAuth/provider adapters, Telegram reminders, view sync, and media-worker experiments
- `shared/` — shared constants and domain contracts
- `drizzle/` — Manus auth schema and Drizzle metadata
- `supabase/migrations/` — reserved for additive Supabase migrations; the recovered bundle did not contain migration SQL
- `docs/recovery/` — handover and recovery notes from the prior account

## Development

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env
pnpm check
pnpm test
pnpm build
pnpm dev
```

The development server starts on port 3000 by default and serves the Vite frontend with the Express/tRPC backend.

## Environment variables

`.env.example` documents variable names only. Never commit `.env` or real credentials. Add production secrets through the deployment/WebDev secret manager.

## Current limitations

The recovered implementation contains simulated clip generation and simulated posting paths. Real social OAuth, provider posting, media processing, view synchronization, and durable Telegram reminders must remain explicitly marked as configured or simulated until their credentials, provider approvals, and production handlers are validated.

The project preserves the existing Supabase project, Whop app reference, n8n webhook contracts, and legacy webhook paths. Do not create replacement infrastructure or delete legacy data.
