from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient


def test_upload_generates_detected_document_metadata(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = client.post("/api/sessions").json()

    with (fixture_dir / "worksheet-screenshot.png").open("rb") as fixture_file:
        response = client.post(
            f"/api/sessions/{session['id']}/documents",
            files={"files": ("worksheet-screenshot.png", fixture_file, "image/png")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["documents"]) == 1

    document = payload["documents"][0]
    assert document["auto_detect_status"] == "detected"
    assert document["normalized_width"] == 900
    assert document["normalized_height"] == 1200
    assert len(document["auto_corners"]) == 4
    assert document["user_corners"] is None
    assert document["source_url"].startswith("/api/documents/")
    assert document["preview_url"].startswith("/api/documents/")
    assert isinstance(document["preview_version"], str)

    source_response = client.get(document["source_url"])
    preview_response = client.get(document["preview_url"])
    assert source_response.status_code == 200
    assert preview_response.status_code == 200
    assert source_response.headers["content-type"] == "image/png"
    assert preview_response.headers["content-type"] == "image/png"


def test_upload_reports_fallback_for_difficult_fixture(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    session = client.post("/api/sessions").json()

    with (fixture_dir / "difficult-cluttered.png").open("rb") as fixture_file:
        response = client.post(
            f"/api/sessions/{session['id']}/documents",
            files={"files": ("difficult-cluttered.png", fixture_file, "image/png")},
        )

    assert response.status_code == 200
    document = response.json()["documents"][0]
    assert document["auto_detect_status"] == "fallback_full_image"


def test_update_transform_accepts_valid_quadrilateral_and_refreshes_preview_version(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")

    response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "user_corners": [
                [70, 90],
                [820, 70],
                [840, 1130],
                [90, 1160],
            ],
        },
    )

    assert response.status_code == 200
    updated_document = response.json()
    assert updated_document["user_corners"] == [
        [70.0, 90.0],
        [820.0, 70.0],
        [840.0, 1130.0],
        [90.0, 1160.0],
    ]
    assert updated_document["crop_rect"]["x"] == 0
    assert updated_document["crop_rect"]["y"] == 0
    assert updated_document["crop_rect"]["width"] > 0
    assert updated_document["crop_rect"]["height"] > 0
    assert updated_document["preview_version"] != document["preview_version"]


def test_update_transform_rejects_invalid_quadrilateral(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")

    response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "user_corners": [
                [90, 90],
                [810, 1140],
                [840, 80],
                [80, 1130],
            ],
        },
    )

    assert response.status_code == 400
    assert "quadrilateral" in response.json()["detail"]


def test_auto_detect_rerun_preserves_user_corners_when_not_applied(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")
    manual_corners = [
        [65, 85],
        [825, 75],
        [845, 1145],
        [85, 1165],
    ]
    update_response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={"user_corners": manual_corners},
    )
    assert update_response.status_code == 200

    rerun_response = client.post(
        f"/api/documents/{document['id']}/auto-detect",
        json={},
    )

    assert rerun_response.status_code == 200
    rerun_document = rerun_response.json()
    assert rerun_document["user_corners"] == [
        [65.0, 85.0],
        [825.0, 75.0],
        [845.0, 1145.0],
        [85.0, 1165.0],
    ]


def test_auto_detect_rerun_can_replace_user_corners(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "camera-skewed-page.png")
    manual_corners = [
        [130, 210],
        [790, 140],
        [885, 1210],
        [165, 1285],
    ]
    update_response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={"user_corners": manual_corners},
    )
    assert update_response.status_code == 200

    rerun_response = client.post(
        f"/api/documents/{document['id']}/auto-detect",
        json={"apply_to_user_corners": True},
    )

    assert rerun_response.status_code == 200
    rerun_document = rerun_response.json()
    assert rerun_document["user_corners"] == rerun_document["auto_corners"]


def _upload_document(client: TestClient, path: Path) -> dict[str, object]:
    session = client.post("/api/sessions").json()
    with path.open("rb") as fixture_file:
        response = client.post(
            f"/api/sessions/{session['id']}/documents",
            files={"files": (path.name, fixture_file, "image/png")},
        )

    assert response.status_code == 200
    return response.json()["documents"][0]
