from __future__ import annotations

from pathlib import Path

from PIL import Image

from app.schemas.document import TonePreset
from app.services.enhance import apply_tone


def test_printer_friendly_lifts_photographed_paper_background(fixture_dir: Path) -> None:
    with Image.open(fixture_dir / "camera-skewed-page.png") as image:
        natural_white_ratio = _white_pixel_ratio(image)
        printer_friendly = apply_tone(
            image,
            tone_preset=TonePreset.PRINTER_FRIENDLY,
            brightness=0,
            contrast=0,
        )

    assert natural_white_ratio < 0.05
    assert _white_pixel_ratio(printer_friendly) > 0.5


def test_high_contrast_bw_avoids_shadow_blocks(fixture_dir: Path) -> None:
    with Image.open(fixture_dir / "camera-skewed-page.png") as image:
        rendered = apply_tone(
            image,
            tone_preset=TonePreset.HIGH_CONTRAST_BW,
            brightness=0,
            contrast=0,
        )

    grayscale = rendered.convert("L")
    histogram = grayscale.histogram()
    total_pixels = sum(histogram)
    dark_ratio = sum(histogram[:45]) / total_pixels
    binary_ratio = (histogram[0] + histogram[255]) / total_pixels

    assert dark_ratio < 0.3
    assert binary_ratio > 0.99


def _white_pixel_ratio(image: Image.Image) -> float:
    histogram = image.convert("L").histogram()
    return sum(histogram[245:]) / sum(histogram)
