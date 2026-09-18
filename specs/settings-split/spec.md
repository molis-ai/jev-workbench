# Settings as a Codex-style split page

## Background and goal

Settings is a right-hand drawer with a single stacked form (TypeSafe key, local service, export/backup). That is cramped and unlike Codex’s settings: a full page, left category list, right pane of grouped rows (title, caption, control).

Move settings to the same workspace destination pattern as Connections. Inside the page, split left nav / right content.

## Current behavior

- Left rail and topbar open `Drawer` titled 设置.
- One scrollable stack; execution limits hidden in `<details>`.

## Scope

- Settings is a workspace view (`view: settings`), not a drawer.
- Left rail 设置 and the topbar provider/status control open this view and mark the rail item active. Selecting a function returns to the editor (same as Connections).
- Inner split:
  - Left: TypeSafe, 本机服务, 备份与导出.
  - Right: section title, one-line description, `config-sheet` rows (label/copy left, control right).
- Same APIs: `PUT /provider`, `POST /provider/test`, `PATCH /settings`, `GET /export`, `POST /backup`. No new settings.
- Desktop: split fills the right pane; nav is fixed, body scrolls if needed. ≤700px: nav becomes a horizontal row, content stacks below.
- Default UI language English; new copy must keep unique English strings.

## Non-goals

- Settings search (Codex has it; three sections do not need it).
- Moving language, Connections, API docs, or call history into settings.
- Changing provider/backup/export contracts.

## Acceptance

- Opening 设置 shows the split page, defaulting to TypeSafe.
- Switching the left item changes only the right pane; values already typed stay in component state.
- Key save, list models, limits save, export, and backup still work.
- Drawer is no longer used for settings.
- e2e can open Settings from the rail and switch sections.
- 1440 and 390: no horizontal overflow; settings does not force the whole app to page-scroll on desktop.

## Verify

```sh
pnpm typecheck
pnpm test:e2e
```
