---
sidebar_position: 1
---

# Docker Compose Deployment

For production environments, Parascope provides an optimized Docker configuration that serves the frontend via Nginx and proxies requests to the backend. This setup ensures better performance and security compared to the development configuration.

## Production Setup

To start Parascope in production mode, use the `docker-compose.prod.yml` file:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Architecture Overview

This production configuration includes several key differences from the development setup:

1.  **Optimized Frontend Build**: The frontend uses a multi-stage Docker build. It compiles the React application into static files and serves them using a lightweight **Nginx** container.
2.  **Reverse Proxy**: Nginx acts as a reverse proxy, serving the frontend on port `80` (or configured port) and forwarding API requests (`/api/...`) to the backend service. This eliminates CORS issues and simplifies SSL configuration.
3.  **Production Backend**: The backend runs without hot-reloading enabled, optimizing it for stability and performance.

### Configuration

Ensure your `.env` file is properly configured for production, especially:

*   `SERVER_HOSTNAME`: Set to your public domain or IP address.
*   `DATABASE_URL`: Ensure it points to your production database (if external).
*   `DEBUG`: Set to `false`.

### Stopping the Services

To stop the production services:

```bash
docker compose -f docker-compose.prod.yml down
```
