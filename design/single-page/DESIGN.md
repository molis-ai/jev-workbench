---
name: Jev Single-page Prototype
description: Standalone bilingual Coss UI-inspired design draft; not the production UI.
colors:
  ink: "#262626"
  page: "#fafafa"
  surface: "white"
  muted: "#666"
  help: "#737373"
  line: "rgba(0,0,0,.09)"
  field-border: "#d9d9d9"
  subtle: "#f5f5f5"
  selector: "#efefef"
  meter: "#525252"
  error-ink: "#9f2929"
  error-surface: "#fff5f5"
typography:
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
    fontSize: "14px"
  headline:
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-.7px"
  title:
    fontSize: "14px"
    fontWeight: 600
  label:
    fontSize: "13px"
    fontWeight: 500
  help:
    fontSize: "12px"
    lineHeight: 1.6
  value:
    fontSize: "32px"
    fontWeight: 550
    letterSpacing: "-1px"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "12px"
    lineHeight: 1.7
rounded:
  badge: "5px"
  control: "7px"
  toast: "8px"
  connect: "9px"
  selector: "10px"
  workbench: "12px"
spacing:
  selector-gap: "4px"
  label-gap: "8px"
  field-gap: "20px"
  panel-padding: "25px 28px 24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  field:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  workbench:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.workbench}"
---

# Design System: Jev Single-page Prototype

## Overview

This document describes only `design/single-page/index.html`, the interactive draft governed by `specs/single-page/spec.md`. It does not replace the root design system or the production interface in `apps`.

The direction is a quiet, neutral workbench inspired by Coss UI styling: small controls, thin borders, shallow shadows and a single uninterrupted configuration-to-test flow. The implementation is standalone HTML/CSS, not an integration of the official component library. Chinese and English share the same hierarchy.

## Colors

Charcoal carries primary actions and result emphasis. White surfaces sit on the near-white page; muted grays distinguish supporting text and separators. Red appears only in simulated error notices. Selected primitives use white fill and a visible border, rather than a new accent hue.

## Typography

The system font stack includes PingFang SC for Chinese; Inter is requested but not bundled. The title is 24px, section titles 14px, field labels 13px, and helper copy 12px. Numeric results use tabular numerals. Keys and code use monospace. At 600px and below, the page title becomes 21px.

## Layout

There is no sidebar or route navigation. A 65px header holds identity, draft status and language switching. The centered main area is capped at 1176px with 24px horizontal padding. Three equally sized primitive buttons remain visible above the workbench.

The desktop workbench has equal configuration and test columns, separated by a thin rule. Review settings expand inside configuration; publish/connect expands below the workbench. At 800px, spacing tightens and selector icons disappear. At 600px, the header becomes 58px, the workbench and connection area stack, and all three primitive buttons remain side by side. At 1450px and wider, main top padding increases to 45px.

## Elevation & Depth

Borders and tone define the layout. Standard buttons use `0 1px 2px #0000000a`; selected primitive buttons use `0 1px 3px #0000000a`. Dark buttons add an inset highlight. The toast is the only visibly floating surface. Focus uses a 2px gray outline with a 3px offset.

## Shapes

Controls use 7px corners, the selector tray 10px, and the workbench 12px. Thin outline icons accompany labels. Disclosure chevrons rotate 90 degrees over 0.18 seconds; reduced-motion preference disables transitions.

## Components

- **Primitive selector:** Noul, Choice and Score are always exposed. Selection swaps configuration and result presentation in place while retaining each draft.
- **Configuration:** labeled fields and editable option rows; review rules, threshold, model display and function key sit in an inline disclosure. Complex mappings and multiple questions are future production integration, not implemented editors here.
- **Test/result:** full-width dark test action; Noul uses a scalar meter, Choice category bars, and Score ordered stops. The UI labels example, simulated, stale and review states, with inline empty-input/error notices. Noul and Choice probability displays explicitly say probability is not accuracy.
- **Save/language:** manual browser-local draft saving; language switching replaces untouched examples while retaining edits. This is not server persistence.
- **Connect:** inline release preview and HTTP/MCP/Pi example switching. These create no release, credential or agent configuration.

## Do's and Don'ts

- Do keep the three primitives equally discoverable and keep editing/testing on the same page.
- Do preserve visible simulation labels, keyboard focus and bilingual text space.
- Do distinguish numbers, labels and review state without implying measured accuracy.
- Don't add a sidebar or separate navigation loop to this prototype.
- Don't treat this draft or its example code as proof that the production integration is complete.
