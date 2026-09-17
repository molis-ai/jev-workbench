# Changelog

## 0.1.0 — 2026-09-18

- Local judgment-function workbench: configure, preview, publish immutable versions, authorize HTTP/MCP/Pi callers.
- Single-page directory (current / archive / trash) with Noul, Choice, and Score.
- Offline demo on port 17430 with simulated answers; production never falls back to fixtures.
- Optional official TypeSafe proxy: `POST /v1/systemone` and `GET /v1/models` behind `official_invoke`.
- Answer validation aligned with published TypeSafe primitive docs (Noul has no confidence; Score is the probability-weighted level).
- Optional official TypeSafe skill install/uninstall per runtime (`npx skills`, confirm before write).
- English default UI and English demo seed.
