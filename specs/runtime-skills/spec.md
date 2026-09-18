# Optional TypeSafe skill install, English demo, English default UI

## Goal
Product feature (cc-switch style): the user may install or skip the official TypeSafe agent skill per runtime. Never install onto this developer machine as a side effect of tests. Demo data and the default UI are English. README.md is the screenshot-backed English readme shown on GitHub.

## Scope
- Optional skill install/uninstall via `npx skills` (`typesafe-ai/skills`, skill `typesafe-ai`). Agent ids now include Pi, Gemini CLI, Grok Build, Hermes, MiniMax Code, and OpenClaw; see `specs/cc-switch-agents/spec.md`.
- Independent from Workbench MCP/Pi install. Default is not installed.
- plan → apply; only this product’s skill record; stop on conflict. Tests use a fake `npx` and temp directories, never the user’s real agent home.
- Default UI language English unless `localStorage.jev-language=zh`.
- Demo seed uses `examples/ticket_route.en.v1.json` and English cases.
- English README with screenshots captured from the English UI.
- Document official Python usage: `typesafe-sdk` with `TYPESAFE_BASE_URL` pointing at this workbench. Do not vendor `system-one-adapter-python`.

## Non-goals
- Do not auto-install skills during demo start, tests, or commit.
- Do not rewrite a user’s existing MCP/skill entries except the owned TypeSafe skill install we created.
- Cursor / Copilot / Windsurf and other skills-CLI-only agents that CC-Switch does not MCP-sync. Expanded MCP coverage is `specs/cc-switch-agents/spec.md`.

## Acceptance
- Skill plan returns the official `npx skills add|remove` command; apply records status; remove only that skill for that agent.
- MCP install path unchanged.
- New empty browser session is English; e2e bilingual still works.
- Fresh demo seed is English; `pnpm demo:call` default input is English.
- README.md includes product screenshots from the English workbench.
