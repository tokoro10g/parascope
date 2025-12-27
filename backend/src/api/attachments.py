import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..core.config import settings

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    # Keep original name if possible, but prepend uuid to avoid collisions?
    # Or just use uuid. Let's use uuid for simplicity and safety.
    new_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = Path(settings.UPLOAD_DIR) / new_filename

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")

    return {"filename": new_filename, "url": f"/attachments/{new_filename}"}


@router.get("/{filename}")
async def get_file(filename: str):
    file_path = Path(settings.UPLOAD_DIR) / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
