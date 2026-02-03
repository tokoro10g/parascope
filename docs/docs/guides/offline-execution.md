---
sidebar_position: 1
---

# Offline Execution

Parascope allows you to export your calculation sheets as standalone Python scripts. These scripts can be run offline without the Parascope server, making it easy to integrate your models into other workflows or run them in air-gapped environments.

## How it Works

When you export a sheet, Parascope generates a Python class that replicates the logic of your visual graph. This includes:

*   **Node Logic**: All standard nodes (Math, Logic, etc.) are translated into Python code.
*   **Nested Sheets**: Imported sheets are reconstructed as nested Python classes.
*   **Dependencies**: The script relies on the `parascope-runtime` package to provide the underlying implementation for specific node types.

## Step-by-Step Guide

### 1. Export the Script

1.  Open the sheet you want to export in the Parascope editor.
2.  Click the **"Generate Script"** button in the toolbar.
3.  The Python script will be downloaded to your machine.

### 2. Install the Runtime

To run the exported script, you need the `parascope-runtime` package. This package is located in the `packages/` directory of the Parascope repository.

```bash
# From the root of the parascope repository
pip install ./packages/parascope-runtime
```

Alternatively, if you have published this package to your own PyPI repository, you can install it from there.

### 3. Run the Script

Once the runtime is installed, you can execute your exported script directly with Python:

```bash
python your_exported_script.py
```

## Example Usage

The generated script creates a class representing your sheet. You can import this class into other Python scripts to use your model programmatically.

```python
from your_exported_script import MyRocketSheet

# Initialize the sheet
model = MyRocketSheet()

# Set input values
model.inputs.mass = 5000
model.inputs.thrust = 12000

# Run the calculation
model.run()

# Access results
print(f"Acceleration: {model.outputs.acceleration}")
```
