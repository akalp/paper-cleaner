from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.schemas.document import AutoDetectStatus
from app.services.detect_document import detect_document_service


def test_detects_screenshot_fixture(fixture_dir: Path) -> None:
    detection = _detect_fixture(fixture_dir / "worksheet-screenshot.png")

    assert detection.status == AutoDetectStatus.DETECTED
    _assert_four_in_bounds_corners(detection.corners, width=900, height=1200)


def test_detects_camera_fixture(fixture_dir: Path) -> None:
    detection = _detect_fixture(fixture_dir / "camera-skewed-page.png")

    assert detection.status == AutoDetectStatus.DETECTED
    _assert_four_in_bounds_corners(detection.corners, width=1000, height=1400)


def test_falls_back_for_difficult_fixture(fixture_dir: Path) -> None:
    detection = _detect_fixture(fixture_dir / "difficult-cluttered.png")

    assert detection.status == AutoDetectStatus.FALLBACK_FULL_IMAGE
    assert detection.corners == [
        (0.0, 0.0),
        (900.0, 0.0),
        (900.0, 1200.0),
        (0.0, 1200.0),
    ]


def _detect_fixture(path: Path):
    with Image.open(path) as image:
        return detect_document_service.detect(image)


def _assert_four_in_bounds_corners(
    corners: list[tuple[float, float]],
    *,
    width: int,
    height: int,
) -> None:
    assert len(corners) == 4
    for x, y in corners:
        assert 0.0 <= x <= float(width)
        assert 0.0 <= y <= float(height)
