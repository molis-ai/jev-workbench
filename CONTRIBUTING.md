# Contributing

## Setup

Node.js 24 and pnpm 11.9.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Do not put TypeSafe keys, client tokens, or raw judgment text in Git, logs, fixtures, or pull requests.

## Layout

- `packages/contracts` — function DSL and HTTP bodies
- `apps/server` — SQLite, auth, invoke, TypeSafe provider, integrations
- `apps/web` — local admin UI
- `apps/mcp` / `apps/pi-extension` — HTTP clients only; they do not read the database or the vendor key
- `specs/` — the behavior source of truth
- `tests/` — Vitest and Playwright; fixtures are explicit test/demo only

## Changes

Match existing TypeScript style. Run `pnpm format` before a review. If behavior, APIs, or data change, update the unique spec under `specs/` first. Do not add a second fallback provider. Do not rewrite a user’s Agent config except through the plan/apply adapters.
