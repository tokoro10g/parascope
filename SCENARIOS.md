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
    *   **Action**: Right-clicks -> "Add Parameter".
    *   **Input**: Name: `mass`, Value: `10`, Unit: `kg`.
    *   **Action**: Right-clicks -> "Add Parameter".
    *   **Input**: Name: `accel`, Value: `9.8`, Unit: `m/s^2`.
    *   **Action**: Right-clicks -> "Add Function".
    *   **Input**: Name: `calc_force`, Code: `return mass * accel`.
4.  **Wiring**:
    *   **Action**: Drags wire from `mass` output to `calc_force` input.
    *   **Action**: Drags wire from `accel` output to `calc_force` input.
    *   **Action**: Right-clicks -> "Add Output Node".
    *   **Input**: Name: `force`.
    *   **Action**: Drags wire from `calc_force` output to `force` input.
5.  **Result**:
    *   **System**: Automatically creates an output node for `calc_force`.
    *   **Feedback**: Output node displays `98.0 kg * m / s^2`.
    *   **Feedback**: The `force` Output Node displays `98.0 kg * m / s^2`.
    *   **Evaluator Bar**: Top bar displays `Sheet1() = [ 98.0 kg * m / s^2 ]`.
6.  **Persistence**:
    *   **Action**: User clicks "Save".
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

## Scenario 4: Unit Mismatch
**Goal**: Ensure physical consistency.

1.  **Setup**: Function expects length in meters.
2.  **Mistake**: User connects a parameter with unit `kg`.
3.  **Feedback**:
    *   **System**: `pint` raises dimensionality error during calc.
    *   **UI**: Output node shows `DimensionalityError: Cannot convert from 'mass' to 'length'`.

## Scenario 5: Nesting Sheets (Sub-graphs)
**Goal**: Reuse a specific calculation component within a larger system.

1.  **Prerequisite**: Alice has created and saved a sheet named "Cylinder Volume".
    *   **Content**: **Input Nodes** `radius` and `height` connected to a function, which connects to an **Output Node** `volume`.
    *   **State**: Saved with UUID `cyl-vol-123`.
2.  **Import**: Alice opens a new sheet "Fuel Tank Assembly".
    *   **Action**: Right-clicks -> "Import Sheet".
    *   **Input**: Selects "Cylinder Volume" from a list of her saved sheets.
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

## Scenario 6: URL Parameter Override (Preview Mode)
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
    *   **Evaluator Bar**: Displays `Cylinder Volume([ 5 ], [ 10 ]) = [ 785.39... ]`.
    *   **UI**: The graph reflects these values. The sheet is NOT saved with these values (they are transient).

## Scenario 7: Drill-down Editing (Debugging Nested Sheets)
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