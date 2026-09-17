# Jev Workbench

[中文](README.md) · English

A local judgment-function service with a browser workbench. Define inputs, questions, review rules and outputs, publish immutable versions, and call the same execution engine through HTTP, MCP or Pi.

The workbench has a function list on the left and the selected function on the right. Create a **Noul** (probability of support), **Choice** (category), or **Score** (ordered level) function, edit it and test it without leaving the page. Advanced schema/mapping controls and integrations expand in place. The top bar switches between English and Chinese without changing user-authored content.

## Try it without an API key

Requires Node.js 24 and pnpm 11.9.0. Run commands from the project root.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

The browser opens an authenticated local session at [127.0.0.1:17430](http://127.0.0.1:17430). The demo uses deterministic offline data, clearly labelled as simulated. It does not contact TypeSafe or incur inference charges. It seeds a ticket-routing release, saved examples and a restricted demo client only when the demo database is empty.

```sh
pnpm demo:call 'Please refund the duplicate charge'
pnpm demo:call 'unclear, needs review'
pnpm demo:call 'simulate error'    # expected failure, exit 1
pnpm demo:call 'simulate timeout'  # expected failure, exit 1
pnpm demo status
pnpm demo open
pnpm demo stop
```

Demo data lives in `~/.jev-workbench-demo`, separate from production. Use `JEV_DEMO_HOME` and `JEV_DEMO_PORT` to override it. The demo credential is stored in `clients/demo-api.json` with owner-only permissions; the script reads it without printing the token. Mock results cannot serve as proof for production publication.

## Production service

```sh
pnpm start                  # foreground
pnpm jev service start      # background; opens browser
pnpm jev service status
pnpm jev service open
pnpm jev service stop
```

Default address: [127.0.0.1:17420](http://127.0.0.1:17420). Data directory: `~/.jev-workbench`. Override with `JEV_HOME` and `JEV_PORT`; update client configurations if you do. The service only binds to loopback.

Configure the TypeSafe API key in Settings or provide `TYPESAFE_API_KEY` in the startup environment. The environment takes precedence. UI-provided keys are encrypted with AES-GCM; the encryption key and ciphertext are owner-readable only. A missing key returns `PROVIDER_NOT_CONFIGURED`. Production never falls back to simulated data.

Workflow: create a function → define the judgment → test the current configuration → save/publish with a pinned model → expand **Connect & invoke** → create a client grant → call the published version. Published versions are immutable. Editing a draft or activating a different default version does not update pinned clients.

## Function lifecycle

- Search and filter the list by draft, published, disabled or archived status.
- Switching functions keeps unsaved configuration and test input in memory in the current browser session. Save explicitly to persist a draft on the server. Refreshing or closing with unsaved edits prompts before leaving; no business text is automatically put in localStorage.
- Archiving preserves versions, examples and grants, but blocks business calls. Restore from the archived filter.
- The compact directory groups functions into Current, Archived and Trash, with counts, primitive tags and status labels. Move to Trash blocks calls but preserves versions, examples, grants and history; restore to resume the prior state.
- Permanent deletion is available only in Trash, requires confirmation, and removes that function’s versions, examples, grants and run records. Running functions cannot be permanently deleted until execution finishes. Other functions, client identities and integration installations remain intact.

## HTTP and agents

```sh
curl http://127.0.0.1:17420/v1/functions/ticket_route/invoke \
  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"input":{"content":"Please refund the duplicate charge."}}'
```

Admin sessions, client tokens and the TypeSafe key are separate credentials. Client tokens are displayed once and stored only as hashes. New clients have no grants until explicitly selected. `needs_review` is a business outcome, not a transport failure or permission to take an action.

The MCP bridge exposes three fixed tools: `jev_list_functions`, `jev_describe_function`, and `jev_invoke`. It can initialize while the service is offline and returns a startup instruction when called.

```sh
node /absolute/project/dist/mcp/index.js \
  --credentials-file /absolute/home/.jev-workbench/clients/example.json
```

The complete Pi extension package is built under `dist/pi-extension`:

```sh
JEV_CREDENTIALS_FILE=/absolute/path/client.json pi -e /absolute/project/dist/pi-extension/index.js
```

Integration controls detect runtime versions, prepare a redacted change preview, apply the product-owned entry, test the connection and remove it. Unknown CLI versions stop at manual command preparation. Existing unrelated entries and later user edits are preserved.

- **Claude Code 2.1.206:** actual project-scoped CLI installation/removal tested in an isolated temporary project, without model calls.
- **Codex 0.154.0:** official user-scoped CLI parameters checked; no installation into the user's live configuration. Project scope remains manual because this CLI has no corresponding add option.
- **OpenCode:** JSONC-aware isolated file tests preserve comments and unrelated entries. Runtime not installed on the validation machine.
- **Pi:** generated loader and shared tool contract tested; Pi CLI not installed on the validation machine.

Connection verification does not prove that the target agent loaded the tools or performed inference.

## Development and verification

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

Tests use temporary SQLite databases and explicit provider fixtures. Browser tests use port 17425, MCP tests 17423, lifecycle tests 17426. They do not overwrite production or demo data. Coverage includes permissions, version pinning, stale drafts, deletion consistency, in-flight deletion rejection, all three primitives and the bilingual browser workflow.

Modules: `packages/contracts` defines the DSL; `apps/server/src` handles storage, authorization and execution; `apps/web/src` contains the workbench; `apps/mcp` and `apps/pi-extension` forward to HTTP. The earlier standalone design preview remains in `design/single-page` and is not the production application.

## Backup and recovery

Settings provides an online SQLite backup. Backups may contain explicitly saved test examples and use owner-only permissions. Function exports exclude credentials, runtime settings and raw run payloads.

To upgrade: stop → back up → install with the frozen lockfile → build → start. To restore manually, stop first, move the existing data directory to a safe location, then copy a backup as `data/workbench.db`; preserve directory mode 0700 and file mode 0600. Do not combine an old database with an unrelated WAL file.

`pnpm jev service recover` (or `pnpm demo recover`) clears a stale lock only if the health check fails and the recorded PID no longer exists. Restart marks leftover running calls interrupted; it does not replay them. Shutdown stops new requests and cancels remaining calls after a three-second grace period.

## Validation limits

The user has no TypeSafe API key, so real cloud inference and model-driven calls from all four agents are deferred. Offline success does not establish business accuracy. Probabilities and confidence values are not accuracy measurements.

Validated locally on macOS ARM64 / Node 24.14.0. Other platforms, signed installers and automatic upgrades are not validated. There is no persistent queue, idempotency guarantee, multi-tenancy, local model or desktop package. Repeated calls may incur repeated charges in production.

See [validation records](VALIDATION.md), [implementation specification](specs/v1/spec.md), [single-page specification](specs/single-page/spec.md), and the [official TypeSafe API documentation](https://docs.typesafe.ai/api).
