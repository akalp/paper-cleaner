from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from fastapi.testclient import TestClient
from PIL import Image


def test_reorder_session_documents_persists_order_indexes(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = _upload_documents(
        client,
        fixture_dir / "worksheet-screenshot.png",
        fixture_dir / "difficult-cluttered.png",
    )
    documents = session["documents"]
    reordered_ids = [documents[1]["id"], documents[0]["id"]]

    response = client.post(
        f"/api/sessions/{session['id']}/reorder",
        json={"document_ids": reordered_ids},
    )

    assert response.status_code == 200
    reordered_documents = response.json()["documents"]
    assert [document["id"] for document in reordered_documents] == reordered_ids
    assert [document["order_index"] for document in reordered_documents] == [0, 1]


def test_reorder_session_documents_rejects_duplicate_or_foreign_ids(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = _upload_documents(
        client,
        fixture_dir / "worksheet-screenshot.png",
        fixture_dir / "difficult-cluttered.png",
    )
    documents = session["documents"]

    duplicate_response = client.post(
        f"/api/sessions/{session['id']}/reorder",
        json={"document_ids": [documents[0]["id"], documents[0]["id"]]},
    )
    foreign_response = client.post(
        f"/api/sessions/{session['id']}/reorder",
        json={"document_ids": [documents[0]["id"], "doc_missing"]},
    )

    assert duplicate_response.status_code == 400
    assert foreign_response.status_code == 400


def test_export_document_image_returns_final_png(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = _upload_documents(client, fixture_dir / "worksheet-screenshot.png")
    document = session["documents"][0]

    response = client.get(f"/api/documents/{document['id']}/export/image")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "attachment" in response.headers["content-disposition"]
    with Image.open(BytesIO(response.content)) as exported_image:
        assert exported_image.format == "PNG"
        assert exported_image.size == (
            document["crop_rect"]["width"],
            document["crop_rect"]["height"],
        )


def test_export_session_zip_uses_persisted_page_order(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = _upload_documents(
        client,
        fixture_dir / "worksheet-screenshot.png",
        fixture_dir / "difficult-cluttered.png",
    )
    documents = session["documents"]
    reordered_ids = [documents[1]["id"], documents[0]["id"]]
    reorder_response = client.post(
        f"/api/sessions/{session['id']}/reorder",
        json={"document_ids": reordered_ids},
    )
    assert reorder_response.status_code == 200

    response = client.get(f"/api/sessions/{session['id']}/export/zip")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with ZipFile(BytesIO(response.content)) as archive:
        assert archive.namelist() == [
            "001-difficult-cluttered.png",
            "002-worksheet-screenshot.png",
        ]
        assert all(archive.getinfo(name).file_size > 0 for name in archive.namelist())


def test_export_session_pdf_returns_pdf_file(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = _upload_documents(
        client,
        fixture_dir / "worksheet-screenshot.png",
        fixture_dir / "difficult-cluttered.png",
    )

    response = client.get(f"/api/sessions/{session['id']}/export/pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_export_session_zip_rejects_empty_session(client: TestClient) -> None:
    session = client.post("/api/sessions").json()

    response = client.get(f"/api/sessions/{session['id']}/export/zip")

    assert response.status_code == 400
    assert response.json()["detail"] == "Session has no documents to export."


def test_export_session_pdf_rejects_empty_session(client: TestClient) -> None:
    session = client.post("/api/sessions").json()

    response = client.get(f"/api/sessions/{session['id']}/export/pdf")

    assert response.status_code == 400
    assert response.json()["detail"] == "Session has no documents to export."


def _upload_documents(
    client: TestClient,
    *paths: Path,
) -> dict[str, object]:
    session = client.post("/api/sessions").json()
    files = []
    open_files = []
    try:
        for path in paths:
            fixture_file = path.open("rb")
            open_files.append(fixture_file)
            files.append(("files", (path.name, fixture_file, "image/png")))

        response = client.post(
            f"/api/sessions/{session['id']}/documents",
            files=files,
        )
    finally:
        for fixture_file in open_files:
            fixture_file.close()

    assert response.status_code == 200
    return response.json()
