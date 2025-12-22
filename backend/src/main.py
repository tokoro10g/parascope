from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import calculate, sheets
from .core.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Parascope Backend", lifespan=lifespan)

app.include_router(sheets.router)
app.include_router(calculate.router)

@app.get("/")
async def root():
    return {"message": "Hello from Parascope Backend"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
