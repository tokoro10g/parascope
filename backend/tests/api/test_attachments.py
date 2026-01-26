import io
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_attachment_lifecycle(client: AsyncClient):
    # 1. Upload
    file_content = b"fake image content"
    files = {"file": ("test.png", io.BytesIO(file_content), "image/png")}
    response = await client.post("/attachments/upload", files=files)
    assert response.status_code == 200
    filename = response.json()["filename"]
    assert filename.endswith(".png")

    # 2. Get (check if it exists)
    response = await client.get(f"/attachments/{filename}")
    assert response.status_code == 200
    assert response.content == file_content

    # 3. Delete
    response = await client.delete(f"/attachments/{filename}")
    assert response.status_code == 200

    # 4. Verify gone
    response = await client.get(f"/attachments/{filename}")
    assert response.status_code == 404
