from __future__ import annotations

from io import BytesIO
import json
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from app.main import create_app
from app.storage.storage import storage

from helpers import apply_test_workspace, restore_test_workspace


def _png_bytes(width: int, height: int, color: tuple[int, int, int] = (255, 255, 255)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="PNG")
    return buffer.getvalue()


def _create_session(client: TestClient) -> str:
    return client.post("/api/sessions").json()["id"]


def test_upload_rejects_requests_without_files(client: TestClient) -> None:
    session_id = _create_session(client)

    response = client.post(f"/api/sessions/{session_id}/documents")

    assert response.status_code == 400
    assert response.json()["detail"] == "At least one image file is required."


def test_upload_rejects_non_image_content(client: TestClient) -> None:
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("fake.png", b"not-an-image", "image/png")},
    )

    assert response.status_code == 400
    assert "could not be read as an image" in response.json()["detail"]


def test_upload_rejects_unsupported_extension_without_image_content_type(client: TestClient) -> None:
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("notes.exe", _png_bytes(10, 10), "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "not a supported image upload" in response.json()["detail"]


def test_multi_file_upload_creates_independent_documents(client: TestClient) -> None:
    session_id = _create_session(client)

    response = client.post(
        f"/api/sessions/{session_id}/documents",
        files=[
            ("files", ("first.png", _png_bytes(60, 80), "image/png")),
            ("files", ("second.png", _png_bytes(90, 120), "image/png")),
        ],
    )

    assert response.status_code == 200
    documents = response.json()["documents"]
    assert [document["filename"] for document in documents] == ["first.png", "second.png"]
    assert [document["order_index"] for document in documents] == [0, 1]


def test_document_scale_fields_and_large_image_downscaling(client: TestClient) -> None:
    session_id = _create_session(client)
    upload_response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("large.png", _png_bytes(2000, 1500), "image/png")},
    )
    assert upload_response.status_code == 200
    document = upload_response.json()["documents"][0]

    assert document["normalized_width"] == 2000
    assert document["normalized_height"] == 1500
    assert document["source_scale"] == 0.8
    assert document["preview_scale"] == 0.8

    source_response = client.get(document["source_url"])
    assert source_response.status_code == 200
    with Image.open(BytesIO(source_response.content)) as source_image:
        assert source_image.width <= 1600
        assert source_image.height <= 1600

    preview_response = client.get(document["preview_url"])
    assert preview_response.status_code == 200
    with Image.open(BytesIO(preview_response.content)) as preview_image:
        assert preview_image.width <= 1600
        assert preview_image.height <= 1600


def test_scale_fields_are_one_for_small_images(client: TestClient) -> None:
    session_id = _create_session(client)
    upload_response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("small.png", _png_bytes(100, 120), "image/png")},
    )
    document = upload_response.json()["documents"][0]

    assert document["source_scale"] == 1.0
    assert document["preview_scale"] == 1.0


def test_exif_orientation_is_applied_to_normalized_dimensions(client: TestClient) -> None:
    exif = Image.Exif()
    exif[274] = 6  # Orientation: rotate 90 degrees
    buffer = BytesIO()
    Image.new("RGB", (200, 100), (255, 255, 255)).save(buffer, format="JPEG", exif=exif)

    session_id = _create_session(client)
    upload_response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("rotated.jpg", buffer.getvalue(), "image/jpeg")},
    )

    assert upload_response.status_code == 200
    document = upload_response.json()["documents"][0]
    assert document["normalized_width"] == 100
    assert document["normalized_height"] == 200


def test_invalid_preview_stage_returns_422(client: TestClient) -> None:
    session_id = _create_session(client)
    upload_response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("page.png", _png_bytes(100, 120), "image/png")},
    )
    document = upload_response.json()["documents"][0]

    response = client.get(f"/api/documents/{document['id']}/preview?stage=bogus")

    assert response.status_code == 422


def test_preview_is_not_regenerated_on_cache_miss(client: TestClient) -> None:
    session_id = _create_session(client)
    upload_response = client.post(
        f"/api/sessions/{session_id}/documents",
        files={"files": ("page.png", _png_bytes(100, 120), "image/png")},
    )
    document = upload_response.json()["documents"][0]
    preview_path = storage.preview_path(document["id"])
    assert preview_path.is_file()

    preview_path.unlink()

    assert client.get(document["preview_url"]).status_code == 404
    assert client.get(document["preview_url"]).status_code == 404
    assert not preview_path.exists()


def test_corrupt_legacy_json_is_skipped_during_import(tmp_path: Path) -> None:
    workspace_root = tmp_path / "workspace"
    session_metadata_dir = workspace_root / "data" / "metadata" / "sessions"
    document_metadata_dir = workspace_root / "data" / "metadata" / "documents"
    session_metadata_dir.mkdir(parents=True)
    document_metadata_dir.mkdir(parents=True)

    (session_metadata_dir / "broken.json").write_text("{not valid json")
    (document_metadata_dir / "broken.json").write_text("{also not valid")

    session_payload = {
        "id": "session_legacy",
        "created_at": "2026-04-18T12:00:00Z",
        "updated_at": "2026-04-18T12:00:00Z",
        "document_ids": ["doc_legacy"],
    }
    (session_metadata_dir / "session_legacy.json").write_text(json.dumps(session_payload))

    original_settings, original_root_dir = apply_test_workspace(workspace_root)
    try:
        with TestClient(create_app()) as client:
            response = client.get("/api/sessions/session_legacy")
            assert response.status_code == 200
            assert response.json()["documents"] == []
    finally:
        restore_test_workspace(original_settings, original_root_dir)
