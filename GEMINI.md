# Gemini Code Assist Context

This file guides Gemini Code Assist agents on how to navigate and contribute to the Parascope project.

## 1. High-Level Overview
Parascope is a web-based engineering calculation tool using a node-based graph editor (DAG).
It allows users to define parameters and functions (Python code) to perform complex engineering calculations.
**Key Feature**: Sheets can be nested as functions within other sheets, requiring explicit Input/Output nodes.

## 2. Critical Documentation
Start by reading these files to understand the requirements and roadmap:
1.  **`SPECIFICATIONS.tsv`**: The source of truth for requirements. **Note**: This is a draft; agents can and should update this file upon approval to fix flaws or clarify details.
2.  **`SCENARIOS.md`**: Detailed user journeys explaining the intended workflow, especially for nesting and debugging.
3.  **`TODO.md`**: The current implementation plan and progress tracker.

## 3. Architecture & Stack
The project is a **Monorepo**.

### Backend
-   **Language**: Python
-   **Manager**: `uv`
-   **Linting**: `ruff`
-   **Libraries**: `networkx` (DAG), `numpy`/`scipy` (Calc), `google-genai` (AI)
-   **Database**: PostgreSQL.

### Frontend
-   **Framework**: React + Vite
-   **Manager**: `pnpm`
-   **Linting**: `biome`
-   **Graph Lib**: `rete.js` (read the documentation right now: https://retejs.org/llms-full.txt )

### Infrastructure
-   **Containerization**: Docker Compose (orchestrates Backend, Frontend, DB).

## 4. Development Workflow
-   Verify changes against `SPECIFICATIONS.tsv`. Update it if necessary.
-   Use absolute path for shell commands
-   Check `TODO.md` for the next task
-   Ask the user for feedback before starting working on a task
-   Make it clear if you are waiting for the user's feedback
-   Make a commit once in a while. Use Conventional Commits.
-   Do not leave any intermediate code or workaround before making a commit
-   As the formatter will change the code, please read the file before making changes.
-   Do not attempt to edit a large chunk of code at once. The tool does not understand ellipsis as smart as you are.
-   Again, DO NOT USE ELLIPSIS AND DO NOT ATTEMPT TO MAKE HUGE CHANGES AT ONCE.
-   Do not leave comments describing your detailed thought process in the code. Instead, ask the user if you are unsure about what to do.
-   Prefer modularization over monolithic code.
-   Frontend: Before making a commit, run `pnpm build` and `pnpm format` commands inside the `frontend` folder to ensure the code quality

## 5. Testing Philosophy & Structure
Parascope uses an isolated testing architecture to ensure reliability without side effects.

### Backend Tests
-   **Execution**: Always run tests using the dedicated test compose file:
    ```bash
    docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
    ```
-   **Isolation**: The test environment uses a separate `db-test` container with a `tmpfs` volume. Data is wiped after every run.
-   **Organization**: Tests are located in `backend/tests/api/` and organized by endpoint (e.g., `test_calculate.py`, `test_sheets.py`).
-   **Fixtures**: Use the `client` fixture from `conftest.py`. it provides a fresh database session per request to prevent state leakage.
-   **Error Handling**: 
    -   **Node-Level Errors** (Logic/Syntax): Use `NodeExecutionError`. These should return `200 OK` with detailed results so the frontend can highlight the failing node.
    -   **Graph-Level Errors** (Cycles/Structure): Use `GraphStructureError`. These should bubble up to trigger a global error (toast).
-   **Mandate**: Every new API feature or significant logic change MUST include corresponding unit tests in the appropriate `test_*.py` file.
