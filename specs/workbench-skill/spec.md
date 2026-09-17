# Jev Workbench skill

## Goal
Ship this product’s own agent skill: explain the local HTTP/MCP contract, tell the agent to list functions from this machine before calling, and install/uninstall it from the workbench UI. README states the one-stop model: configure once, then both AI runtimes and ordinary HTTP clients use the same published functions.

## Scope
- `skills/jev-workbench/SKILL.md` plus short HTTP/MCP references.
- Install via `npx skills add <repo-root> --skill jev-workbench` (local path). Optional TypeSafe skill remains separate.
- UI: Agents tab can preview/apply/remove the Workbench skill without auto-install.
- Tests use a fake `npx`; they do not write the user’s real agent home.

## Agent behavior the skill must require
1. Discover with `jev_list_functions` or `GET /v1/functions`.
2. Read schema with `jev_describe_function` before invoke.
3. Do not invent function keys. `needs_review` is not permission to act.
4. Client token / MCP credential only; never the TypeSafe key.
