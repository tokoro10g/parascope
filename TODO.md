# Parascope Implementation Plan

Generated from `SPECIFICATIONS.tsv`.

## 4. Integration & Logic (Initial Release)
- [ ] **Graph Integrity**:
    - [ ] Validate function dependencies before saving (EH-05.0).
- [x] **Session Management (Concurrency)**:
    - [x] **Backend**:
        - [x] Create `Lock` model (sheet_id, user_id, acquired_at, last_save_at) (CO-01.0).
        - [x] API: `POST /api/sheets/{id}/lock` (Acquire/Refresh) (CO-01.0, CO-04.0).
        - [x] API: `DELETE /api/sheets/{id}/lock` (Release) (CO-02.0).
        - [x] API: `POST /api/sheets/{id}/lock/force` (Takeover) (CO-03.0).
        - [x] API: `GET /api/sessions` (Dashboard list) (CO-06.0).
    - [x] **Frontend**:
        - [x] Implement `useSheetLock` hook (Heartbeat loop) (CO-04.0).
        - [x] Handle read-only state in `SheetEditor` (disable inputs/saving) (CO-05.0).
        - [x] Add "Locked by {User}" banner with "Take Over" button (CO-03.0).
        - [x] Display active sessions on Dashboard (CO-06.0).
- [x] **Navigation & Debugging**:
    - [x] **Backend**:
        - [x] Recursive Parent/Root Sheet Search with Trace Path.
        - [x] Recursive Execution Stage Propagation (Root -> Nodes -> Leaf).
    - [x] **Frontend**:
        - [x] "Usage" Modal to jump to Root Sheets.
        - [x] "Import Inputs" feature to import inputs from live root simulation context.
- [x] **Advanced Analysis (Sweeps)**:
    - [x] **Backend**:
        - [x] Columnar optimization for large sweep payloads.
        - [x] Support for secondary sweep variables (Cartesian product).
    - [x] **Frontend**:
        - [x] Resizable split-pane layout for configuration vs. results.
        - [x] Intelligent defaults based on node min/max constraints.
        - [x] 3D Surface Plots (Numeric x Numeric) with orthographic projection.
        - [x] Multi-line Charts (Numeric x Categorical).
        - [x] Piecewise Heatmaps (Categorical x Categorical/Categorical Outputs).

## 5. GenAI Integration (Use Gemini)
- [x] **Backend**:
    - [x] Create `POST /api/genai/generate_function` endpoint (AI-02.0).
    - [x] Integrate Google Gemini SDK (AI-02.0).
- [x] **Frontend**:
    - [x] Add AI Prompt UI to Function Inspector (AI-03.0).
    - [x] Implement function update logic from AI response (AI-01.0).

## 6. Future Scope (Post-Initial)
- [ ] **Notifications**: Owner-based change notifications (FS-N-01.0 - FS-N-04.0).
- [ ] **Advanced Math**: Numerical optimization (FS-O-01.0), Overflow handling (EH-07.0).
- [x] **Versioning**: Audit logs, History querying, Rollbacks (FS-V-01.0 - FS-V-03.0).
- [ ] **IDE**: Python code completion (FS-IDE-01.0).
- [ ] **Feedback**: Implement Console/Log viewer for selected node (UI-18.0).
