# DevOps lifecycle explorer

An interactive mockup of our software delivery lifecycle: an infinity loop of eight
DevOps stages, an editable model behind it, and a roadmap view. Vector only, no
third-party tool logos, works offline.

## Views

| Tab | What it does |
| --- | --- |
| **Lifecycle** | The loop. Focus auto-cycles through the stages, hover overrides it, click opens a detail panel. Layer toggles: core capabilities, coverage, tooling. Coverage also enables the readiness timeline slider. Below 900px viewport width the loop is hidden and only the stage cards are shown. |
| **Roadmap** | Switch between an SDLC roadmap grouped by stage and a Tools roadmap grouped by tool. Both show quarterly capability coverage and editable free-text notes; the SDLC view also shows stage readiness and highlights. |
| **Editor** | Edit the model: timeline range, stages and capabilities, tools table (with a note per tool→capability assignment), Save/Load JSON. |

Readiness is derived from the model, never stored: a capability takes the best status
among its tools at the selected quarter, and a stage's percentage is the mean of its
capabilities. Tool names, capabilities and highlights are sample content; use
Editor → "Reset to sample" or load your own JSON.

### Export

The **Export** menu (top right on every tab; in the ☰ menu on phones) offers a PDF document
or a PowerPoint deck. Both are the same 16:9 deck built from the current model: a cover, the
lifecycle loop with one card per stage (capabilities and tools, no coverage), then one slide
per stage (SDLC roadmap) and per tool (Tools roadmap) at the end quarter of the range. In the
PPTX every element is a native, editable PowerPoint shape or text box (only the small
Phosphor icons are images); the PDF draws the same layout as images. Roadmap notes use the
largest size (14 down to 11.5px) at which a stage or tool fits one slide; if it doesn't fit,
it continues on further slides. Text is set in Inter, so install Inter to get the exact look
in PowerPoint.

## Quick start

Requires Python 3 (build) and optionally Docker (hosted image).

| Command | Does |
| --- | --- |
| `make build` | Generate `dist/web` and `dist/standalone/devops-lifecycle.html` from `src/`. |
| `make check` | Build, verify both outputs match the source. |
| `make lint` | Lint `src/styles.css` (stylelint) and `src/index.html` (html-validate). Needs Node; installs dev tools from `package.json`. |
| `make serve` | Preview the site at http://localhost:8080. |
| `make standalone` | Build and print the path of the single-file version (double-click to open, works from `file://`). |
| `make run` | `docker compose up --build`, served at http://localhost:8080. |
| `make docker` | Build the container image only. |
| `make clean` | Remove `dist/`. |

The standalone file is for local use only and is never part of the hosted image.

## Project layout

| Path | Role |
| --- | --- |
| `src/index.html` | The whole design (template and logic). The single source of truth; edit this. |
| `src/styles.css` | Design-system tokens, component classes, font faces, base styles and the template's static styling; only data-driven styles stay inline in `index.html` (separate file on the hosted site, inlined into the standalone). |
| `src/vendor/`, `src/fonts/` | Vendored React, DC runtime, design-system bundle, Phosphor icon-name list, PptxGenJS/JSZip/jsPDF (export), Inter and Phosphor fonts. |
| `tools/build.py` | Builds the site and the standalone file and checks they match. |
| `tools/server.py` | Static server plus the per-browser `/api/model` store (used by `make serve` and the image). |
| `Dockerfile`, `docker-compose.yml` | Build stage runs build and check; the runtime image serves `dist/web` plus the model API with `tools/server.py`. |
| `package.json`, `.stylelintrc.json`, `.htmlvalidate.json` | Dev-only lint tooling and its rules (the app has no Node dependencies). |
| `renovate.json` | Renovate config: weekly dependency PRs (Actions, base image, dev tools); only patch updates automerge. |
| `AGENTS.md` | Detailed working notes for contributors and agents. |

`dist/` is generated and git-ignored; never edit it.

## Data model

On the hosted site the model (schema 6) is stored **server-side**, one JSON file per
browser under `DATA_DIR` (`/data` in the container, the `devops-data` volume in compose),
keyed by a random `cid` cookie via `GET/PUT /api/model` (`tools/server.py`). A returning
browser gets its model back; there are no accounts, so clearing cookies or switching
browser starts fresh. The standalone `file://` build, or any static server without the
API, falls back to `localStorage` under `devops-loop-model-v3`. The model can also be
exported and imported as JSON from the Editor tab; use that to move data between them.
Quarter keys are absolute (`"YYYY-Qn"`), so changing the timeline range never loses data.
Each tool lists its capabilities, and every tool→capability assignment carries its own current coverage state, start and end quarter, an optional free-text remark (Editor), and its own roadmap notes (a note line can be copied to the tool's other capabilities from the Roadmap tab). Older models are migrated on load.
Full details are in [AGENTS.md](AGENTS.md).

## Releases and CI

`.github/workflows/docker.yml` builds `linux/amd64` and `linux/arm64` images to
`ghcr.io/<owner>/<repo>`:

| Trigger | Result |
| --- | --- |
| Pull request into `main` | Build only, nothing pushed. |
| Push to `main` | `:nightly` and `:nightly-<sha>`. |
| Tag `vX.Y.Z` | `:X.Y.Z`, `:X.Y`, `:latest`. |

Release: `git tag v1.2.3 && git push origin v1.2.3`.

Dependencies (GitHub Actions, the `python` base image, dev lint tools) are kept current by
[Renovate](https://docs.renovatebot.com/) via `renovate.json`: weekly PRs, and only **patch**
updates automerge once the CI build passes; minor and major updates wait for a manual review.
The vendored files in `src/vendor/` and `src/fonts/` are not tracked and are updated by hand.

## License

[PolyForm Noncommercial 1.0.0](LICENSE): free to share and use, not for commercial use
without the author's written consent. Bundled third-party parts keep their own licenses,
see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
