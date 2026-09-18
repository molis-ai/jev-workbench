# DropAgent visual language for the workbench UI

## Background and goal

The user asked to redesign and reorganise the whole front end, replicating the
display style of DropAgent (`~/code/agent-staging-area`) and keeping every
existing feature. They supplied a screenshot of DropAgent's dark workbench as
the reference.

The previous UI was a generic white/black admin layout: heavy card borders,
black primary buttons, a top bar that duplicated the left rail's navigation,
and a stylesheet grown to ~2.6k lines of per-breakpoint patches.

## Reference

Tokens come from DropAgent's own `macos/App/Palette.swift`, so light and dark
match the native app exactly:

| token | light | dark |
|---|---|---|
| panel (content pane) | `#fcfcfb` | `#19191b` |
| panel-2 (chrome, grouped rows) | `#f5f5f4` | `#111112` |
| hover / press | `#eeeeee` / `#e8e9ee` | `#242427` / `#28282f` |
| text / muted | `#292a2e` / `#74757d` | `#e9e9ed` / `#96969f` |
| line | `#e8e8e6` | `#2b2b2f` |
| accent / on-accent | `#66709e` / `#faf9f6` | `#a6afd5` / `#2b3142` |
| tones slate, blue, ochre, plum, clay | ink + fill per `IconTone` | idem |

Layout constants follow `agent-staging-area/DESIGN.md`: 48px top bar aligned
with the directory column, ~31px compact directory rows, content pane inset by
7px with a 9px radius and a 1px hairline, 30–36px controls at 8px radius,
180ms `cubic-bezier(.16, 1, .3, 1)` motion, mono uppercase section marks, and
colour restricted to small icons and type chips.

## Scope

- `style.css` rewritten from scratch around those tokens. Tailwind and
  `@tailwindcss/vite` are removed: no utility class was ever used, and the
  component layer is plain CSS over Radix primitives. This supersedes the
  "React + Vite + Tailwind CSS + shadcn/ui" line in specs/v1/spec.md.
- Shell: 48px top bar (brand, breadcrumb, provider pill, language, theme,
  settings) over a two-column body; the directory rail and an inset content
  pane. The old top-bar duplicates of rail navigation are gone.
- Theme: dark by default, light available from the top bar, persisted in
  `localStorage` under `jev-theme` via `data-theme` on `<html>`. CodeMirror is
  themed from the same tokens.
- Directory rows: primitive chip in a fixed left column, name, then status on a
  second line; the per-row overflow menu appears on hover or selection.
- Editor: page header, two stretched columns (define / preview) that scroll
  independently under sticky section marks, and a bottom action bar (versions,
  call history, cases, save draft, publish) in DropAgent's action-row style.
- Grouped rows (`.sheet` / `.sheet-row`) replace `.config-sheet`; they collapse
  to one column through a container query, so the same markup works in the
  narrow editor column and on the full-width settings page.
- Connections, Settings, API reference and drawers reuse the same primitives.

## Non-goals

- No API, data-model, permission or publishing change.
- No new screens or features; every control keeps its behaviour and label.
- No change to i18n mechanics (four new strings added to `en.json`).

## Acceptance

- Existing e2e story passes unchanged, including the 1440 / 1024 no-page-scroll
  assertions and the 390 no-horizontal-overflow assertion.
- Expanding advanced config scrolls only its own editor column.
- Light and dark both render the full app, including CodeMirror.
- `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

## Verify

```sh
pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```
