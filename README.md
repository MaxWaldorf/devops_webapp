# DevOps lifecycle explorer

An interactive mockup of our software delivery lifecycle: an infinity loop of eight
DevOps stages, an editable model behind it, and a roadmap view. Vector only, no
third-party tool logos, works offline.

## Views

| Tab | What it does |
| --- | --- |
| **Lifecycle** | The loop. Focus auto-cycles through the stages, hover overrides it, click opens a detail panel. Layer toggles: core capabilities, coverage, tooling. Coverage also enables the readiness timeline slider. |
| **Roadmap** | One horizontal section per stage: readiness per quarter, highlights, and a timeline row per tool with free-text notes. |
| **Editor** | Edit the model: timeline range, stages and capabilities, tools table, Save/Load JSON. |

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
| `src/vendor/`, `src/fonts/` | Vendored React, DC runtime, design-system bundle, Inter and Phosphor fonts. |
| `tools/build.py` | Builds the site and the standalone file and checks they match. |
| `Dockerfile`, `docker-compose.yml` | Build stage runs build and check; stock nginx serves `dist/web`. |
| `AGENTS.md` | Detailed working notes for contributors and agents. |

`dist/` is generated and git-ignored; never edit it.

## Data model

The model lives in `localStorage` under `devops-loop-model-v3` (schema 4) and can be
exported and imported as JSON from the Editor tab. Storage is per origin, so the hosted
site and the local file keep separate models; move data between them with Save/Load JSON.
Quarter keys are absolute (`"YYYY-Qn"`), so changing the timeline range never loses data.
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

## License

[PolyForm Noncommercial 1.0.0](LICENSE): free to share and use, not for commercial use
without the author's written consent. Bundled third-party parts keep their own licenses,
see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
