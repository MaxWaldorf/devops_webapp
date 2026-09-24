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
| `src/styles.css` | Nocturne tokens/component classes, `@font-face` (Inter, Phosphor), page base styles, `u-…` utilities and `c-…` classes for the template's static styling. Linked from `<head>`. |
| `src/vendor/` | DC runtime (`dc-support.js`), React 18.3.1 UMD, Nocturne `ds-bundle.js`. |
| `src/fonts/` | Inter (7 subsets, variable) + Phosphor icon font, woff2 only. |
| `README.md` | Public overview. Keep it current (see Conventions). |
| `tools/build.py` | Builds both deliverables from `src/` (stdlib Python) and `--check`s they match. |
| `tools/server.py` | Stdlib static server + per-browser model API (`/api/model`, `cid` cookie, files in `DATA_DIR`). |
| `Dockerfile`, `docker-compose.yml` | Container: build stage runs build + check, `python:alpine` runs `tools/server.py` serving `dist/web`; model files in the `/data` volume. |
| `renovate.json` | Renovate: weekly PRs for Actions, base image and dev tools; **only patch updates automerge**, minor/major need manual review. Vendored files aren't tracked. |
| `Makefile`, `.dockerignore`, `.gitignore` | Shortcuts; keep `dist/`, `screenshots/`, `.data/` and `node_modules/` out of git and the image. |
| `package.json`, `.stylelintrc.json`, `.htmlvalidate.json` | Dev-only lint tooling and rules for `make lint` (Node). The app itself has no Node dependencies. |
| `dist/` | Generated, git-ignored. `dist/web/` (site) and `dist/standalone/devops-lifecycle.html` (single file). |

## Two deliverables, one source

- **Hosted site** — `docker compose up --build` → http://localhost:8080. Models persist in the `devops-data` volume (`/data`).
- **Local standalone** — `make standalone` → `dist/standalone/devops-lifecycle.html`;
  double-click it, works offline from `file://`. It is for local use only: it is
  **not** copied into the image, linked from the site, or otherwise distributed
  (`make check` fails if it ends up under `dist/web`).

They stay in sync **by construction**: the standalone is a purely mechanical inlining
of `src/index.html` (`<script src="vendor/…">`, `<link rel="stylesheet" href="styles.css">` and `url(fonts/…)` become inline/data URIs);
there is no second copy of any logic. Both carry `<meta name="build-id">` = hash of all
of `src/`. `make check` (and the Docker build) fails if the ids or the inlining differ. Never edit `dist/`, and never fork behaviour between the two —
if something must differ, do it in `build.py`, not by hand.

Where the model is saved differs by design, not by code: the hosted site stores it
server-side per browser (see Data model), the standalone (`file://`) uses `localStorage`.
The two are separate; move data between them with Editor → Save/Load JSON. Same code,
the client just picks the store at runtime.

## Commands

| Command | Does |
| --- | --- |
| `make build` | Generate `dist/web` and `dist/standalone/devops-lifecycle.html`. |
| `make check` | Build, then verify both outputs match the source (build id, inlining, standalone not in the web package). |
| `make lint` | stylelint on `src/styles.css`, html-validate on `src/index.html` (Node dev tools via `package.json`; keep it clean before finishing a change). |
| `make serve` | Preview `dist/web` at http://localhost:8080 with `tools/server.py` (static + `/api/model`, data in git-ignored `.data/`). |
| `make standalone` | Build and print the path of the single-file version. |
| `make run` / `make docker` | `docker compose up --build` / build the image only. |

Container notes: multi-stage (`python:alpine` builds and checks, a second `python:alpine`
runs `tools/server.py`). No gzip/cache tuning; put a reverse proxy in front if needed
(it should send `X-Forwarded-Proto` so the cookie gets `Secure`). Changing anything
under `src/` changes the build id, so rebuild the image to ship it.

Verifying a change: run `make lint` and `make check`, then open **both**
`dist/standalone/…html` (via `file://`) and the served site, and click through all three
tabs. Headless browsers
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

**Nocturne** is binding. Its tokens and component classes live in
`src/styles.css` (namespace stub in `src/vendor/ds-bundle.js`); the old
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
   Below 900px (`matchMedia`, `narrow` state) the loop, pills and centre panel are
   not rendered; the stage-card grid underneath (which carries the same info) remains.
2. **Roadmap** — one horizontal section per stage: stage readiness line per
   quarter (same colour/dash scale as the loop), highlights per quarter (click a
   cell to edit, one bullet per line; the row sits on a tinted band, `c-hl-band`), then a
   sub-section per capability with one timeline row per tool. Each tool/quarter
   cell holds a free-text note per tool *and capability* (click to edit, one bullet per line); each line has a copy button to append it to the same tool's other capabilities ("Copy to X" / "Copy to all").
3. **Editor** (styled with the neutral ramp so it reads as a tool tab) — the
   model editor: timeline range, stages & capabilities, tools table (each
   tool→capability assignment has a free-text Note field, stored as `remark`),
   Save/Load JSON. Highlights are edited on the Roadmap tab, not here.

## Data model

Held in component state, `schema: 6`. Persistence: over http(s) with `/api/model`
present it is stored **server-side per browser** (cookie `cid`, debounced PUT, no
localStorage); on `file://` or without the API it falls back to `localStorage` key
**`devops-loop-model-v3`**.

Server API (`tools/server.py`): `GET /api/model` → `{ "model": <model|null> }`, and sets the
`cid` cookie (random 32-hex, HttpOnly, 10 years) on first contact; `PUT /api/model` stores
the body (must have 8 `stages` and a `tools` array, max 2 MB) as `DATA_DIR/<cid>.json`,
atomically. No accounts: clearing cookies or switching browser starts a fresh model. The
client (`initStore()` / `persist()` in the logic class) asks the API first and falls back
to `localStorage` if it is absent or `file://`; edits made before the first response are
kept and pushed, not overwritten. Nothing is written until the first edit, so a browser
that never edits keeps getting the seed.

```js
{
  schema: 4,
  range: { sq: 4, sy: 2026, eq: 4, ey: 2027 },   // start/end quarter+year
  stages: [                                       // exactly 8, names+icons fixed
    { name, icon, caps: [{ id, label, icon }], highlights: { "2027-Q1": "line\nline" } }
  ],
  tools: [
    { id, name,
      caps: [{ id: capId, cov: "c"|"p"|"n"|"x",           // one entry per assigned capability
               startQ: "2027-Q1"|null, endQ: "2027-Q3"|null,
               remark: "free text",                   // optional, Editor "Note" column
               notes: { "2027-Q2": "line\nline" } }] }   // independent per capability
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
- **Tool coverage over time** (per tool→capability assignment, not per tool): `Covered` always; `Partially` until `endQ` then
  covered; `Not covered` until `startQ` (then partial) and covered from `endQ`;
  `Not in scope` never changes.
- **Completeness** of a tool row = name + ≥1 capability (each assignment always has a
  coverage state). Dates are optional; the Check column shows Valid (green) or Invalid (red, with "Needs …" below) and invalid rows are dimmed.
- **Range changes are non-destructive**: out-of-range dates and highlights are
  kept in the model and simply hidden (selects show "—").

Save JSON writes `{ format: "devops-loop", version: 6, model }`; Load accepts
that wrapper or a bare model, validates the shape, migrates, then saves.

## Conventions to keep

- **Keep `README.md` in sync.** Any change to commands, Makefile targets, tabs, files in
  `tools/`, the data model / storage key / schema, CI or licensing must update `README.md`
  in the same change. Before finishing any task, re-read `README.md` and confirm it is still accurate.

- One DC file: `src/index.html`. Edit it directly, then `make lint`, `make check` and
  open both outputs. Do **not** hand-write `.jsx` or extra HTML pages. New local assets
  must live under `src/vendor/` or `src/fonts/` (or be `src/styles.css`); those are the
  only paths `build.py` inlines. Reference them as `vendor/…` / `fonts/…` / `styles.css`;
  no CDN or other external URLs, so the standalone stays offline.
- Styling: static styles live in `src/styles.css` (Nocturne classes, `@font-face`,
  base styles, then at the end `u-…` single-declaration utilities and `c-…` classes for
  the template's remaining static declarations). Only declarations containing a `{{…}}`
  hole stay as inline `style=` attributes. Add new static styles to the CSS, not inline.
  The hosted site loads it as a cache-busted `styles.css?v=<build id>`; the standalone
  inlines it. Design-system classes (`.btn`, `.input`, `.card`, `.nav`, `.table`, `.tag`)
  are fine. `.input` is `width:100%` — any `.input` sitting directly in a flex row needs
  `width:auto;flex:none`. Utilities and `c-…` classes come after the design-system rules,
  so they override them like inline styles did (but not `:hover`/`:focus` rules).
- Lint: `make lint` (stylelint standard config, html-validate) must stay clean. Buttons
  need `type`, icon-only buttons an `aria-label`, inputs a `type`. The rules turned off
  in `.stylelintrc.json` / `.htmlvalidate.json` are deliberate (generated class names,
  vendor Phosphor CSS, custom template elements and `{{…}}` placeholders).
- Template holes are dotted lookups only; compute everything in `renderVals()`.
- Never store anything in `localStorage` other than the model key above (and only in the fallback mode).
- Capability icons: the editor's type-to-search list is meant to read all ~1,530
  Phosphor names from a `<link href*="phosphor">` stylesheet at runtime. The
  Phosphor CSS now lives in `src/styles.css` (no such `<link>`), so that fetch never runs
  and the editor always uses the curated `ICONS` array. Known gap: to restore the full
  list, read the names from the loaded stylesheet (`document.styleSheets`) in
  `componentDidMount` instead of fetching. Do not re-add a `<link>` to a CDN.

## Placeholders to replace with real data

Tool names, capability lists and highlight text are sample content. "Reset to
sample" regenerates them from the `SEED` table in the logic class.
