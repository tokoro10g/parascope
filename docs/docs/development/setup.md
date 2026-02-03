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

---

## Alternative: Manual Local Setup

For power users who prefer running services directly on their host machine:

### Backend
1.  Requires **Python 3.12** and **uv**.
2.  Install dependencies: `cd backend && uv venv && uv pip install -e . -e ../packages/parascope-runtime`.
3.  Run migrations: `uv run alembic upgrade head`.
4.  Start: `uv run python src/main.py`.

### Frontend
1.  Requires **Node.js >= 24** and **pnpm**.
2.  Install dependencies: `cd frontend && pnpm install`.
3.  Start: `pnpm dev` (Runs on [http://localhost:5173](http://localhost:5173)).