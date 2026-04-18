from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import settings
from app.schemas.document import Point
from app.services.perspective import apply_perspective_transform


class RenderService:
    def load_normalized_image(self, source_path: Path) -> Image.Image:
        with Image.open(source_path) as image:
            normalized = ImageOps.exif_transpose(image)
            return normalized.copy()

    def render_source_image(self, image: Image.Image) -> Image.Image:
        source = image.copy()
        source.thumbnail(settings.preview_max_size)
        return self._to_png_compatible(source)

    def render_preview_image(self, image: Image.Image, corners: list[Point]) -> Image.Image:
        transformed = apply_perspective_transform(image, corners)
        transformed.thumbnail(settings.preview_max_size)
        return self._to_png_compatible(transformed)

    def _to_png_compatible(self, image: Image.Image) -> Image.Image:
        if image.mode in ("RGB", "RGBA"):
            return image
        return image.convert("RGB")


render_service = RenderService()
