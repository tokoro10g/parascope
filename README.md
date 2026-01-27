# Parascope

**Parascope** is a sophisticated node-based engineering calculation platform. It allows users to define complex engineering models using a visual graph interface, where nodes represent parameters, mathematical functions, or entire nested calculation sheets.

## 🚀 Features

*   **Visual Graph Editor**: Intuitive node-based interface built with [Rete.js](https://retejs.org/).
*   **Python-Powered Calculations**: Backend execution engine runs Python code for function nodes, supporting libraries like `math`.
*   **Nested Sheets**: Create reusable calculation modules (sheets) and import them into other sheets as single nodes.
*   **Advanced Trade Studies**: Perform parameter sweeps and visualize results with Line, Bar, Scatter, and Timeline charts.
*   **AI Assistance**: Generate function logic from natural language using Gemini AI.
*   **Real-time Evaluation**: Instant feedback on calculation results as you modify the graph.
*   **Engineering Examples**: Comes pre-seeded with examples like the Tsiolkovsky Rocket Equation, Aerodynamic Drag, and SSTO Feasibility checks.
*   **Modern Stack**: Built with React, FastAPI, and PostgreSQL.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React + TypeScript + Vite
*   **Graph Library**: Rete.js (Classic Preset)
*   **Styling**: CSS Modules, Lucide React (Icons)
*   **Package Manager**: pnpm

### Backend
*   **Framework**: FastAPI (Python 3.12)
*   **Database**: PostgreSQL
*   **ORM**: SQLAlchemy (Async)
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
    docker-compose up --build
    ```

4.  **Access the application**:
    *   **Frontend**: Open [http://localhost:3000](http://localhost:3000) in your browser.
    *   **Backend API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs).

## 🚢 Production Deployment

For production environments, Parascope provides a optimized Docker configuration using Nginx to serve the frontend and proxy requests to the backend.

```bash
docker-compose -f docker-compose.prod.yml up --build -d
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
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
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
docker-compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e-runner
```

This will run the tests in a completely isolated Docker project, allowing you to run them even while the main development server is active.

## 🧪 Database Seeding

On the first run, the database is automatically seeded with example engineering sheets:
1.  **Tsiolkovsky Rocket Equation**: Basic delta-v calculation.
2.  **Dynamic Pressure**: Aerodynamic pressure calculation.
3.  **Aerodynamic Drag**: Nested sheet importing Dynamic Pressure.
4.  **SSTO Feasibility Check**: Complex system importing the Rocket Equation.

To reset the database to these defaults, you can clear the `sheets` table or restart the backend with a fresh volume.
