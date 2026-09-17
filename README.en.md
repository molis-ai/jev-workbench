# Jev Workbench

[中文](README.md) · English

Local judgment functions for TypeSafe’s Jev. Configure inputs, questions, review rules and outputs in the browser, publish an immutable version, then call the same engine over HTTP, MCP or Pi. The TypeSafe key stays on this machine. Callers use a restricted client token.

The official TypeSafe Python client can point at this workbench. The official TypeSafe agent skill is optional: install or skip it per runtime, like a cc-switch panel. Nothing is written to an agent until you confirm.

![Workbench](docs/images/workbench.png)

Licensed under [MIT](LICENSE). See [SECURITY.md](SECURITY.md). Live TypeSafe inference was verified on 2026-09-18. Installing skills into Claude/Codex/OpenCode is a product action, not a side effect of tests.

## Try it without a key

Node.js 24 and pnpm 11.9.0, from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

The browser opens an English session at [127.0.0.1:17430](http://127.0.0.1:17430). Answers are simulated. The seed is English: Ticket routing v1, four saved cases, and a restricted demo client.

If an older Chinese demo database already exists, remove `~/.jev-workbench-demo` and start demo again.

| Input | Expected |
|---|---|
| Please refund the duplicate charge. | `ok`, `department=billing` |
| unclear, needs review | `needs_review`, `department=null` |
| simulate error | 502 `UPSTREAM_UNAVAILABLE` |
| simulate timeout | 504 `UPSTREAM_TIMEOUT` |

```sh
pnpm demo:call
pnpm demo:call 'unclear, needs review'
pnpm demo:call 'simulate error'
pnpm demo status
pnpm demo open
pnpm demo stop
```

## Production

```sh
pnpm start
# or
pnpm jev service start
pnpm jev service status
pnpm jev service open
pnpm jev service stop
```

Default bind: `127.0.0.1:17420`, data in `~/.jev-workbench`. Set a TypeSafe key in Settings. There is no automatic fallback to demo data.

## HTTP

Published function:

```sh
curl http://127.0.0.1:17420/v1/functions/ticket_route/invoke \
  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"input":{"content":"Please refund the duplicate charge."}}'
```

Official TypeSafe body (enable **Allow official Jev calls** on the client):

```sh
curl http://127.0.0.1:17420/v1/systemone \
  -H "Authorization: Bearer $JEV_CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"model":"jev-1.13.0","state":"Please refund the duplicate charge.","questions":{"is_billing":{"type":"noul","instructions":"Is this a billing question?"}}}'
```

### Official Python SDK

[typesafe-sdk](https://github.com/typesafe-ai/typesafe-sdk-python) talks to this workbench if you override the base URL. [system-one-adapter-python](https://github.com/typesafe-ai/system-one-adapter-python) is an LLM stand-in for TypeSafe, not a Workbench installer.

```sh
pip install typesafe-sdk
export TYPESAFE_BASE_URL=http://127.0.0.1:17420
export TYPESAFE_API_KEY=$JEV_CLIENT_TOKEN
```

The client token must have official Jev access. The TypeSafe vendor key never leaves this machine.

## Agents

![Agents](docs/images/agents.png)

Two independent actions in **Connections → Agents**:

1. **Workbench MCP / Pi** — install the local function tools. Plan, then apply. Only the `jev-workbench` entry is written.
2. **TypeSafe skill (optional)** — install or remove the official [`typesafe-ai/skills`](https://github.com/typesafe-ai/skills) skill with `npx skills`. Skip it if you only need HTTP or MCP.

| Runtime | Workbench | Official skill |
|---|---|---|
| Claude Code | MCP stdio | `npx skills add typesafe-ai/skills --skill typesafe-ai --agent claude-code` |
| Codex | MCP stdio | `--agent codex` |
| OpenCode | MCP jsonc | `--agent opencode` |
| Pi | native extension | copy `skills/typesafe-ai` manually |

Uninstall reverses only what this product installed. Other MCP servers and skills stay.

## UI

The default language is English. Switch to 中文 from the top bar. User-authored names and instructions stay as written.

![Noul](docs/images/noul.png)

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

See [VALIDATION.md](VALIDATION.md), [specs/v1/spec.md](specs/v1/spec.md), [specs/official-proxy/spec.md](specs/official-proxy/spec.md), [specs/runtime-skills/spec.md](specs/runtime-skills/spec.md), and [CONTRIBUTING.md](CONTRIBUTING.md).
