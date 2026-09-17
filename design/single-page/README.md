# Jev · 单页设计稿 / Single-page design preview

按用户最新反馈重做的信息架构。Coss UI视觉风格参考：[官方样式文档](https://coss.com/ui/docs/styling)。这是独立HTML交互稿，尚未替换React正式工作台，也没有接入真实Provider。

A bilingual, interactive design preview. It explores a simpler single-page interface inspired by Coss UI. It does not replace the production React workbench or call a provider.

## 打开 / Open

从项目根目录运行 / From the project root:

```sh
python3 -m http.server 17431 --bind 127.0.0.1 --directory design/single-page
```

Open http://127.0.0.1:17431. No dependencies are required. You can also open index.html directly; clipboard and browser storage availability depend on the browser.

## 可体验范围 / Interactions

- Noul / Choice / Score always visible; no page navigation.
- Primitive-specific configuration and results.
- Chinese / English toggle; edits are preserved when switching languages or primitives.
- Save draft to browser localStorage; reload to resume. No credentials are stored.
- Offline illustrative test states: normal, needs review, failure, empty input, stale result.
- Inline advanced settings, response JSON, release preview, HTTP / MCP / Pi examples.
- Responsive desktop and mobile layout; visible keyboard focus.

All results are illustrative. Changing a proposition does not run inference; publish and connect controls only preview the proposed interaction. There are no real releases, credentials or external writes.

## 验证 / Verification

With the local preview server running and project dependencies installed:

```sh
node scripts/check-design.mjs
```

Checks three primitives, language preservation, saved drafts, review/error/empty states, inline release/MCP examples, and overflow at 1440/768/390 px. Screenshots are saved to `.impeccable/review/single-page` (ignored by Git).

The production implementation remains in `apps/`. The design contract and integration boundary are in `specs/single-page/spec.md`.
