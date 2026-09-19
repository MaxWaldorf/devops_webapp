# AGENTS.md — DevOps / SDLC lifecycle explorer

Working notes for any agent (or human) picking this project up.

## What this is

A single-page interactive mockup of our software delivery lifecycle: an infinity
loop of eight DevOps stages, an editable model behind it, and a roadmap view.
Built as one Design Component: **`src/index.html`**.

Origin brief: recreate a classic DevOps infinity-loop diagram as vectors (loop
only, no third-party tool logos), full-bleed, with a focus animation per section
and toggleable layers for capabilities, coverage, tooling and roadmap.

## Files

**`src/` is the single source of truth.** Everything else is generated from it.

| Path | Role |
| --- | --- |
| `src/index.html` | The design (template + logic class). Edit this. |
| `src/vendor/` | DC runtime (`dc-support.js`), React 18.3.1 UMD, Nocturne `ds-bundle.js`. |
| `src/fonts/` | Inter (7 subsets, variable) + Phosphor icon font, woff2 only. |
| `tools/build.py` | Builds both deliverables from `src/` (stdlib Python) and `--check`s they match. |
| `Dockerfile`, `docker-compose.yml` | Container: build stage runs build + check, stock `nginx:stable-alpine` serves `dist/web` from its default location (no custom nginx config). |
| `Makefile`, `.dockerignore`, `.gitignore` | Shortcuts; keep `dist/` and `screenshots/` out of git and the image. |
| `dist/` | Generated, git-ignored. `dist/web/` (site) and `dist/standalone/devops-lifecycle.html` (single file). |

## Two deliverables, one source

- **Hosted site** — `docker compose up --build` → http://localhost:8080.
- **Local standalone** — `make standalone` → `dist/standalone/devops-lifecycle.html`;
  double-click it, works offline from `file://`. It is for local use only: it is
  **not** copied into the image, linked from the site, or otherwise distributed
  (`make check` fails if it ends up under `dist/web`).

They stay in sync **by construction**: the standalone is a purely mechanical inlining
of `src/index.html` (`<script src="vendor/…">` and `url(fonts/…)` become inline/data URIs);
there is no second copy of any logic. Both carry `<meta name="build-id">` = hash of all
of `src/`. `make check` (and the Docker build) fails if the ids or the inlining differ. Never edit `dist/`, and never fork behaviour between the two —
if something must differ, do it in `build.py`, not by hand.

Note: `localStorage` is per origin, so the model saved in the hosted site and in the
local file are separate. Move data between them with Editor → Save/Load JSON.

## Commands

| Command | Does |
| --- | --- |
| `make build` | Generate `dist/web` and `dist/standalone/devops-lifecycle.html`. |
| `make check` | Build, then verify both outputs match the source (build id, inlining, standalone not in the web package). |
| `make serve` | Preview `dist/web` at http://localhost:8080 (plain static server). |
| `make standalone` | Build and print the path of the single-file version. |
| `make run` / `make docker` | `docker compose up --build` / build the image only. |

Container notes: multi-stage (`python:alpine` builds and checks, `nginx:stable-alpine`
serves `dist/web` from `/usr/share/nginx/html` with the stock config). No custom
`nginx.conf`, so no explicit cache headers or gzip; nginx's default ETag/Last-Modified
revalidation applies. Add a config only if that becomes a problem. Changing anything
under `src/` changes the build id, so rebuild the image to ship it.

Verifying a change: run `make check`, then open **both** `dist/standalone/…html` (via
`file://`) and the served site, and click through all three tabs. Headless browsers
work (`--screenshot`, `--virtual-time-budget`).

## License

PolyForm Noncommercial 1.0.0 (`LICENSE`): free to share and use, **not** for commercial
use or integration into commercial products without the author's written consent.
Source-available, not open source. Bundled third-party parts keep their own licenses,
listed in `THIRD-PARTY-NOTICES.md`; update it when adding or replacing a vendored file.

## CI / releases

`.github/workflows/docker.yml` builds the container (which runs the sync check) for
`linux/amd64` and `linux/arm64` and publishes to GHCR as `ghcr.io/<owner>/<repo>`:

| Trigger | Result |
| --- | --- |
| PR into `main` | Build only, nothing pushed. |
| Push to `main` (direct or merged PR) | `:nightly` (moves) and `:nightly-<sha>`. |
| Tag `vX.Y.Z` | `:X.Y.Z`, `:X.Y`, `:latest`. |

Release: `git tag v1.2.3 && git push origin v1.2.3`. The workflow uses only
`GITHUB_TOKEN`; no secrets to configure. New GHCR packages are private by default —
change visibility in the package settings if you want it public (see the licence
caveat in `THIRD-PARTY-NOTICES.md` first).

## Design system

**Nocturne** is binding. Its tokens and component classes are inlined in the
`<helmet>` of `src/index.html` (namespace stub in `src/vendor/ds-bundle.js`); the old
`_ds/` folder no longer exists. Every colour, radius, shadow and font comes from its
`var(--*)` tokens. Dark ground `--color-bg`, one blurple accent used as line and glow, outlined buttons, no
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

- One DC file: `src/index.html`. Edit it directly, then `make check` and open both
  outputs. Do **not** hand-write `.jsx` or extra HTML pages. New local assets must live
  under `src/vendor/` or `src/fonts/` (the only paths `build.py` inlines) and be
  referenced as `vendor/…` / `fonts/…`; no CDN or other external URLs, so the
  standalone stays offline.
- Inline styles only; design-system classes (`.btn`, `.input`, `.card`, `.nav`,
  `.table`, `.tag`) are fine. `.input` is `width:100%` — any `.input` sitting
  directly in a flex row needs `width:auto;flex:none`.
- Template holes are dotted lookups only; compute everything in `renderVals()`.
- Never store anything in `localStorage` other than the model key above.
- Capability icons: the editor's type-to-search list is meant to read all ~1,530
  Phosphor names from a `<link href*="phosphor">` stylesheet at runtime. The
  Phosphor CSS is now inlined (no such `<link>`), so that fetch never runs and the
  editor always uses the curated `ICONS` array. Known gap: to restore the full list,
  read the names from the inlined stylesheet (`document.styleSheets`) in
  `componentDidMount` instead of fetching. Do not re-add a `<link>` to a CDN.

## Placeholders to replace with real data

Tool names, capability lists and highlight text are sample content. "Reset to
sample" regenerates them from the `SEED` table in the logic class.
