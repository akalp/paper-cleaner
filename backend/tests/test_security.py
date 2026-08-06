from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app
from app.schemas.session import SessionMetadata
from app.storage.storage import StorageConsistencyError, storage

from helpers import apply_test_workspace, restore_test_workspace


def test_safe_path_rejects_traversal_and_absolute_paths(backend_workspace: Path) -> None:
    with pytest.raises(StorageConsistencyError):
        storage.safe_path("../escape.png")
    with pytest.raises(StorageConsistencyError):
        storage.safe_path("uploads/../../escape.png")
    with pytest.raises(StorageConsistencyError):
        storage.safe_path("/absolute/path.png")
    with pytest.raises(StorageConsistencyError):
        storage.safe_path("")

    resolved = storage.safe_path("uploads/session_1/doc.png")
    assert resolved == (backend_workspace / "uploads/session_1/doc.png").resolve()


def test_spa_serves_only_files_inside_static_dir(
    client: TestClient,
    backend_workspace: Path,
) -> None:
    static_root = Path(settings.static_dir)
    static_root.mkdir(parents=True, exist_ok=True)
    (static_root / "index.html").write_text("<html>spa-index</html>", encoding="utf-8")
    (static_root / "app.js").write_text("console.log('app')", encoding="utf-8")
    decoy = (static_root / ".." / "secret.txt").resolve()
    decoy.write_text("SECRET-FILE-CONTENT", encoding="utf-8")

    in_root = client.get("/app.js")
    assert in_root.status_code == 200
    assert in_root.text == "console.log('app')"

    fallback = client.get("/some/client/route")
    assert fallback.status_code == 200
    assert "spa-index" in fallback.text

    traversal = client.get("/%2e%2e/secret.txt")
    assert traversal.status_code == 200
    assert "SECRET-FILE-CONTENT" not in traversal.text
    assert "spa-index" in traversal.text


def test_unmatched_api_route_returns_json_404(client: TestClient) -> None:
    response = client.get("/api/definitely-not-a-route")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"detail": "Not Found"}


def test_delete_session_ignores_unsafe_session_ids(backend_workspace: Path) -> None:
    storage.save_session(
        SessionMetadata(id="..", created_at="t", updated_at="t", document_ids=[])
    )
    data_root = backend_workspace / "data"
    assert data_root.is_dir()

    assert storage.delete_session("..") is False
    assert data_root.is_dir()
    assert storage.delete_session("nested/../id") is False
    assert data_root.is_dir()


def test_legacy_json_import_rejects_documents_with_unsafe_paths(tmp_path: Path) -> None:
    workspace_root = tmp_path / "workspace"
    session_metadata_dir = workspace_root / "data" / "metadata" / "sessions"
    document_metadata_dir = workspace_root / "data" / "metadata" / "documents"
    session_metadata_dir.mkdir(parents=True)
    document_metadata_dir.mkdir(parents=True)

    session_payload = {
        "id": "session_legacy",
        "created_at": "2026-04-18T12:00:00Z",
        "updated_at": "2026-04-18T12:00:00Z",
        "document_ids": ["doc_safe", "doc_evil"],
    }
    safe_document = {
        "id": "doc_safe",
        "session_id": "session_legacy",
        "filename": "safe.png",
        "original_path": "data/uploads/session_legacy/doc_safe.png",
        "preview_path": "data/rendered/previews/doc_safe.png",
        "order_index": 0,
        "normalized_width": 100,
        "normalized_height": 120,
        "auto_detect_status": "fallback_full_image",
        "auto_corners": [[0, 0], [100, 0], [100, 120], [0, 120]],
        "user_corners": None,
        "crop_rect": {"x": 0, "y": 0, "width": 100, "height": 120},
        "tone_preset": "printer_friendly",
        "brightness": 0,
        "contrast": 0,
        "erase_paths": [],
        "updated_at": "2026-04-18T12:00:00Z",
    }
    evil_document = dict(safe_document)
    evil_document.update(
        {
            "id": "doc_evil",
            "original_path": "../escaped_original.png",
            "preview_path": "../escaped_preview.png",
        }
    )
    (session_metadata_dir / "session_legacy.json").write_text(json.dumps(session_payload))
    (document_metadata_dir / "doc_safe.json").write_text(json.dumps(safe_document))
    (document_metadata_dir / "doc_evil.json").write_text(json.dumps(evil_document))

    original_settings, original_root_dir = apply_test_workspace(workspace_root)

    try:
        with TestClient(create_app()) as client:
            response = client.get("/api/sessions/session_legacy")
            assert response.status_code == 200
            document_ids = [doc["id"] for doc in response.json()["documents"]]
            assert document_ids == ["doc_safe"]
    finally:
        restore_test_workspace(original_settings, original_root_dir)
