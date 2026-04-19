from __future__ import annotations

import cv2
import numpy as np
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
        flattened = _flatten_paper_background(grayscale)
        toned = ImageOps.autocontrast(flattened, cutoff=1)
    elif tone_preset == TonePreset.PRINTER_FRIENDLY:
        grayscale = ImageOps.grayscale(toned)
        flattened = _flatten_paper_background(grayscale)
        toned = ImageOps.autocontrast(flattened, cutoff=1)
    else:
        toned = toned.convert("RGB")

    toned = _apply_brightness_and_contrast(toned, brightness=brightness, contrast=contrast)
    if tone_preset == TonePreset.HIGH_CONTRAST_BW:
        toned = _adaptive_binary_threshold(toned)
    elif tone_preset == TonePreset.PRINTER_FRIENDLY:
        toned = _lift_paper_background(toned)
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


def _flatten_paper_background(image: Image.Image) -> Image.Image:
    grayscale = image.convert("L")
    image_array = np.asarray(grayscale, dtype=np.uint8)
    shortest_side = min(image_array.shape)
    blur_sigma = max(shortest_side / 22.0, 15.0)
    background = cv2.GaussianBlur(
        image_array,
        (0, 0),
        sigmaX=blur_sigma,
        sigmaY=blur_sigma,
    )
    flattened = cv2.divide(image_array, np.maximum(background, 1), scale=255)
    normalized = cv2.normalize(
        flattened,
        None,
        alpha=0,
        beta=255,
        norm_type=cv2.NORM_MINMAX,
    )
    return Image.fromarray(normalized.astype(np.uint8))


def _lift_paper_background(image: Image.Image) -> Image.Image:
    image_array = np.asarray(image.convert("L"), dtype=np.float32)
    lifted = 255.0 - ((255.0 - image_array) * 1.35)
    lifted[lifted > 238.0] = 255.0
    return Image.fromarray(np.clip(lifted, 0, 255).astype(np.uint8))


def _adaptive_binary_threshold(image: Image.Image) -> Image.Image:
    image_array = np.asarray(image.convert("L"), dtype=np.uint8)
    block_size = _adaptive_threshold_block_size(image_array)
    thresholded = cv2.adaptiveThreshold(
        image_array,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        12,
    )
    return Image.fromarray(thresholded)


def _adaptive_threshold_block_size(image_array: np.ndarray) -> int:
    shortest_side = min(image_array.shape)
    block_size = max(31, int(shortest_side / 12))
    if block_size % 2 == 0:
        block_size += 1
    return block_size
