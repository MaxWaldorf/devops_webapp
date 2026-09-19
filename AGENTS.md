# AGENTS.md — DevOps / SDLC lifecycle explorer

Working notes for any agent (or human) picking this project up.

## What this is

A single-page interactive mockup of our software delivery lifecycle: an infinity
loop of eight DevOps stages, an editable model behind it, and a roadmap view.
Built as one Design Component: **`DevOps Lifecycle.dc.html`**.

Origin brief: recreate a classic DevOps infinity-loop diagram as vectors (loop
only, no third-party tool logos), full-bleed, with a focus animation per section
and toggleable layers for capabilities, coverage, tooling and roadmap.

## Files

| File | Role |
| --- | --- |
| `DevOps Lifecycle.dc.html` | The design. Everything lives here (template + logic class). |
| `DevOps Lifecycle export.dc.html` | Copy of the above **plus** the `<template id="__bundler_thumbnail">` splash, used only as the bundler input. Regenerate by re-copying the source and re-adding the template. |
| `DevOps Lifecycle.html` | Bundled standalone export (offline, ~2.7 MB). Never edit — rebuild it. |
| `_ds/nocturne-…/` | Bound Nocturne design system (stylesheet + bundle). |
| `screenshots/` | Scratch captures from development. Disposable. |

## Design system

**Nocturne** (`_ds/nocturne-9095ebf2-29aa-41bf-ab12-54317f3262d9/`) is binding.
Every colour, radius, shadow and font comes from its `var(--*)` tokens; the
stylesheet and `_ds_bundle.js` are loaded in `<helmet>`. Dark ground
`--color-bg`, one blurple accent used as line and glow, outlined buttons, no
saturated floods. Icons are **Phosphor** (`@phosphor-icons/web@2.1.1`, `<i class="ph ph-…">`).

## The three tabs

1. **Lifecycle** — the loop. A Gerono lemniscate sampled in JS into 8 arc
   segments (`seg(i)` in the logic class, viewBox `0 0 1600 600`, `A/B/CX/CY`
   constants). Stage pills are HTML positioned over the SVG at percentage
   coordinates derived from the same geometry. Focus auto-cycles, hover
   overrides, click opens the centre detail panel. A traveling pulse runs the
   full path via the Web Animations API (length measured with `getTotalLength`,
   so it never jumps). Layer toggles: Core capabilities, Coverage, Tooling.
   The Coverage layer also gates the readiness timeline slider.
2. **Roadmap** — one horizontal section per stage: stage readiness line per
   quarter (same colour/dash scale as the loop), highlights per quarter, then a
   sub-section per capability with one timeline row per tool. Each tool/quarter
   cell holds a free-text note (click to edit, one bullet per line).
3. **Editor** (styled with the neutral ramp so it reads as a tool tab) — the
   model editor: timeline range, stages & capabilities, tools table,
   Save/Load JSON.

## Data model

Held in component state, persisted to `localStorage` under **`devops-loop-model-v3`**,
`schema: 4`.

```js
{
  schema: 4,
  range: { sq: 4, sy: 2026, eq: 4, ey: 2027 },   // start/end quarter+year
  stages: [                                       // exactly 8, names+icons fixed
    { name, icon, caps: [{ id, label, icon }], highlights: { "2027-Q1": "line\nline" } }
  ],
  tools: [
    { id, name, caps: [capId], cov: "c"|"p"|"n"|"x",
      startQ: "2027-Q1"|null, endQ: "2027-Q3"|null,
      notes: { "2027-Q2": "line\nline" } }
  ]
}
```

Rules that matter:

- **Quarter keys are absolute** (`"YYYY-Qn"`). Highlights, notes and tool dates
  stay attached to their real quarter when the range moves. `qKey(range, i)` /
  `qIndex(range, key)` convert to and from stop indices; `migrate()` upgrades
  older index-keyed models (and is applied on load *and* on JSON import).
- **Stop 0 is the start quarter**, labelled "Today" — there is no separate
  synthetic Today stop.
- **Readiness is derived, never stored.** A capability takes the best status
  among its tools at the selected quarter (`c > p > n`; `x` only if all its
  tools are out of scope; no tools = not covered). Stage % = mean of its
  capabilities with covered 1, partial 0.5, not covered 0, out-of-scope
  excluded. The loop stroke colour/dash reads that %: ≥95 solid light accent,
  ≥70 solid, ≥45 long dash, ≥20 short dash, else fine grey dots.
- **Tool coverage over time**: `Covered` always; `Partially` until `endQ` then
  covered; `Not covered` until `startQ` (then partial) and covered from `endQ`;
  `Not in scope` never changes.
- **Completeness** of a tool row = name + ≥1 capability + coverage state.
  Dates are optional; incomplete rows are dimmed and labelled "Needs …".
- **Range changes are non-destructive**: out-of-range dates and highlights are
  kept in the model and simply hidden (selects show "—").

Save JSON writes `{ format: "devops-loop", version: 4, model }`; Load accepts
that wrapper or a bare model, validates the shape, migrates, then saves.

## Conventions to keep

- One DC file. Author with `dc_write` / `dc_html_str_replace` / `dc_js_str_replace`.
  Do **not** hand-write `.jsx` or extra HTML pages.
  (Caution learned the hard way: don't interleave `dc_js_str_replace` and
  `run_script` edits to the same file in one turn — they can race and corrupt
  the logic block. Pick one tool per turn.)
- Inline styles only; design-system classes (`.btn`, `.input`, `.card`, `.nav`,
  `.table`, `.tag`) are fine. `.input` is `width:100%` — any `.input` sitting
  directly in a flex row needs `width:auto;flex:none`.
- Template holes are dotted lookups only; compute everything in `renderVals()`.
- Never store anything in `localStorage` other than the model key above.
- Capability icons: the editor reads all ~1,530 Phosphor names from the
  stylesheet at runtime and offers a type-to-search list; it falls back to a
  curated `ICONS` array if the fetch fails.

## Placeholders to replace with real data

Tool names, capability lists and highlight text are sample content. "Reset to
sample" regenerates them from the `SEED` table in the logic class.

## Rebuilding the standalone export

1. Copy `DevOps Lifecycle.dc.html` → `DevOps Lifecycle export.dc.html`.
2. Re-insert the `<template id="__bundler_thumbnail" data-bg-color="#161826">` splash after the `support.js` script tag.
3. `super_inline_html` → `DevOps Lifecycle.html`, then hand it over with a download card.
