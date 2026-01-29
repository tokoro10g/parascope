# Parascope Gemini Context

This file serves as the primary source of truth and behavioral guidance for Gemini CLI.

## 1. Core Mandates (The Golden Rules)
- **Code First, Memory Second:** NEVER rely on memory or assumptions. Always `read_file` or `search_file_content` before making changes or answering technical questions.
- **Incremental Changes:** Do not attempt to edit large chunks of code at once. Use small, atomic tool calls.
- **No Ellipsis:** NEVER use `...` or placeholders in code blocks. Write the exact literal text.
- **Absolute Paths:** Use absolute paths for all shell commands.
- **Clean Commits:** No intermediate code or workarounds. Use Conventional Commits. Run `pnpm build` and `pnpm format` in the `frontend` folder before committing frontend changes.
- **No Self-Talk in Code:** Do not leave comments explaining your thought process. Ask the user directly if unsure.

## 2. Lessons Learned (Project Truths)
- **Execution Recovery:** Workers MUST be hard-killed (`process.kill()`) on timeout. `terminate()` is insufficient for processes stuck in infinite Python loops and causes thread starvation in the executor pool.
- **Nginx Timeouts:** Engineering calculations can be slow. Nginx `proxy_read_timeout` is set to `60s` to prevent premature connection drops.
- **E2E Stability:** Parallel E2E execution is preferred for speed but requires a robust backend (the `kill()` fix) to handle intentional timeouts without crashing the suite.
- **Schema Completeness:** Always verify that metadata fields like `description` or `versionTag` are explicitly added to Pydantic schemas, as they are not automatically exposed from JSONB fields.

## 3. Architecture Context Map
- **Backend Entry:** `backend/src/main.py` (API Prefixes: `/api/v1`)
- **Execution Engine:** `backend/src/core/execution.py` (Pool logic, sandboxing)
- **Calculation Logic:** `backend/src/core/calculation_service.py`
- **Schemas:** `backend/src/schemas/sheet.py`
- **Frontend Logic:** `frontend/src/rete/` (Graph interaction), `frontend/src/api.ts` (API Client)
- **E2E Utils:** `e2e/tests/utils/graph-utils.ts`

## 4. Roadmap & TODOs

### Completed Logic & Core
- [x] **Hardened Execution:** Immediate recovery on timeout via worker hard-kill.
- [x] **Metadata Propagation:** `description` and `versionTag` correctly returned by API.
- [x] **Infra Optimization:** Consolidated Nginx proxy and parallel E2E execution.

### Active Priorities
- [ ] **Utility Expansion:** Add `deleteNode` and `renamePort` helpers to `graph-utils.ts`.
- [ ] **Graph Integrity:** Validate function dependencies before saving (prevent invalid port states).
- [ ] **Feedback Loop:** Implement a Console/Log viewer for the selected node's detailed execution output.
- [ ] **Advanced Math:** Support numerical optimization (Scipy integrate) and overflow handling.
- [ ] **IDE Features:** Add Python code completion in the Function Editor.