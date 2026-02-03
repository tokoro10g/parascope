---
sidebar_position: 1
---

# API Reference

Parascope exposes a fully documented REST API built with **FastAPI**.

## Interactive Documentation

When the application is running, you can access the interactive API documentation (Swagger UI) at:

**[http://localhost:8000/docs](http://localhost:8000/docs)**

This interface allows you to:
*   Explore all available endpoints.
*   View request and response schemas.
*   Test API calls directly from your browser.

## Key Endpoints

*   **`/api/v1/sheets`**: CRUD operations for calculation sheets.
*   **`/api/v1/calculate`**: Trigger calculation runs.
*   **`/api/v1/genai`**: Interact with AI providers for function generation.
