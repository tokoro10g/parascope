FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv==0.13.1

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy the local packages first
COPY packages /packages

# Copy backend metadata
COPY backend/pyproject.toml backend/uv.lock ./

# Create virtual environment and install dependencies
RUN uv sync --locked --no-install-project

# Copy backend source
COPY backend .

# Create a non-root user
RUN useradd -m appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

USER appuser

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app", "--reload-dir", "/packages"]
