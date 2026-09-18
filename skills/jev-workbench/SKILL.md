---
name: jev-workbench
description: Call local Jev Workbench judgment functions over MCP or HTTP. Use when you need to list, describe, or invoke published functions on 127.0.0.1, or when a service should share the same judgments as an AI runtime. Do not invent function keys; discover them from the local service first.
---

# Jev Workbench

Jev Workbench is a **local** judgment service. A human configures Noul, Choice, or Score functions in the browser, publishes an immutable version, then **the same functions** are available to:

- AI runtimes (Claude Code, Codex, OpenCode, Pi, Gemini CLI, Grok Build, Hermes, MiniMax Code, OpenClaw) through MCP tools and this skill
- Ordinary services through HTTP and a client token

Configure once on this machine. Do not call TypeSafe’s cloud API with the vendor key from the agent. The workbench holds the TypeSafe key and meters calls.

Default origin: `http://127.0.0.1:17420` (demo `17430` is simulated and rejects official `/v1/systemone`).

## Before any invoke

1. List what this credential can call.
2. Describe the function you intend to use.
3. Build `input` from `input_schema` only.
4. Invoke. If `status` is `needs_review`, stop and tell the user — that is not permission to take an action.

Prefer MCP tools when they are available. If MCP is missing, use HTTP with `Authorization: Bearer $JEV_CLIENT_TOKEN`.

## MCP tools

| Tool | Use |
|---|---|
| `jev_list_functions` | Discover authorized keys and versions |
| `jev_describe_function` | `key`, optional `version` — input/output schema, `when_to_use` |
| `jev_invoke` | `key`, optional `version`, `input` object |

These tools talk to the local workbench. They do not read the database or the TypeSafe key. Inference may be billed through the workbench’s key.

Details: [references/mcp.md](references/mcp.md)

## HTTP

| Method | Path |
|---|---|
| GET | `/v1/functions` |
| GET | `/v1/functions/:key` |
| POST | `/v1/functions/:key/invoke` |
| POST | `/v1/systemone` (separate grant: official TypeSafe body) |
| GET | `/v1/models` (same official grant) |
| GET | `/health/live` |

Errors: `{ "error": { "code", "message" }, "meta": { "request_id" } }`. `needs_review` is HTTP 200.

Details: [references/http.md](references/http.md)

## Do not

- Invent a function key or input field
- Treat model probability or `confidence` as accuracy
- Send the TypeSafe vendor key, or call `api.typesafe.ai` directly from the agent
- Use demo port 17430 as if it were live TypeSafe
- Auto-execute refunds or other side effects because a function returned `ok`
