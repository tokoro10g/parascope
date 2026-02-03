---
sidebar_position: 2
---

# Testing

Parascope maintains a high level of code quality through comprehensive unit and end-to-end tests.

## Backend Tests

Backend tests use **pytest** and run in an isolated environment with a dedicated database.

### Running with Docker (Recommended)

The easiest way to run backend tests is using the dedicated test orchestration file. This handles the transient database and environment cleanup automatically.

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Running Locally

If you have a local PostgreSQL instance dedicated to testing:

1.  Set `DATABASE_URL` to your test database in `backend/.env`.
2.  Run the tests:
    ```bash
    cd backend
    uv run pytest
    ```

## End-to-End (E2E) Tests

E2E tests use **Playwright** to verify the full stack (Frontend + Backend + DB).

### Running in Docker

To run all E2E tests in a completely isolated environment:

```bash
docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e-runner
```

### Targeted Testing

You can run specific test files using the `PLAYWRIGHT_ARGS` environment variable:

```bash
PLAYWRIGHT_ARGS="tests/folders.spec.ts" docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e-runner
```

### Visual Debugging (Videos)

To record videos of the test execution (saved in `e2e/test-results/`), set `VIDEO=on`:

```bash
docker compose -f docker-compose.e2e.yml run -e VIDEO=on e2e-runner
```

## Continuous Integration

Every pull request triggers a CI pipeline (defined in `.github/workflows/ci.yml`) that executes:
1.  Frontend Linting and Build.
2.  Backend Linting (Ruff) and Unit Tests.
3.  Full E2E Test Suite.
