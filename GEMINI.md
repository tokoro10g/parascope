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
-   Frontend: Before making a commit, run `pnpm build` and `pnpm format` commands inside the `frontend` folder to ensure the code quality
