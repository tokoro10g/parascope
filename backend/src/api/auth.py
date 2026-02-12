from fastapi import APIRouter
from pydantic import BaseModel

from ..core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthConfig(BaseModel):
    username_regex: str
    username_description: str


@router.get("/config", response_model=AuthConfig)
async def get_auth_config():
    return {
        "username_regex": settings.USERNAME_REGEX,
        "username_description": settings.USERNAME_DESCRIPTION,
    }
