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
        prepared, prepared_corners, prepared_crop, prepared_erase = self._prepare_preview_input(
            image,
            corners=corners,
            crop_rect=crop_rect,
            erase_paths=erase_paths,
        )
        rendered = self.render_document_image(
            prepared,
            corners=prepared_corners,
            crop_rect=prepared_crop,
            tone_preset=tone_preset,
            brightness=brightness,
            contrast=contrast,
            erase_paths=prepared_erase,
            include_crop=include_crop,
        )
        rendered.thumbnail(settings.preview_max_size)
        return self._to_png_compatible(rendered)

    def _prepare_preview_input(
        self,
        image: Image.Image,
        *,
        corners: list[Point],
        crop_rect: CropRect,
        erase_paths: list[ErasePath] | None,
    ) -> tuple[Image.Image, list[Point], CropRect, list[ErasePath]]:
        image_width, image_height = image.size
        max_width, max_height = settings.preview_max_size
        scale = min(1.0, max_width / image_width, max_height / image_height)
        if scale >= 1.0:
            return image, corners, crop_rect, erase_paths or []

        scaled_image = image.resize(
            (max(1, round(image_width * scale)), max(1, round(image_height * scale))),
            Image.Resampling.LANCZOS,
        )
        scaled_corners = [(x * scale, y * scale) for x, y in corners]
        scaled_crop = CropRect(
            x=round(crop_rect.x * scale),
            y=round(crop_rect.y * scale),
            width=max(1, round(crop_rect.width * scale)),
            height=max(1, round(crop_rect.height * scale)),
        )
        scaled_erase = [
            ErasePath(
                points=[(x * scale, y * scale) for x, y in erase_path.points],
                mode=erase_path.mode,
            )
            for erase_path in erase_paths or []
        ]
        return scaled_image, scaled_corners, scaled_crop, scaled_erase

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
        erased = erase_service.apply_erase_paths(toned, erase_paths or [])
        return self._to_png_compatible(erased)

    def _to_png_compatible(self, image: Image.Image) -> Image.Image:
        if image.mode in ("RGB", "RGBA"):
            return image
        return image.convert("RGB")


render_service = RenderService()
