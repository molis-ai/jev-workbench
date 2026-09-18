# CC-Switch agent coverage for MCP and skills

## Background and goal

Connections currently installs Workbench MCP / Pi and skills for Claude Code, Codex, OpenCode, and Pi. CC-Switch (`farion1231/cc-switch`) manages a wider set of coding agents. This change matches **CC-Switch’s actual MCP writers and skills CLI agent ids**, so the same published functions can be installed on those runtimes from Connections.

Reference: `src-tauri/src/mcp/{claude,codex,gemini,grokbuild,hermes,mcode,opencode}.rs` plus config path helpers. Skills ids come from `vercel-labs/skills` `src/agents.ts`.

## Current behavior

- MCP / extension: Claude Code CLI, Codex CLI, OpenCode JSONC, Pi native loader.
- Skills CLI: `claude-code`, `codex`, `opencode`. Pi is documented as manual copy.
- `installations.runtime` and `skill_installs.runtime` CHECK four values.

## Scope

- **MCP file merge (plan → apply, only `jev-workbench`, stop on conflict):**
  - Gemini CLI → `~/.gemini/settings.json` or `<project>/.gemini/settings.json`, `mcpServers` JSON, `{command, args}` (no `type`; Gemini infers stdio from `command`).
  - Grok Build → user `GROK_HOME` or `~/.grok/config.toml`; project `<project>/.grok/config.toml`. Append `[mcp_servers.jev-workbench]` TOML (`command` + `args`, no `type`, no `http_headers`).
  - Hermes → user `HERMES_HOME` or `~/.hermes/config.yaml`; project `<project>/.hermes/config.yaml`. `mcp_servers.jev-workbench` YAML `{command, args, enabled: true}` (no `type`).
  - MiniMax Code → user `MINIMAX_DATA_DIR` / `MAVIS_DATA_DIR` / `~/.minimax/mcp.json`; project `<project>/.minimax/mcp.json`. `mcpServers` JSON `{command, args, enabled: true}`.
- **Skill CLI ids:** `gemini-cli`, `grok`, `hermes-agent`, `minimax-code`, `openclaw`, and `pi` (skills CLI now has Pi; replace manual-copy-only).
- **OpenClaw:** skill only. CC-Switch does not MCP-sync OpenClaw.
- Keep existing Claude / Codex CLI-version gate and OpenCode / Pi writers.
- UI runtime grid, README tables, SQLite CHECK via migration 006.
- Tests use temp **project** directories (or explicit env dirs under tmp). Never write this developer machine’s `~/.gemini`, `~/.grok`, `~/.hermes`, `~/.minimax`, `~/.openclaw`.

## Non-goals

- Claude Desktop: CC-Switch writes provider/gateway config, not MCP. Do not write Desktop profiles.
- Cursor, GitHub Copilot, Windsurf, and other skills-CLI-only agents that CC-Switch does not MCP-sync. Out of this change.
- Auto-install on demo start, tests, or commit.
- Rewriting any MCP/skill entry except the owned `jev-workbench` / installed skill record.
- Pinning Gemini/Grok/Hermes/MiniMax CLI versions or calling their `mcp add` CLIs.
- Changing the MCP tool contract or official TypeSafe proxy.

## Users / call chain

Connections → Agents → select runtime → preview MCP (if any) and/or skill → confirm apply → optional test/remove.

`POST /api/admin/integrations/plan|apply` and `POST /api/admin/skills/plan|apply` share the expanded runtime enum. OpenClaw MCP plan is rejected (`CONFIG_INVALID`); skill plan uses `--agent openclaw`.

## Module boundary

- `apps/server/src/runtimes.ts` — runtime ids, detect CLIs, skill agent map, MCP vs skill-only.
- `apps/server/src/integrations.ts` — path + merge/remove for new file adapters.
- `apps/server/src/skills.ts` — consume expanded `skillAgents`.
- `apps/server/src/app.ts` — zod enum.
- `apps/server/src/storage.ts` — migration 006.
- `apps/web/src/Connections.tsx` + `en.json` + compact runtime grid.
- README / CHANGELOG / product skill list.

## Acceptance

- Gemini / Grok / Hermes / MiniMax: project-scope plan/apply writes only `jev-workbench`, preserves unrelated servers and (JSONC/YAML) comments where the parser allows; remove deletes only that key; a dirty file after preview is `CONFIG_CHANGED`.
- OpenClaw: skill command includes `--agent openclaw`; integrations plan does not write MCP.
- Pi skill plan is supported via `--agent pi`.
- Existing OpenCode JSONC and Pi extension tests still pass.
- Migration 006 expands CHECK without dropping existing rows.
- `pnpm typecheck` and `pnpm test` pass. Tests do not mutate the developer’s real agent homes.

## Verify

```sh
pnpm typecheck
pnpm test
```

Manual live install onto `~/.gemini` / `~/.grok` / `~/.hermes` / `~/.minimax` is out of scope for this change.
