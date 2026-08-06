from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app
from app.storage.storage import storage

from helpers import apply_test_workspace, restore_test_workspace


def test_create_session_is_persisted_in_sqlite_and_history(client: TestClient) -> None:
    response = client.post("/api/sessions")

    assert response.status_code == 201
    session = response.json()

    with sqlite3.connect(settings.metadata_db_path) as connection:
        row = connection.execute(
            "SELECT id FROM sessions WHERE id = ?",
            (session["id"],),
        ).fetchone()

    history_response = client.get("/api/sessions")
    assert row == (session["id"],)
    assert history_response.status_code == 200
    assert history_response.json()["sessions"][0] == {
        "id": session["id"],
        "created_at": session["created_at"],
        "updated_at": session["updated_at"],
        "document_count": 0,
        "first_document_filename": None,
    }


def test_session_history_includes_empty_and_non_empty_sessions_sorted_by_update_time(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    empty_session = client.post("/api/sessions").json()
    uploaded_session = client.post("/api/sessions").json()
    with (fixture_dir / "worksheet-screenshot.png").open("rb") as fixture_file:
        upload_response = client.post(
            f"/api/sessions/{uploaded_session['id']}/documents",
            files={"files": ("worksheet-screenshot.png", fixture_file, "image/png")},
        )
    assert upload_response.status_code == 200
    uploaded_session = upload_response.json()

    history_response = client.get("/api/sessions")

    assert history_response.status_code == 200
    summaries = history_response.json()["sessions"]
    assert [summary["id"] for summary in summaries] == [uploaded_session["id"], empty_session["id"]]
    assert summaries[0]["document_count"] == 1
    assert summaries[0]["first_document_filename"] == "worksheet-screenshot.png"
    assert summaries[1]["document_count"] == 0
    assert summaries[1]["first_document_filename"] is None


def test_delete_session_removes_metadata_and_session_files(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = client.post("/api/sessions").json()
    with (fixture_dir / "worksheet-screenshot.png").open("rb") as fixture_file:
        upload_response = client.post(
            f"/api/sessions/{session['id']}/documents",
            files={"files": ("worksheet-screenshot.png", fixture_file, "image/png")},
        )
    assert upload_response.status_code == 200
    session = upload_response.json()
    document = session["documents"][0]
    upload_dir = settings.uploads_dir / session["id"]
    preview_path = storage.preview_path(document["id"])
    source_path = storage.source_path(document["id"])
    assert upload_dir.is_dir()
    assert preview_path.is_file()
    assert source_path.is_file()

    delete_response = client.delete(f"/api/sessions/{session['id']}")

    assert delete_response.status_code == 204
    assert not upload_dir.exists()
    assert not preview_path.exists()
    assert not source_path.exists()
    assert client.get(f"/api/sessions/{session['id']}").status_code == 404
    assert client.get(f"/api/documents/{document['id']}/preview").status_code == 404


def test_legacy_json_metadata_imports_once_and_does_not_reappear_after_delete(
    tmp_path: Path,
) -> None:
    workspace_root = tmp_path / "workspace"
    session_metadata_dir = workspace_root / "data" / "metadata" / "sessions"
    document_metadata_dir = workspace_root / "data" / "metadata" / "documents"
    session_metadata_dir.mkdir(parents=True)
    document_metadata_dir.mkdir(parents=True)

    session_payload = {
        "id": "session_legacy",
        "created_at": "2026-04-18T12:00:00Z",
        "updated_at": "2026-04-18T12:00:00Z",
        "document_ids": ["doc_legacy"],
    }
    document_payload = {
        "id": "doc_legacy",
        "session_id": "session_legacy",
        "filename": "legacy.png",
        "original_path": "data/uploads/session_legacy/doc_legacy.png",
        "preview_path": "data/rendered/previews/doc_legacy.png",
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
    (session_metadata_dir / "session_legacy.json").write_text(json.dumps(session_payload))
    (document_metadata_dir / "doc_legacy.json").write_text(json.dumps(document_payload))

    original_settings, original_root_dir = apply_test_workspace(workspace_root)

    try:
        with TestClient(create_app()) as client:
            imported_response = client.get("/api/sessions/session_legacy")
            assert imported_response.status_code == 200
            assert imported_response.json()["documents"][0]["id"] == "doc_legacy"

            delete_response = client.delete("/api/sessions/session_legacy")
            assert delete_response.status_code == 204

        with TestClient(create_app()) as client:
            assert client.get("/api/sessions/session_legacy").status_code == 404
            assert client.get("/api/sessions").json()["sessions"] == []
    finally:
        restore_test_workspace(original_settings, original_root_dir)
