# Changelog

## 0.1.0 — 2026-09-18

- Local judgment-function workbench: configure, preview, publish immutable versions, authorize HTTP/MCP/Pi callers.
- Single-page directory (current / archive / trash) with Noul, Choice, and Score.
- Offline demo on port 17430 with simulated answers; production never falls back to fixtures.
- Optional official TypeSafe proxy: `POST /v1/systemone` and `GET /v1/models` behind `official_invoke`.
- Answer validation aligned with published TypeSafe primitive docs (Noul has no confidence; Score is the probability-weighted level).
- Optional official TypeSafe skill install/uninstall per runtime (`npx skills`, confirm before write).
- Optional MCP install for Gemini CLI, Grok Build, Hermes, and MiniMax Code; OpenClaw is skill-only (CC-Switch MCP coverage).
- Product skill `skills/jev-workbench`: documents HTTP/MCP and requires agents to list local functions before invoke.
- English default UI and English demo seed.
- Front end rebuilt in DropAgent's visual language: warm neutral surfaces, mist-blue accent, compact directory rows, inset content pane, and a bottom action bar; dark by default with a light theme toggle. Same features and APIs (specs/dropagent-visual/spec.md).
- Dropped Tailwind and `@tailwindcss/vite`; the UI is plain CSS over Radix primitives.
- Rewrote both READMEs around the new UI.
