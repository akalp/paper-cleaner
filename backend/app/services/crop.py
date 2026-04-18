from __future__ import annotations

from PIL import Image

from app.schemas.document import CropRect


class CropError(ValueError):
    pass


def full_crop_rect(width: int, height: int) -> CropRect:
    if width <= 0 or height <= 0:
        raise CropError("Crop bounds must be positive.")
    return CropRect(x=0, y=0, width=width, height=height)


def validate_crop_rect(crop_rect: CropRect, *, image_width: int, image_height: int) -> CropRect:
    if crop_rect.x >= image_width or crop_rect.y >= image_height:
        raise CropError("Crop rectangle must stay within the transformed image bounds.")

    if crop_rect.x + crop_rect.width > image_width or crop_rect.y + crop_rect.height > image_height:
        raise CropError("Crop rectangle must stay within the transformed image bounds.")

    return CropRect(
        x=crop_rect.x,
        y=crop_rect.y,
        width=crop_rect.width,
        height=crop_rect.height,
    )


def apply_crop(image: Image.Image, crop_rect: CropRect) -> Image.Image:
    validated_crop = validate_crop_rect(
        crop_rect,
        image_width=image.width,
        image_height=image.height,
    )
    return image.crop(
        (
            validated_crop.x,
            validated_crop.y,
            validated_crop.x + validated_crop.width,
            validated_crop.y + validated_crop.height,
        )
    )
