---
sidebar_position: 1
---

# Development Setup

The recommended way to develop Parascope is using the provided **Docker Compose** environment. This setup provides a consistent environment with all dependencies pre-configured and hot-reloading enabled for both the frontend and backend.

## Prerequisites

*   **Docker** and **Docker Compose** installed and running.
*   **Git** for version control.

## Getting Started (Docker Dev Mode)

1.  **Configure Environment**:
    Copy the example environment file to `.env` in the root directory.
    ```bash
    cp .env.example .env
    ```

2.  **Start Development Containers**:
    ```bash
    docker compose up --build
    ```

### Why use Docker for development?

*   **Hot Reloading**: Changes in `frontend/src` or `backend/src` are automatically detected and reflected in the running application without manual restarts.
*   **Integrated Environment**: PostgreSQL and the worker pool are automatically set up and seeded with example data.
*   **Shared Libraries**: The `parascope-runtime` package is mounted as an editable install, so changes in the shared runtime are immediately reflected in the backend.
*   **Consistency**: Every developer works in the exact same environment, minimizing configuration issues.

## Common Development Tasks

### Viewing Logs

To stream logs from all services:
```bash
docker compose logs -f
```

To see logs for a specific service (e.g., the backend execution engine):
```bash
docker compose logs -f backend
```

### Entering a Container

To run commands inside the backend container (e.g., manual database operations):
```bash
docker compose exec backend bash
```

### Resetting the Environment

To clear all data (including the database volume) and restart fresh:
```bash
docker compose down -v
docker compose up --build
```

### Linting & Formatting

Maintaining consistent code style is important. We use automated tools for both parts of the stack.

#### Backend (Ruff)
Ruff handles linting, import sorting, and formatting for Python code.
```bash
cd backend
uv run ruff check .        # Check for issues
uv run ruff check --fix .  # Fix issues and sort imports
uv run ruff format .       # Format code
```

#### Frontend (Biome)
Biome handles linting and formatting for the TypeScript frontend.
```bash
cd frontend
pnpm lint    # Check for issues
pnpm format  # Fix issues and format code
```

---

## Alternative: Manual Local Setup

For power users who prefer running services directly on their host machine:

### Backend
1.  Requires **Python 3.12** and **uv**.
2.  Install locked dependencies: `cd backend && uv sync --locked`. This also installs the local runtime as an editable dependency.
3.  Run migrations: `uv run alembic upgrade head`.
4.  Start: `uv run python src/main.py`.

### Frontend
1.  Requires **Node.js 24** and **pnpm 12.14.0**, pinned in `package.json`.
2.  Install dependencies: `cd frontend && pnpm install --frozen-lockfile`.
3.  Start: `pnpm dev` (Runs on [http://localhost:5173](http://localhost:5173)).

## Dependency Management

### Python lockfiles

Commit both `backend/uv.lock` and `packages/parascope-runtime/uv.lock`.
Each project has its own lockfile; update the runtime lockfile as well as the
backend lockfile when changing shared runtime dependencies.

CI uses Python 3.12 and uv 0.13.1. Lint commands use `uv run --locked`, and
backend images use `uv sync --locked`, so stale lockfiles fail instead of being
silently rewritten. Production excludes development dependencies; the test
runner explicitly installs the locked `test` extra. Container environments live
at `/opt/venv` so source bind mounts do not hide the installed dependencies.

To intentionally update dependencies, run `uv lock --upgrade-package PACKAGE`
inside the relevant Python project and commit the resulting lockfile. Use
`uv lock` after changing a manifest, then validate with `uv lock --check`.

### JavaScript dependency policy

The frontend, documentation, and E2E projects each keep their own pnpm lockfile
and `pnpm-workspace.yaml`. All three use pnpm 12.14.0 and the same policy:

* `minimumReleaseAge: 10080` means **seven days**, expressed in minutes
  (`7 * 24 * 60`). This applies to direct and transitive dependencies, including
  verification of locked versions during installation.
* Strict release-age checks reject immature versions rather than automatically
  adding exceptions. Missing publication timestamps are also rejected.
* `trustPolicy: no-downgrade` rejects reduced publication trust compared with
  earlier-published releases, even across major-version lines. Narrow exceptions
  cover existing legacy `semver@6.3.1` and, in docs, `detect-port@1.6.1` releases
  without provenance. These exceptions do not cover future versions.
* `blockExoticSubdeps: true` blocks Git and direct-tarball transitive sources.
* `strictDepBuilds: true` requires an explicit build-script decision. Only
  frontend `esbuild` builds are approved; `rete` and the documentation's
  `core-js` scripts are explicitly denied. Review new scripts before changing
  `allowBuilds`; do not globally enable dependency scripts.

For normal upgrades, use `pnpm update` inside the appropriate project and commit
the manifest, lockfile, and any reviewed policy changes. Renovate also waits
seven days before proposing npm updates.

The pnpm 12 lockfiles contain two YAML documents: package-manager dependencies
first, then application dependencies. Keep both documents committed, and ensure
any lockfile scanners read both rather than reporting an empty dependency graph.

### Urgent security fixes

The [security update workflow](https://github.com/tokoro10g/parascope/blob/main/.github/workflows/security-updates.yml)
runs daily and can be dispatched manually. It uses `pnpm audit --fix=override` to generate
overrides and **exact patched-version** `minimumReleaseAgeExclude` entries for
known vulnerability fixes, then opens a PR per affected JavaScript project.
All advisory severities are eligible for this automatic exception; it does not
auto-merge or bypass provenance checks, build approvals, or normal PR checks.
Registry errors fail the workflow, and a final audit reports any remaining
vulnerabilities, including those without a published fix.

Repository administrators must configure `SECURITY_UPDATES_TOKEN` as a bot token
with repository **Contents: write** and **Pull requests: write** permissions.
Unlike the default `GITHUB_TOKEN`, this allows the generated PRs to trigger CI.
Until configured, the workflow fails with an explicit setup error.

Renovate's immediate vulnerability PRs additionally require GitHub's dependency
graph and Dependabot alerts to be enabled, with alert read access for Renovate.
The pnpm audit workflow does not depend on those GitHub features.

For an immediate local fix:

```bash
pnpm audit --fix=override
pnpm install --no-frozen-lockfile
pnpm audit
```

Review and commit both the policy changes and lockfile. Remove obsolete
release-age exceptions once the release has passed the seven-day window.