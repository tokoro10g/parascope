---
sidebar_position: 1
---

# Installation & Quick Start

The easiest way to run Parascope is using **Docker Compose**. This ensures that all dependencies (Database, Backend, Frontend) are configured correctly and run in an isolated environment.

## Prerequisites

*   [Docker](https://docs.docker.com/get-docker/) installed and running.
*   [Git](https://git-scm.com/downloads) installed.

## Quick Start Guide

### 1. Clone the Repository

First, clone the Parascope repository to your local machine:

```bash
git clone https://github.com/tokoro10g/parascope.git
cd parascope
```

### 2. Configure Environment

Create a `.env` file from the provided example. This file contains configuration for ports, database credentials, and API keys.

```bash
cp .env.example .env
```

:::tip
You can edit the `.env` file to customize your setup, such as changing the `FRONTEND_PORT` or adding API keys for AI providers (Google Gemini, OpenAI).
:::

### 3. Start the Application

Run the application using Docker Compose:

```bash
docker compose up --build
```

This command will:
*   Build the backend and frontend images.
*   Start the PostgreSQL database.
*   Seed the database with example sheets.
*   Launch the web server.

### 4. Access Parascope

Once the containers are running, you can access the application in your browser:

*   **Frontend**: [http://localhost:3000](http://localhost:3000)
*   **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
