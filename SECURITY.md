# Security

Jev Workbench is a single-user loopback service. It is not a multi-tenant cloud product.

## Report a vulnerability

Email the maintainers privately. Do not open a public issue with secrets, tokens, or raw judgment payloads.

## What this process stores

| Secret | Where | Notes |
|---|---|---|
| TypeSafe API key | `TYPESAFE_API_KEY` or `~/.jev-workbench/secrets.json` | AES-GCM at rest; env wins over the file |
| Client tokens | shown once; SHA-256 in SQLite | MCP/Pi credential files are `0600` |
| Admin bootstrap | memory, 60s, one use | URL fragment, not query string |
| Call bodies | not in `runs` | only explicitly saved test cases keep business text |

The service binds `127.0.0.1` only. A process on this machine can still call it. Client tokens are application isolation, not an OS sandbox.

## Upstream

The TypeSafe base URL is fixed at `https://api.typesafe.ai`. Callers cannot change it. Official `/v1/systemone` access requires an explicit client grant. Demo mode never forwards to TypeSafe.
