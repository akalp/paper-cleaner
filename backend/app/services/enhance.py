from __future__ import annotations

from PIL import Image, ImageEnhance, ImageOps

from app.schemas.document import TonePreset


def apply_tone(
    image: Image.Image,
    *,
    tone_preset: TonePreset,
    brightness: int,
    contrast: int,
) -> Image.Image:
    toned = image.copy()

    if tone_preset == TonePreset.GRAYSCALE:
        toned = ImageOps.grayscale(toned)
    elif tone_preset == TonePreset.HIGH_CONTRAST_BW:
        grayscale = ImageOps.grayscale(toned)
        toned = ImageOps.autocontrast(grayscale, cutoff=1)
    elif tone_preset == TonePreset.PRINTER_FRIENDLY:
        grayscale = ImageOps.grayscale(toned)
        toned = ImageOps.autocontrast(grayscale, cutoff=2)
    else:
        toned = toned.convert("RGB")

    toned = _apply_brightness_and_contrast(toned, brightness=brightness, contrast=contrast)
    if tone_preset == TonePreset.HIGH_CONTRAST_BW:
        toned = toned.convert("L").point(lambda value: 255 if value >= 185 else 0, mode="L")
    return toned.convert("RGB")


def _apply_brightness_and_contrast(image: Image.Image, *, brightness: int, contrast: int) -> Image.Image:
    adjusted = image

    if brightness != 0:
        brightness_factor = max(0.0, 1.0 + (brightness / 100.0))
        adjusted = ImageEnhance.Brightness(adjusted).enhance(brightness_factor)

    if contrast != 0:
        contrast_factor = max(0.0, 1.0 + (contrast / 100.0))
        adjusted = ImageEnhance.Contrast(adjusted).enhance(contrast_factor)

    return adjusted
