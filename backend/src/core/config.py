from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Parascope Backend"
    DEBUG: bool = True
    # Use localhost for local testing if not in docker
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/parascope"
    UPLOAD_DIR: str = "uploads"
    LOCK_TIMEOUT_SECONDS: int = 604800  # Time in seconds before a lock is considered stale (7 days)
    WORKER_COUNT: int = 5

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
