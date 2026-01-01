# Parascope User Scenarios

This document outlines typical user journeys to validate system requirements and guide development.

## Scenario 1: The "Back-of-the-Napkin" Calculation (New User)
**Goal**: Create a simple physics calculation and save it.

1.  **Arrival**: User visits the homepage (`/`).
2.  **Onboarding**: System checks for `parascope_user` cookie. None found.
    *   **Action**: Modal appears: "Welcome! What should we call you?"
    *   **Input**: User enters "Alice".
    *   **System**: Sets cookie. Modal closes.
3.  **Creation**: User sees a blank grid (The Sheet).
    *   **Action**: Clicks "Add Parameter" on the **Toolbar**.
    *   **System**: Automatically opens the **Node Inspector** dialog.
    *   **Input**: Name: `mass`, Value: `10`.
    *   **Action**: Clicks "Save" in the dialog.
    *   **Action**: Clicks "Add Parameter" on the **Toolbar**.
    *   **System**: Automatically opens the **Node Inspector** dialog.
    *   **Input**: Name: `accel`, Value: `9.8`.
    *   **Action**: Clicks "Save" in the dialog.
    *   **Action**: Clicks "Add Function" on the **Toolbar**.
    *   **System**: Automatically opens the **Node Inspector** dialog.
    *   **Input**: Name: `calc_force`, Code: `return mass * accel`.
    *   **Action**: Clicks "Save" in the dialog.
4.  **Wiring**:
    *   **Action**: Drags wire from `mass` output to `calc_force` input.
    *   **Action**: Drags wire from `accel` output to `calc_force` input.
    *   **Action**: Clicks "Add Output Node" on the **Toolbar**.
    *   **Input**: Name: `force`.
    *   **Action**: Drags wire from `calc_force` output to `force` input.
5.  **Result**:
    *   **System**: Automatically creates an output node for `calc_force`.
    *   **Feedback**: Output node displays `98.0`.
    *   **Feedback**: The `force` Output Node displays `98.0`.
    *   **Table View**: The calculated result is also visible in the Table View.
6.  **Persistence**:
    *   **Action**: User presses `Ctrl+S` (or clicks "Save").
    *   **System**: Generates Sheet UUID `a1b2...`. Updates URL to `/sheet/a1b2...`.
    *   **System**: Shows "Saved" toast.

## Scenario 2: Collaboration & Deep Linking
**Goal**: Share a specific result with a colleague.

1.  **Sharing**: Alice copies the URL `/sheet/a1b2...` and sends it to Bob.
2.  **Access**: Bob clicks the link.
    *   **System**: Checks cookie. Bob visited before, so no prompt.
    *   **System**: Loads Graph `a1b2...`.
3.  **Navigation**: Bob wants to ask about the acceleration value.
    *   **Action**: Bob clicks the `accel` Parameter.
    *   **System**: URL updates to `/sheet/a1b2...#<node_uuid>`.
4.  **Communication**: Bob sends the specific link to Alice: "Is this gravity?"
5.  **Modification**: Bob changes `accel` to `1.62` (Moon gravity).
    *   **System**: `calc_force` immediately updates to `16.2`.
    *   **System**: `force` Output Node immediately updates to `16.2`.
    *   **Action**: Bob clicks "Save".

## Scenario 3: Debugging a Python Error
**Goal**: Identify and fix a mistake in a function.

1.  **Edit**: Alice modifies `calc_force` to calculate kinetic energy but makes a typo.
    *   **Input**: Code: `return 0.5 * mass * v_squared` (Note: `v_squared` is undefined).
2.  **Error Feedback**:
    *   **System**: Detects `NameError` during execution.
    *   **UI**: The `calc_force` node turns red.
    *   **UI**: Display text: `NameError: name 'v_squared' is not defined`.
3.  **Correction**:
    *   **Action**: Alice adds a new parameter `velocity`.
    *   **Action**: Updates code: `return 0.5 * mass * (velocity ** 2)`.
    *   **System**: Node turns green/neutral. Result calculates correctly.
4.  **Accidental Deletion & Recovery**:
    *   **Action**: Alice accidentally presses `Delete` while `velocity` is selected.
    *   **System**: Node and connections disappear.
    *   **Action**: Alice presses `Ctrl+Z` (Undo).
    *   **System**: Node and connections reappear.

## Scenario 4: Nesting Sheets (Sub-graphs)
**Goal**: Reuse a specific calculation component within a larger system.

1.  **Prerequisite**: Alice has created and saved a sheet named "Cylinder Volume".
    *   **Content**: **Input Nodes** `radius` and `height` connected to a function, which connects to an **Output Node** `volume`.
    *   **State**: Saved with UUID `cyl-vol-123`.
2.  **Import**: Alice opens a new sheet "Fuel Tank Assembly".
    *   **Action**: Clicks "Import Sheet" on the **Toolbar**.
    *   **Input**: Selects "Cylinder Volume" from the **Sheet Picker Modal** (list of her saved sheets).
3.  **Node Creation**:
    *   **System**: Renders a single node labeled "Cylinder Volume".
    *   **Ports**: The node displays input sockets for `radius` and `height` and an output socket for `volume`.
4.  **Wiring**:
    *   **Action**: Alice creates a parameter `tank_radius` (Value: `2.5`) in the main sheet.
    *   **Action**: Connects `tank_radius` to the `radius` input of the "Cylinder Volume" node.
    *   **Action**: Connects a constant or another parameter to `height`.
5.  **Execution**:
    *   **System**: Passes values to the linked sheet, executes the graph, and returns the `volume`.
    *   **Feedback**: The output socket shows the calculated volume.
    *   **Linking**: If Alice updates "Cylinder Volume" later, "Fuel Tank Assembly" will reflect the changes.

## Scenario 6: Material Selection (Option Node)
**Goal**: Select a material from a list and have its properties update automatically.

1.  **Setup**: Alice wants to calculate the mass of a beam based on its material.
2.  **Option Definition**:
    *   **Action**: Alice adds a **Parameter Node** labeled `Material`.
    *   **Action**: In the **Node Inspector**, she changes the **Type** from "Number" to "Option".
    *   **Action**: She adds options: "Steel", "Aluminum", "Titanium".
    *   **Action**: She selects "Steel" as the current value.
3.  **Logic Implementation**:
    *   **Action**: Alice adds a **Function Node** labeled `Get Density`.
    *   **Input**: Code:
        ```python
        densities = {
            "Steel": 7850,
            "Aluminum": 2700,
            "Titanium": 4500
        }
        density = densities.get(material, 0)
        ```
    *   **Wiring**: Connects `Material` output to `Get Density` input `material`.
4.  **Calculation**:
    *   **Action**: Alice adds a **Parameter Node** `Volume` (Value: `2`).
    *   **Action**: Adds a **Function Node** `Calculate Mass` (Code: `mass = density * volume`).
    *   **Wiring**: Connects `Get Density` output `density` and `Volume` output to `Calculate Mass`.
5.  **Interaction**:
    *   **Action**: Alice changes the `Material` parameter from "Steel" to "Aluminum" via the dropdown in the Inspector (or on the node itself if supported).
    *   **Result**: `Get Density` updates to `2700`. `Calculate Mass` updates accordingly.

## Scenario 5: URL Parameter Override (Preview Mode)
**Goal**: Share a specific calculation case without modifying the saved sheet.

1.  **Context**: Alice has the "Cylinder Volume" sheet (UUID `cyl-vol-123`).
    *   **Inputs**: `radius` (Input Node), `height` (Input Node).
2.  **Action**: Alice wants to show Bob the volume for a specific large tank.
    *   **Action**: She constructs the URL: `/sheet/cyl-vol-123?radius=5&height=10`.
3.  **Access**: Bob clicks the link.
4.  **System**:
    *   **Load**: Loads sheet `cyl-vol-123`.
    *   **Override**: Injects `5` into `radius` Input Node and `10` into `height` Input Node.
    *   **Calc**: Automatically recalculates.
    *   **UI**: Displays the result for these specific inputs. The sheet is NOT saved with these values (they are transient).
    *   **Table View**: Displays the overridden input values and the calculated result.
    *   **UI**: The graph reflects these values. The sheet is NOT saved with these values (they are transient).

## Scenario 6: Drill-down Editing (Debugging Nested Sheets)
**Goal**: Investigate why a nested sheet is producing an unexpected result in the context of the parent sheet.

1.  **Context**: Alice is in "Fuel Tank Assembly". The "Cylinder Volume" node is outputting `500`, which seems wrong.
    *   **Inputs**: The node is receiving `radius=5` and `height=20` from the parent sheet.
2.  **Action**: Alice right-clicks the "Cylinder Volume" node and selects "Edit Sheet".
3.  **System**:
    *   **Navigation**: Opens `/sheet/cyl-vol-123?radius=5&height=20` in a new tab (or current).
    *   **State**: The "Cylinder Volume" sheet loads.
    *   **Override**: `radius` Input Node is set to `5`, `height` Input Node is set to `20`.
    *   **Feedback**: Alice sees the calculation details *using the exact values from the parent sheet*.
4.  **Fix**: She notices a constant inside "Cylinder Volume" is wrong. She fixes it and saves.
5.  **Return**: She returns to "Fuel Tank Assembly", which updates to reflect the fix.

## Scenario 7: Dashboard & Organization
**Goal**: Manage saved work, rename sheets, and organize projects.

1.  **Access**: Alice clicks the "Dashboard" link in the header.
    *   **System**: Navigates to `/dashboard`.
    *   **UI**: Lists sheets owned by "Alice".
2.  **Renaming**:
    *   **Action**: Alice sees "Untitled Sheet" (from Scenario 1).
    *   **Action**: Clicks the name and renames it to "Newton's Second Law".
    *   **System**: Saves the new metadata.
3.  **Duplication**:
    *   **Action**: Alice wants to try a relativistic version without breaking the original.
    *   **Action**: Clicks "Duplicate" on "Newton's Second Law".
    *   **System**: Creates a copy named "Newton's Second Law (Copy)".
    *   **UI**: Redirects Alice to the new sheet.
4.  **Sharing**:
    *   **Action**: Alice returns to Dashboard. Clicks "Copy Link" on "Newton's Second Law".
    *   **System**: Copies URL to clipboard. Shows "Link Copied" toast.
5.  **Cleanup**:
    *   **Action**: Alice clicks "Delete" on an empty "Untitled Sheet".
    *   **System**: Prompts for confirmation. Alice confirms.
    *   **System**: Removes sheet from list.

## Scenario 8: Material Selection (Option Node)
**Goal**: Use categorical logic to switch between material properties.

1.  **Setup**: Alice is calculating the weight of a beam.
2.  **Option Definition**:
    *   **Action**: Clicks "Add Option Node" on Toolbar.
    *   **Input**: Name: `material`, Options: `["Steel", "Aluminum", "Wood"]`.
    *   **Action**: Selects "Steel" from the dropdown.
3.  **Logic**:
    *   **Action**: Adds Function `get_density`.
    *   **Code**: `if material == "Steel": return 7850` (etc).
4.  **Execution**:
    *   **Action**: Connects `material` to `get_density`.
    *   **Feedback**: Output shows `7850`.
    *   **Action**: Alice changes dropdown to "Aluminum".
    *   **Feedback**: Output immediately updates to `2700`.

## Scenario 9: Advanced Debugging (Logs & Timeouts)
**Goal**: Debug complex logic using print statements and handle infinite loops.

1.  **Debugging**: Alice is writing a complex iterative solver.
    *   **Code**: `print(f"Iteration {i}: {total}")` inside a loop.
2.  **Feedback**:
    *   **Action**: Alice selects the Function node.
    *   **UI**: The **Console/Log View** panel shows the print output.
3.  **Safety**: Alice accidentally creates an infinite loop.
    *   **Code**: `while True: pass`
    *   **System**: Background worker detects execution time > 5 seconds.
    *   **System**: Terminates process.
    *   **UI**: Node turns red. Error: `TimeoutError: Function execution exceeded 5s limit`.

## Scenario 10: Table View & Data Export
**Goal**: View all parameters in a list and export them to a spreadsheet.

1.  **Context**: Alice has a complex sheet with 20 parameters scattered across the canvas.
2.  **Table View**:
    *   **Action**: Alice looks at the right sidebar (Table View).
    *   **UI**: She sees a compact table listing all Parameters and Outputs.
    *   **Action**: She edits the value of `mass` directly in the table from `10` to `15`.
    *   **System**: The graph updates immediately, and `force` recalculates to `147.0`.
3.  **Export**:
    *   **Action**: Alice clicks the "Copy Table" button in the sidebar.
    *   **System**: Copies the table data (Name, Type, Value) to the clipboard in TSV format.
    *   **Action**: Alice pastes into Excel.
    *   **Result**: The data appears correctly formatted in columns.
## Scenario 11: Organizing Engineering Models (Folders)
**Goal**: Organize a growing collection of rocket science models.

1.  **Dashboard**: User visits the dashboard (`/`).
2.  **Creation**: User clicks "New Folder".
    *   **Input**: Name: "Rocket Science".
    *   **System**: Creates folder and displays it in the list.
3.  **Navigation**: User clicks the "Rocket Science" folder.
    *   **System**: Navigates into the folder (empty list).
    *   **UI**: Shows "Up" button.
4.  **Sheet Creation**: User clicks "Create New Sheet".
    *   **System**: Creates a new sheet *inside* the current folder.
    *   **Action**: User renames sheet to "Specific Impulse Calc".
5.  **Verification**: User clicks "Up".
    *   **System**: Returns to root.
    *   **UI**: Shows "Rocket Science" folder.
    *   **UI**: Does *not* show "Specific Impulse Calc" (it's inside the folder).

## Scenario 12: Using Pre-Seeded Engineering Examples
**Goal**: Explore the built-in Tsiolkovsky Rocket Equation example.

1.  **Discovery**: User navigates to the "Examples" folder (created by system).
2.  **Selection**: User opens "Tsiolkovsky Rocket Equation".
3.  **Exploration**:
    *   **Observation**: Sees inputs for `Isp`, `m0`, `mf`.
    *   **Observation**: Sees function node with Python code: `DeltaV = Isp * g0 * math.log(m0 / mf)`.
4.  **Simulation**:
    *   **Action**: Changes `Isp` from 300 to 450.
    *   **Feedback**: `DeltaV` output updates instantly.
5.  **Nesting**: User creates a new sheet "Mission Planning".
    *   **Action**: Adds a "Sheet" node.
    *   **Selection**: Browses to "Examples" -> "Tsiolkovsky Rocket Equation".
    *   **System**: Imports the rocket equation as a single node with defined inputs/outputs.
