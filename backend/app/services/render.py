from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import settings
from app.schemas.document import CropRect, ErasePath, Point, TonePreset
from app.services.crop import apply_crop
from app.services.erase import erase_service
from app.services.enhance import apply_tone
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

    def render_preview_image(
        self,
        image: Image.Image,
        *,
        corners: list[Point],
        crop_rect: CropRect,
        tone_preset: TonePreset,
        brightness: int,
        contrast: int,
        erase_paths: list[ErasePath] | None = None,
        include_crop: bool = True,
    ) -> Image.Image:
        rendered = self.render_document_image(
            image,
            corners=corners,
            crop_rect=crop_rect,
            tone_preset=tone_preset,
            brightness=brightness,
            contrast=contrast,
            erase_paths=erase_paths,
            include_crop=include_crop,
        )
        rendered.thumbnail(settings.preview_max_size)
        return self._to_png_compatible(rendered)

    def render_document_image(
        self,
        image: Image.Image,
        *,
        corners: list[Point],
        crop_rect: CropRect,
        tone_preset: TonePreset,
        brightness: int,
        contrast: int,
        erase_paths: list[ErasePath] | None = None,
        include_crop: bool = True,
    ) -> Image.Image:
        transformed = apply_perspective_transform(image, corners)
        working_image = apply_crop(transformed, crop_rect) if include_crop else transformed
        toned = apply_tone(
            working_image,
            tone_preset=tone_preset,
            brightness=brightness,
            contrast=contrast,
        )
        erased = erase_service.apply_erase_paths(
            self._to_png_compatible(toned),
            erase_paths or [],
        )
        return self._to_png_compatible(erased)

    def _to_png_compatible(self, image: Image.Image) -> Image.Image:
        if image.mode in ("RGB", "RGBA"):
            return image
        return image.convert("RGB")


render_service = RenderService()
