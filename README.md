# Jev Workbench

English · [中文](README.zh.md)

**Write a judgment once. Call it from everywhere.**

Jev Workbench is a local service for building *judgment functions* on top of
TypeSafe's Jev — small, versioned decisions like "is this ticket about billing?"
or "does this evidence support that claim?". You define one in the browser, try
it on real input, and publish it. From then on the **same published version**
answers both your backend over HTTP and your coding agents over MCP.

The TypeSafe vendor key never leaves this machine. Callers get a scoped client
token that is pinned to the function versions you granted.

![The workbench](docs/images/workbench.png)

## Try it in a minute, without a key

Node.js 24 and pnpm 11.9.0, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

A browser opens on [127.0.0.1:17430](http://127.0.0.1:17430) with a seeded
`ticket_route@1`, four saved cases, and a restricted demo client. Every answer
is simulated — no network, no charges — and a banner says so on every screen.

Type one of these into the sample input and hit **Run preview**:

| Input | Result |
|---|---|
| `Please refund the duplicate charge.` | `ok`, `department=billing` |
| `unclear, needs review` | `needs_review`, `department=null` |
| `simulate error` | 502 `UPSTREAM_UNAVAILABLE` |
| `simulate timeout` | 504 `UPSTREAM_TIMEOUT` |

Or drive it from the shell:

```sh
pnpm demo:call                          # the happy path
pnpm demo:call 'unclear, needs review'
pnpm demo status                        # is it running?
pnpm demo open                           # new admin session
pnpm demo stop
```

Demo state lives in `~/.jev-workbench-demo` and never touches production data.
If you still have a database from an older Chinese demo, delete that directory
and run `pnpm demo` again.

## How it fits together

```
  browser (admin session, 127.0.0.1)
        │  define → preview → publish
        ▼
  ┌──────────────────────────────┐
  │  Jev Workbench               │──── TypeSafe key ───▶  api.typesafe.ai
  │  drafts · versions · grants  │
  └──────────────────────────────┘
        ▲                      ▲
        │ client token         │ credential file
   your backend            coding agents
   POST /v1/…/invoke       jev_invoke (MCP)
```

A **function** has one editable draft and any number of **published versions**.
Publishing freezes the whole config plus the model version, and requires a
successful preview of exactly that config. Published versions are immutable —
editing the draft never changes what a caller already gets.

A **grant** ties a client token to a function at a pinned version. Publishing v2
does not silently upgrade anyone; you re-grant when you are ready.

## Noul, Choice, Score

Three primitives, each with its own result view:

| Primitive | Question | Returns |
|---|---|---|
| **Noul** | Does this hold? | probability of *yes* (no separate confidence field) |
| **Choice** | Which category? | the chosen key plus a probability per option |
| **Score** | How much, on an ordered scale? | a 0-based level index, probability-weighted |

The left column is what the model is told; the right column is what your caller
receives. Option keys stay stable for callers while you reword the rubric.

![A Noul function](docs/images/noul.png)

## Call it from your backend

```sh
curl http://127.0.0.1:17420/v1/functions/ticket_route/invoke \
  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"input":{"content":"Please refund the duplicate charge."}}'
```

| Endpoint | Purpose |
|---|---|
| `GET /v1/functions` | what this credential can see |
| `GET /v1/functions/:key` | input and output contract (internal questions stay hidden) |
| `POST /v1/functions/:key/invoke` | run a published version |
| `POST /v1/systemone` | official TypeSafe body, needs **Allow official Jev calls** |
| `GET /v1/models` | official model list, same grant |
| `GET /health/live` | liveness, no secrets |

Errors are `{"error":{"code","message"},"meta":…}`. `needs_review` is **not** an
error: it is a 200 with a business status, produced by your own review rules.

### Using the official Python SDK

[typesafe-sdk](https://github.com/typesafe-ai/typesafe-sdk-python) talks to this
workbench if you point it at localhost. The client token needs official Jev
access; the vendor key still never leaves this machine.

```sh
pip install typesafe-sdk
export TYPESAFE_BASE_URL=http://127.0.0.1:17420
export TYPESAFE_API_KEY=$JEV_CLIENT_TOKEN
```

## Call it from coding agents

**Connections → Agents** is a one-stop installer. It detects what you have,
shows you the exact diff, and writes nothing until you confirm.

![Agent integration](docs/images/agents.png)

Three independent things you can install:

1. **MCP bridge** — registers `jev_list_functions`, `jev_describe_function`,
   `jev_invoke` as local tools.
2. **Jev Workbench skill** ([`skills/jev-workbench`](skills/jev-workbench/SKILL.md))
   — tells the agent to list this machine's functions *before* inventing a call.
3. **TypeSafe skill** (optional) — the official
   [`typesafe-ai/skills`](https://github.com/typesafe-ai/skills) for designing
   Jev questions. Not needed to call this workbench.

| Runtime | Bridge | Config written |
|---|---|---|
| Claude Code | MCP stdio | `~/.claude.json` (user) or `.mcp.json` (project) |
| Codex | MCP stdio | `codex mcp add` → `~/.codex/config.toml` |
| OpenCode | MCP stdio | `opencode.jsonc`, comments preserved |
| Pi | native extension | loader file for `dist/pi-extension` |
| Gemini CLI | MCP | `.gemini/settings.json` |
| Grok Build | MCP | `config.toml` |
| Hermes | MCP | `config.yaml` |
| MiniMax Code | MCP | `mcp.json` |
| OpenClaw | — | skill only |

Each install gets its **own credential file** (mode 0600); the agent config only
ever holds a path, never a token. Uninstall removes only the `jev-workbench`
entry — other MCP servers and skills are left alone, and if someone edited the
entry by hand the plan stops instead of overwriting it.

Connection tests distinguish `bridge_verified` from `http_verified`. Neither
claims the agent has actually reloaded or called a model.

## The workbench itself

![Function directory](docs/images/directory.png)

- Functions are grouped into **Current**, **Archive**, and **Trash**, with
  search and filters by status or primitive.
- Archive and Trash both keep every version, case, and grant while stopping
  business calls; restoring puts the function back as it was.
- Permanent delete exists only inside Trash, needs an explicit confirmation, is
  refused while a call is running, and clears that function's versions, cases,
  grants, and run records in one transaction.
- Switching functions keeps unsaved drafts, raw JSON edits, and preview inputs
  for the session. Business text is never written to `localStorage`, and closing
  a tab with unsaved work warns first.
- English by default; switch to 中文 from the top bar. Dark by default; the sun
  icon next to it switches to light. Names and instructions you wrote stay
  exactly as written in either mode.

## Running it for real

```sh
pnpm start                  # foreground, Ctrl-C to stop
# or
pnpm jev service start      # background, opens a browser
pnpm jev service status
pnpm jev service open       # fresh short-lived admin session
pnpm jev service stop
```

Binds `127.0.0.1:17420`, data in `~/.jev-workbench`. `JEV_PORT` and `JEV_HOME`
move both. Production never installs dependencies at startup, and **never**
falls back to simulated answers when the provider fails.

Set your TypeSafe key in **Settings**, or supply `TYPESAFE_API_KEY` in the
launch environment — the environment wins and the field goes read-only. A key
entered in the UI is encrypted with AES-GCM; the master key and ciphertext are
readable only by your OS user. Without a key you can still edit everything;
inference returns `PROVIDER_NOT_CONFIGURED`. A demo preview is never proof that
a production publish will work.

## Keys, tokens, and what is stored

Three credentials, deliberately separate:

- **TypeSafe key** — yours, on this machine, used only for upstream calls.
- **Admin session** — short-lived, bootstrapped from the terminal, CSRF-checked.
- **Client token** — per caller, shown once at creation, stored hashed, scoped
  to pinned function versions, revocable.

Run records keep metadata only: status, timing, model, error code. Input text
and answers are not stored, so they cannot be replayed. The one exception is a
**saved test case**, which you create explicitly and which does write your input
to the local database. Exports contain no vendor key, no client token, and no
call bodies.

## Backup, restore, upgrade

**Settings → Backup and export** runs SQLite's online backup API (file mode
0600) and exports function configs as JSON.

Upgrade: stop the service → back up → `pnpm install --frozen-lockfile` →
`pnpm build` → start. Migrations are recorded in `schema_migrations`.

To restore, stop the service first, move the whole existing data directory
aside, then copy the backup in as `workbench.db` in a fresh directory (0700
directories, 0600 files). Never drop a backup on top of a live database with its
old WAL still around.

After a crash, `pnpm jev service recover` (or `pnpm demo recover`) clears the
lock — but only when the health check fails *and* the recorded PID is gone. A
restart marks interrupted runs as such; it never replays inference.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest uses throwaway SQLite databases and an explicitly injected upstream
fixture. Playwright runs a temporary server on 17425 in test mode. Lifecycle
tests use 17426 and MCP tests 17423, so demo (17430) and production (17420) are
untouched. No key is needed for any of it.

| Path | What lives there |
|---|---|
| `packages/contracts` | the shared function DSL |
| `apps/server/src` | storage, auth, execution, provider, integrations |
| `apps/web/src` | the React workbench |
| `apps/mcp`, `apps/pi-extension` | thin bridges that only forward to HTTP |

The UI follows [`specs/dropagent-visual/spec.md`](specs/dropagent-visual/spec.md).
Other contracts: [`specs/v1`](specs/v1/spec.md),
[`specs/official-proxy`](specs/official-proxy/spec.md),
[`specs/runtime-skills`](specs/runtime-skills/spec.md). See also
[VALIDATION.md](VALIDATION.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Status and limits

Verified against a real TypeSafe key on 2026-09-18: model list, function
preview, publish, client invoke, and the official `POST /v1/systemone`. Agent
installs are verified against isolated config files and real CLI versions —
**model calls from inside the nine runtimes are not yet verified**, and
installing a skill into your editor is a product action, never a test side
effect.

No persistent queue, cache, idempotency keys, multi-tenancy, desktop installer,
or local model. A retried call can be billed twice. Model probability and
confidence are not business accuracy. Runs on macOS ARM64 / Node 24.14.0; other
platforms are unverified, and `better-sqlite3` may need build tools where no
prebuilt binary exists.

Upstream contract: [TypeSafe HTTP API](https://docs.typesafe.ai/api).
Licensed under [MIT](LICENSE) — see [SECURITY.md](SECURITY.md).
