# DevOps lifecycle explorer

An interactive mockup of our software delivery lifecycle: an infinity loop of eight
DevOps stages, an editable model behind it, and a roadmap view. Vector only, no
third-party tool logos, works offline.

## Views

| Tab | What it does |
| --- | --- |
| **Lifecycle** | The loop. Focus auto-cycles through the stages, hover overrides it, click opens a detail panel. Layer toggles: core capabilities, coverage, tooling. Coverage also enables the readiness timeline slider. Below 900px viewport width the loop is hidden and only the stage cards are shown. |
| **Roadmap** | One horizontal section per stage: readiness per quarter, highlights per quarter (edited in place, on a tinted band), and a timeline row per tool with free-text notes. |
| **Editor** | Edit the model: timeline range, stages and capabilities, tools table (with a note per tool→capability assignment), Save/Load JSON. |

Readiness is derived from the model, never stored: a capability takes the best status
among its tools at the selected quarter, and a stage's percentage is the mean of its
capabilities. Tool names, capabilities and highlights are sample content; use
Editor → "Reset to sample" or load your own JSON.

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
| `src/vendor/`, `src/fonts/` | Vendored React, DC runtime, design-system bundle, Phosphor icon-name list, Inter and Phosphor fonts. |
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
