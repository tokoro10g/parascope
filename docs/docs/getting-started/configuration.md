---
sidebar_position: 2
---

# Configuration

Parascope is configured via environment variables defined in a `.env` file in the project root. You can start by copying the provided example:

```bash
cp .env.example .env
```

Below is a reference of all available configuration options.

## General Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SERVER_HOSTNAME` | `localhost` | The hostname where the server is running. |
| `PROJECT_NAME` | `Parascope` | The name of the project, used in titles and metadata. |
| `DEBUG` | `true` | Enable debug mode for more verbose logging. |

## Frontend Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `3000` | The port where the React frontend application will be served. |
| `VITE_API_BASE_URL` | *Calculated* | (Optional) URL of the backend API. Defaults to `http://${SERVER_HOSTNAME}:${BACKEND_PORT}`. |

## Backend Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BACKEND_PORT` | `8000` | The port where the FastAPI backend will be served. |
| `BACKEND_CORS_ORIGINS` | *Calculated* | (Optional) Comma-separated list of allowed CORS origins. Defaults to frontend URLs. |
| `DATABASE_URL` | *Example* | Connection string for the PostgreSQL database. |
| `UPLOAD_DIR` | `uploads` | Directory to store uploaded files. |
| `LOCK_TIMEOUT_SECONDS` | `604800` | Duration (in seconds) before a sheet lock expires (Default: 7 days). |
| `WORKER_COUNT` | `5` | Number of worker processes in the execution pool. |

## Execution Environment

| Variable | Default | Description |
| :--- | :--- | :--- |
| `EXTRA_ALLOWED_MODULES` | `scipy` | Comma-separated list of additional Python modules allowed in the sandbox. |
| `EXTRA_PRELOAD_MODULES` | *(Empty)* | Comma-separated list of modules to preload in worker processes for faster startup. |

## Login & Auth

| Variable | Default | Description |
| :--- | :--- | :--- |
| `USERNAME_REGEX` | `^[a-zA-Z0-9_ ]+$` | Regex pattern to validate usernames. |
| `USERNAME_DESCRIPTION` | *Description* | Human-readable description of valid username formats. |

## AI Providers

Configure generative AI providers for the "Generate Function" feature.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DEFAULT_AI_PROVIDER` | `gemini` | The default provider to use (`gemini`, `openai`, `bedrock`). |

### Google Gemini
*   `GEMINI_API_KEY`: Your Google Gemini API Key.
*   `GEMINI_MODEL`: Model name (e.g., `gemini-pro`).

### OpenAI
*   `OPENAI_API_KEY`: Your OpenAI API Key.
*   `OPENAI_MODEL`: Model name (e.g., `gpt-4o`).

### Amazon Bedrock
*   `AWS_ACCESS_KEY_ID`: AWS Access Key.
*   `AWS_SECRET_ACCESS_KEY`: AWS Secret Key.
*   `AWS_REGION`: AWS Region (e.g., `us-east-1`).
*   `BEDROCK_MODEL_ID`: Model ID (e.g., `anthropic.claude-3-sonnet...`).
