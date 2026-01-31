<div align="center">
  <img src="frontend/public/parascope.svg" alt="Parascope Logo" width="120" height="120" />

  # Parascope

  **A sophisticated node-based engineering calculation platform.**

  [![CI](https://github.com/tokoro10g/parascope/actions/workflows/ci.yml/badge.svg)](https://github.com/tokoro10g/parascope/actions/workflows/ci.yml)
  ![Python](https://img.shields.io/badge/python-3.12-blue.svg)
  ![React](https://img.shields.io/badge/react-19-blue.svg)
  ![Node.js](https://img.shields.io/badge/node.js-24-green.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
</div>

---

**Parascope** allows users to define complex engineering models using a visual graph interface, where nodes represent parameters, mathematical functions, or entire nested calculation sheets.

## 🚀 Features

*   **Visual Graph Editor**: Intuitive node-based interface built with [Rete.js](https://retejs.org/) for defining complex engineering logic.
*   **Python-Powered Calculations**: Secure backend execution engine runs Python code with support for `numpy`, `scipy`, and `networkx`.
*   **Nested Sheets**: Create reusable calculation modules (sheets) and import them into other sheets as single nodes, enabling modular system design.
*   **Advanced Trade Studies**: Perform parameter sweeps and visualize results with interactive Line, Bar, Scatter, and Timeline charts.
*   **AI Assistance**: Generate function logic from natural language using Google Gemini, OpenAI, or AWS Bedrock.
*   **Offline Execution**: Export sheets as standalone Python scripts that can be run offline using the `parascope-runtime` package.
*   **Secure Runtime**: Sandboxed execution environment using `RestrictedPython` with configurable module allow-lists.
*   **High Performance**: Optimized worker pool with module preloading and non-blocking architecture for responsive UI interactions.
*   **Real-time Evaluation**: Instant feedback on calculation results as you modify the graph.
*   **Engineering Examples**: Comes pre-seeded with examples like the Tsiolkovsky Rocket Equation, Aerodynamic Drag, and SSTO Feasibility checks.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React 19 + TypeScript + Vite
*   **Graph Library**: Rete.js 2.0 (Classic Preset) + elkjs (Auto-layout)
*   **Visualization**: Apache ECharts (2D/3D Charts)
*   **Styling**: CSS Modules, Lucide React (Icons)
*   **Math Rendering**: KaTeX
*   **Node.js**: >= 24
*   **Package Manager**: pnpm

### Backend
*   **Framework**: FastAPI (Python 3.12)
*   **Execution**: RestrictedPython (Secure Sandbox)
*   **Scientific Stack**: NumPy, SciPy, NetworkX
*   **AI Integration**: google-genai, openai, boto3
*   **Database**: PostgreSQL + asyncpg
*   **ORM**: SQLAlchemy + Alembic
*   **Runtime**: Docker / Docker Compose
*   **Package Manager**: uv

## 🏁 Quick Start

The easiest way to run Parascope is using Docker Compose.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/parascope.git
    cd parascope
    ```

2.  **Configure the environment**:
    Create a `.env` file from the example.
    ```bash
    cp .env.example .env
    ```

3.  **Start the application**:
    ```bash
    docker compose up --build
    ```

4.  **Access the application**:
    *   **Frontend**: Open [http://localhost:3000](http://localhost:3000) in your browser.
    *   **Backend API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs).

## 🚢 Production Deployment

For production environments, Parascope provides a optimized Docker configuration using Nginx to serve the frontend and proxy requests to the backend.

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This configuration:
*   Uses a multi-stage build for the frontend to produce a lightweight static bundle.
*   Serves the frontend via Nginx on port 80.
*   Proxies API requests internally from Nginx to the backend service.
*   Runs the backend in a production-optimized mode without hot-reloading.

## 🐍 Offline Execution & Generated Scripts

Parascope allows you to export your calculation sheets as standalone Python scripts. These scripts can be run offline without the Parascope server by using the `parascope-runtime` package.

### Running Generated Scripts

1.  **Export the script**: Use the "Generate Script" feature in the Parascope UI.
2.  **Install the runtime**:
    ```bash
    pip install ./packages/parascope-runtime
    ```
3.  **Run your script**:
    ```bash
    python your_exported_script.py
    ```

The generated code includes all necessary logic, including nested sheets, which are reconstructed as Python classes.

## 📂 Project Structure

```
parascope/
├── .github/            # CI/CD workflows
├── backend/            # FastAPI application
│   ├── src/
│   │   ├── api/        # API Routes
│   │   ├── core/       # Execution engine & config
│   │   ├── models/     # Database models
│   │   └── schemas/    # Pydantic schemas
│   └── tests/          # Pytest suite
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # React UI components
│   │   └── rete/       # Rete.js customization
├── e2e/                # Playwright end-to-end tests
├── packages/
│   └── parascope-runtime/ # Standalone package for offline execution
├── docker-compose.yml  # Dev orchestration
├── docker-compose.prod.yml # Production orchestration
├── docker-compose.test.yml # Backend test orchestration
└── docker-compose.e2e.yml # E2E test orchestration
```

## ⚙️ Configuration

The application is configured via environment variables defined in a `.env` file. You can copy `.env.example` to `.env` to get started.

Key variables:
*   `SERVER_HOSTNAME`: Hostname for the server (default: `localhost`).
*   `FRONTEND_PORT`: Port for the frontend application (default: `3000`).
*   `BACKEND_PORT`: Port for the backend API (default: `8000`).

## 🧪 Testing

Backend unit tests are containerized and run in an isolated environment using a separate database.

To run the backend tests:
```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

This will:
1.  Build a test-specific backend image.
2.  Start a transient PostgreSQL instance (`db-test`) in memory.
3.  Execute all tests under `backend/tests/`.
4.  Automatically shut down and clean up all containers upon completion.

### End-to-End Tests

E2E tests use Playwright to verify the full application stack.

To run the E2E tests:
```bash
docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e-runner
```

To run a specific test file:
```bash
PLAYWRIGHT_ARGS="tests/connection-drop-menu.spec.ts" docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e-runner
```

To record videos of the test execution (saved in `e2e/test-results/`):
```bash
docker compose -f docker-compose.e2e.yml run -e VIDEO=on e2e-runner
```

This will run the tests in a completely isolated Docker project, allowing you to run them even while the main development server is active.

## 🧪 Database Seeding

On the first run, the database is automatically seeded with example engineering sheets:
1.  **Tsiolkovsky Rocket Equation**: Basic delta-v calculation.
2.  **Dynamic Pressure**: Aerodynamic pressure calculation.
3.  **Aerodynamic Drag**: Nested sheet importing Dynamic Pressure.
4.  **SSTO Feasibility Check**: Complex system importing the Rocket Equation.

To reset the database to these defaults, you can clear the `sheets` table or restart the backend with a fresh volume.
