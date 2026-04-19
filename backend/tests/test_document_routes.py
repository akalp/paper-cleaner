from __future__ import annotations

from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageChops


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
    assert document["transformed_preview_url"].startswith("/api/documents/")
    assert "stage=transformed" in document["transformed_preview_url"]
    assert isinstance(document["preview_version"], str)

    source_response = client.get(document["source_url"])
    preview_response = client.get(document["preview_url"])
    transformed_preview_response = client.get(document["transformed_preview_url"])
    assert source_response.status_code == 200
    assert preview_response.status_code == 200
    assert transformed_preview_response.status_code == 200
    assert source_response.headers["content-type"] == "image/png"
    assert preview_response.headers["content-type"] == "image/png"
    assert transformed_preview_response.headers["content-type"] == "image/png"


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


def test_update_transform_crop_only_preserves_existing_manual_perspective(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")
    manual_corners = [
        [70, 90],
        [820, 70],
        [840, 1130],
        [90, 1160],
    ]
    update_response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={"user_corners": manual_corners},
    )
    assert update_response.status_code == 200
    manually_corrected_document = update_response.json()

    crop_response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "crop_rect": {
                "x": 20,
                "y": 30,
                "width": manually_corrected_document["crop_rect"]["width"] - 60,
                "height": manually_corrected_document["crop_rect"]["height"] - 80,
            }
        },
    )

    assert crop_response.status_code == 200
    cropped_document = crop_response.json()
    assert cropped_document["user_corners"] == manually_corrected_document["user_corners"]
    assert cropped_document["crop_rect"] == {
        "x": 20,
        "y": 30,
        "width": manually_corrected_document["crop_rect"]["width"] - 60,
        "height": manually_corrected_document["crop_rect"]["height"] - 80,
    }


def test_update_transform_rejects_crop_outside_transformed_bounds(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")

    response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "crop_rect": {
                "x": 0,
                "y": 0,
                "width": document["crop_rect"]["width"] + 10,
                "height": document["crop_rect"]["height"],
            }
        },
    )

    assert response.status_code == 400
    assert "transformed image bounds" in response.json()["detail"]


def test_update_transform_crop_changes_preview_dimensions_and_version(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")

    response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "crop_rect": {
                "x": 15,
                "y": 25,
                "width": 640,
                "height": 920,
            }
        },
    )

    assert response.status_code == 200
    updated_document = response.json()
    assert updated_document["crop_rect"] == {
        "x": 15,
        "y": 25,
        "width": 640,
        "height": 920,
    }
    assert updated_document["preview_version"] != document["preview_version"]

    preview_image = _load_preview_image(client, updated_document["preview_url"])
    assert preview_image.size == (640, 920)

    transformed_preview_image = _load_preview_image(
        client,
        f"{updated_document['preview_url']}?stage=transformed",
    )
    assert transformed_preview_image.size == (
        document["crop_rect"]["width"],
        document["crop_rect"]["height"],
    )


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


def test_update_tone_persists_values_and_refreshes_preview_version(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "camera-skewed-page.png")

    response = client.post(
        f"/api/documents/{document['id']}/update-tone",
        json={
            "tone_preset": "grayscale",
            "brightness": 10,
            "contrast": 15,
        },
    )

    assert response.status_code == 200
    updated_document = response.json()
    assert updated_document["tone_preset"] == "grayscale"
    assert updated_document["brightness"] == 10
    assert updated_document["contrast"] == 15
    assert updated_document["preview_version"] != document["preview_version"]


def test_update_tone_changes_preview_pixels(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "camera-skewed-page.png")
    before_preview = _load_preview_image(client, document["preview_url"])

    response = client.post(
        f"/api/documents/{document['id']}/update-tone",
        json={
            "tone_preset": "high_contrast_bw",
            "brightness": 0,
            "contrast": 20,
        },
    )

    assert response.status_code == 200
    updated_document = response.json()
    after_preview = _load_preview_image(client, updated_document["preview_url"])

    difference = ImageChops.difference(before_preview.convert("RGB"), after_preview.convert("RGB"))
    assert difference.getbbox() is not None


def test_high_contrast_bw_brightness_and_contrast_adjustments_change_output(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "camera-skewed-page.png")

    baseline_response = client.post(
        f"/api/documents/{document['id']}/update-tone",
        json={
            "tone_preset": "high_contrast_bw",
            "brightness": 0,
            "contrast": 0,
        },
    )
    assert baseline_response.status_code == 200
    baseline_document = baseline_response.json()
    baseline_preview = _load_preview_image(client, baseline_document["preview_url"])

    adjusted_response = client.post(
        f"/api/documents/{document['id']}/update-tone",
        json={
            "tone_preset": "high_contrast_bw",
            "brightness": 20,
            "contrast": 25,
        },
    )
    assert adjusted_response.status_code == 200
    adjusted_document = adjusted_response.json()
    adjusted_preview = _load_preview_image(client, adjusted_document["preview_url"])

    difference = ImageChops.difference(
        baseline_preview.convert("RGB"),
        adjusted_preview.convert("RGB"),
    )
    assert difference.getbbox() is not None


def test_update_erase_persists_paths_and_refreshes_preview_version(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")

    response = client.post(
        f"/api/documents/{document['id']}/erase",
        json={"erase_paths": [_build_center_erase_path(document)]},
    )

    assert response.status_code == 200
    updated_document = response.json()
    assert updated_document["preview_version"] != document["preview_version"]
    assert len(updated_document["erase_paths"]) == 1
    assert updated_document["erase_paths"][0]["mode"] == "fill_white"
    assert len(updated_document["erase_paths"][0]["points"]) == 4


def test_update_erase_changes_final_preview_pixels(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")
    before_preview = _load_preview_image(client, document["preview_url"])

    response = client.post(
        f"/api/documents/{document['id']}/erase",
        json={"erase_paths": [_build_center_erase_path(document)]},
    )

    assert response.status_code == 200
    updated_document = response.json()
    after_preview = _load_preview_image(client, updated_document["preview_url"])

    difference = ImageChops.difference(before_preview.convert("RGB"), after_preview.convert("RGB"))
    assert difference.getbbox() is not None


def test_update_erase_rejects_out_of_bounds_points(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")
    crop_rect = document["crop_rect"]

    response = client.post(
        f"/api/documents/{document['id']}/erase",
        json={
            "erase_paths": [
                {
                    "points": [
                        [10, 10],
                        [crop_rect["width"] + 5, 10],
                        [crop_rect["width"] + 5, 40],
                    ],
                    "mode": "fill_white",
                }
            ]
        },
    )

    assert response.status_code == 400
    assert "cropped image bounds" in response.json()["detail"]


def test_transformed_preview_remains_unchanged_by_erase_paths(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "camera-skewed-page.png")
    before_preview = _load_preview_image(client, document["transformed_preview_url"])

    response = client.post(
        f"/api/documents/{document['id']}/erase",
        json={"erase_paths": [_build_center_erase_path(document)]},
    )

    assert response.status_code == 200
    updated_document = response.json()
    after_preview = _load_preview_image(client, updated_document["transformed_preview_url"])

    difference = ImageChops.difference(before_preview.convert("RGB"), after_preview.convert("RGB"))
    assert difference.getbbox() is None


def test_update_transform_crop_clears_erase_paths(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")
    erased_document = _save_erase_path(client, document)

    response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "crop_rect": {
                "x": 20,
                "y": 20,
                "width": erased_document["crop_rect"]["width"] - 40,
                "height": erased_document["crop_rect"]["height"] - 40,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["erase_paths"] == []


def test_update_transform_perspective_clears_erase_paths(
    client: TestClient,
    fixture_dir: Path,
) -> None:
    document = _upload_document(client, fixture_dir / "worksheet-screenshot.png")
    _save_erase_path(client, document)

    response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "user_corners": [
                [60, 80],
                [830, 70],
                [845, 1145],
                [75, 1160],
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["erase_paths"] == []


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
    crop_response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "crop_rect": {
                "x": 10,
                "y": 15,
                "width": update_response.json()["crop_rect"]["width"] - 40,
                "height": update_response.json()["crop_rect"]["height"] - 60,
            }
        },
    )
    assert crop_response.status_code == 200
    cropped_document = crop_response.json()

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
    assert rerun_document["crop_rect"] == cropped_document["crop_rect"]


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
    crop_response = client.post(
        f"/api/documents/{document['id']}/update-transform",
        json={
            "crop_rect": {
                "x": 25,
                "y": 20,
                "width": update_response.json()["crop_rect"]["width"] - 80,
                "height": update_response.json()["crop_rect"]["height"] - 100,
            }
        },
    )
    assert crop_response.status_code == 200

    rerun_response = client.post(
        f"/api/documents/{document['id']}/auto-detect",
        json={"apply_to_user_corners": True},
    )

    assert rerun_response.status_code == 200
    rerun_document = rerun_response.json()
    assert rerun_document["user_corners"] == rerun_document["auto_corners"]
    assert rerun_document["crop_rect"]["x"] == 0
    assert rerun_document["crop_rect"]["y"] == 0


def _upload_document(client: TestClient, path: Path) -> dict[str, object]:
    session = client.post("/api/sessions").json()
    with path.open("rb") as fixture_file:
        response = client.post(
            f"/api/sessions/{session['id']}/documents",
            files={"files": (path.name, fixture_file, "image/png")},
        )

    assert response.status_code == 200
    return response.json()["documents"][0]


def _save_erase_path(
    client: TestClient,
    document: dict[str, object],
) -> dict[str, object]:
    response = client.post(
        f"/api/documents/{document['id']}/erase",
        json={"erase_paths": [_build_center_erase_path(document)]},
    )
    assert response.status_code == 200
    return response.json()


def _build_center_erase_path(document: dict[str, object]) -> dict[str, object]:
    crop_rect = document["crop_rect"]
    width = crop_rect["width"]
    height = crop_rect["height"]

    return {
        "points": [
            [width * 0.2, height * 0.2],
            [width * 0.8, height * 0.2],
            [width * 0.8, height * 0.8],
            [width * 0.2, height * 0.8],
        ],
        "mode": "fill_white",
    }


def _load_preview_image(client: TestClient, preview_url: str) -> Image.Image:
    response = client.get(preview_url)
    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as preview_image:
        return preview_image.copy()
