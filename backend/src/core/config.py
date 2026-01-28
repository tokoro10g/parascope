from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Parascope Backend"
    DEBUG: bool = True
    # Use localhost for local testing if not in docker
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/parascope"
    DB_ECHO: bool = False
    UPLOAD_DIR: str = "uploads"
    LOCK_TIMEOUT_SECONDS: int = 604800  # Time in seconds before a lock is considered stale (7 days)
    WORKER_COUNT: int = 5
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    USERNAME_REGEX: str = r"^[a-zA-Z0-9_ ]+$"

    @field_validator("USERNAME_REGEX", mode="before")
    @classmethod
    def default_regex_if_empty(cls, v: Optional[str]) -> str:
        if not v:
            return r"^[a-zA-Z0-9_ ]+$"
        return v

    # Execution Environment
    EXTRA_ALLOWED_MODULES: set[str] = {"scipy"}
    EXTRA_PRELOAD_MODULES: set[str] = set()

    # AI Config
    DEFAULT_AI_PROVIDER: str = "gemini"

    # Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3-flash-preview"

    @field_validator("GEMINI_MODEL")
    @classmethod
    def validate_gemini_model(cls, v: str) -> str:
        if v.startswith(("gemini-1", "gemini-2.0")):
            raise ValueError(f"Model {v} is not supported. Please use Gemini 2.5 or newer.")
        return v

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "o4-mini"

    # Bedrock
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_PROFILE: Optional[str] = None
    AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-haiku-20241022-v1:0"
    ANTHROPIC_VERSION: str = "bedrock-2023-05-31"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
