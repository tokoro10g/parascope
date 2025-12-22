from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Parascope Backend"
    # Use localhost for local testing if not in docker
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/parascope"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
