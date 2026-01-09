import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import attachments, calculate, genai, sheets
from .core.config import settings
from .core.database import AsyncSessionLocal, Base, engine
from .core.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed database
    async with AsyncSessionLocal() as session:
        await seed_database(session)

    yield


app = FastAPI(title="Parascope Backend", lifespan=lifespan)

origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sheets.router)
app.include_router(calculate.router)
app.include_router(attachments.router)
app.include_router(genai.router, prefix="/api/genai", tags=["genai"])


@app.get("/")
async def root():
    return {"message": "Hello from Parascope Backend"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
