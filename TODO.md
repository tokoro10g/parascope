# Parascope Implementation Plan

Generated from `SPECIFICATIONS.tsv`.

## 1. Infrastructure & Tooling (Core Tooling)
- [ ] **Repository**: Set up Monorepo structure (T-DEV-04.0).
- [ ] **Containerization**: Configure Docker Compose for Backend and Frontend (T-DEV-03.0).
- [ ] **Backend Setup**: Initialize Python project with `uv` (T-BE-01.0, T-DEV-02.0).
- [ ] **Frontend Setup**: Initialize Vite + React project with `pnpm` (T-FE-01.0, T-DEV-02.0).
- [ ] **Database**: Provision PostgreSQL instance (T-BE-02.0).
- [ ] **Quality Control**: Configure `ruff` (Python) and `biome` (JS/TS) (T-DEV-01.0).

## 2. Backend Core (Initial Release)
- [ ] **Data Models**: Design schemas for Sheets, Functions, Parameters, Input/Output Nodes, and Values (DH-01.0, DH-02.0).
    - [ ] Use UUIDs for all entity primary keys (DH-04.0).
- [ ] **API**: Create endpoints for saving/loading graphs and values (DH-01.0, DH-02.0).
    - [ ] Create endpoint for listing sheets by owner (DH-05.0).
    - [ ] Create endpoint for cloning sheets (DH-06.0).
    - [ ] Implement custom JSON encoder for `pint` quantities (Scalar only) (DH-07.0).
    - [ ] Ensure URL-injected values are treated as transient (not saved) (DH-08.0).
- [ ] **Graph Engine**: Implement DAG logic with `networkx` (CF-01.0).
    - [ ] Ensure circular dependencies are rejected (CF-01.0).
- [ ] **Calculation Engine**:
    - [ ] Implement background worker pool (EE-01.0).
    - [ ] Support `numpy` and `scipy` execution (BB-F-05.0, CF-02.0).
    - [ ] Implement unit conversion logic using `pint` (BB-P-04.0).
    - [ ] Implement variable binding logic (map Parameters/Options to code variables) (BB-F-06.0).
    - [ ] Implement execution timeout logic (e.g., 5s limit) (EH-11.0).
    - [ ] Implement `stdout` capture for user functions (UI-18.0).
- [ ] **Error Handling**:
    - [ ] Catch user code exceptions and return stack traces (EH-01.0).
    - [ ] Handle persistence failures with retry logic (EH-06.0).

## 3. Frontend UI/UX (Initial Release)
- [ ] **Graph Editor**: Implement `rete.js` canvas (BB-S-01.0).
    - [ ] Implement Context Menu for adding nodes (UI-06.0).
    - [ ] Implement "Edit Sheet" context menu action with state-preserving navigation (UI-08.0).
    - [ ] Implement Undo/Redo history (UI-15.0).
    - [ ] Implement Connection constraints (Max 1 input, Multiple outputs) (BB-C-01.0).
    - [ ] Implement Editor Toolbar (UI-17.0).
    - [ ] Implement Keyboard Shortcuts (Delete, Ctrl+S) (UI-19.0).
- [ ] **Routing**:
    - [ ] Implement route `/sheet/:sheetId` to load specific graphs (UI-03.0).
    - [ ] Handle URL hash fragments to focus specific nodes (UI-04.0).
    - [ ] Implement route `/dashboard` for sheet list (UI-10.0).
    - [ ] Implement URL query parameter parsing for value overrides (UI-07.0).
- [ ] **Authentication**:
    - [ ] Implement "Name" prompt on first visit (AUTH-02.0).
    - [ ] Save identity in Cookies (AUTH-03.0).
    - [ ] Add "Change user" menu (AUTH-04.0).
- [ ] **Input Node**:
    - [ ] Distinct visual style from Parameters (BB-I-01.0).
    - [ ] Inputs: Name, Unit (BB-I-01.0).
- [ ] **Output Node**:
    - [ ] Distinct visual style (BB-O-01.0).
    - [ ] Inputs: Name, Description (BB-O-01.0).
- [ ] **Option Node**:
    - [ ] Inputs: Name, Options List, Selected Value (BB-OPT-01.0).
    - [ ] UI: Dropdown menu for selection (BB-OPT-01.0).
- [ ] **Parameter Node**:
    - [ ] Inputs: Name, Value, Unit, Range, Description (BB-P-01.0 - BB-P-05.0).
    - [ ] Validation: Python variable name constraints (BB-P-02.0).
    - [ ] Markdown rendering for description (BB-P-03.0).
- [ ] **Function Node**:
    - [ ] Inputs: Name, Python Code, Description (BB-F-03.0 - BB-F-05.0).
    - [ ] Validation: Python function name constraints (BB-F-03.0).
    - [ ] Markdown rendering for description (BB-F-04.0).
    - [ ] Constraint: 1 Output, 1+ Inputs (BB-F-01.0, BB-F-02.0).
- [ ] **Feedback**:
    - [ ] Display calculation errors/stack traces on output nodes (EH-02.0).
    - [ ] Visual validation for unit/type errors (EH-03.0).
    - [ ] Duplicate name error messages (EH-10.0).
    - [ ] Success toasts (e.g., "Saved") (UI-05.0).
    - [ ] Implement Evaluator Bar (Function Signature) (UI-09.0).
    - [ ] Implement Sheet Deletion with confirmation (UI-11.0).
    - [ ] Implement Sheet Duplication action (UI-12.0).
    - [ ] Implement "Copy Link" action on Dashboard (UI-13.0).
    - [ ] Implement Sheet Name/Description editor (UI-14.0).
    - [ ] Implement Console/Log viewer for selected node (UI-18.0).
    - [ ] Implement "Unsaved Changes" indicator (UI-20.0).
    - [ ] Implement distinct visual style for Nested Sheet nodes (UI-21.0).

## 4. Integration & Logic (Initial Release)
- [ ] **Real-time Recalculation**: Trigger backend calc on input change (UI-01.0).
- [ ] **Sheet Nesting**:
    - [ ] Implement linking mechanism for nested sheets (BB-S-02.0, BB-S-03.0).
    - [ ] Implement logic to expose Input/Output Nodes as sockets (BB-S-04.0).
    - [ ] Validate that all nested sheet inputs are connected (No defaults) (BB-S-05.0).
    - [ ] Implement Sheet Picker Modal for importing (UI-16.0).
- [ ] **Graph Integrity**:
    - [ ] Auto-remove connections on node deletion (EH-04.0).
    - [ ] Validate function dependencies before saving (EH-05.0).
    - [ ] Enforce unique parameter names per sheet (EH-09.0).

## 5. Future Scope (Post-Initial)
- [ ] **Concurrency**: Sheet-level mutex (FS-C-01.0, EH-08.0).
- [ ] **Attachments**: Image uploads for Parameters, Functions, Sheets (FS-A-01.0 - FS-A-03.0).
- [ ] **Notifications**: Owner-based change notifications (FS-N-01.0 - FS-N-04.0).
- [ ] **Advanced Math**: Numerical optimization (FS-O-01.0), Overflow handling (EH-07.0).
- [ ] **Versioning**: Audit logs, History querying, Rollbacks (FS-V-01.0 - FS-V-03.0).
- [ ] **IDE**: Python code completion (FS-IDE-01.0).