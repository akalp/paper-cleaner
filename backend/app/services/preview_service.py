from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import settings


class PreviewService:
    def generate_preview(self, source_path: Path, destination_path: Path) -> None:
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source_path) as image:
            preview = ImageOps.exif_transpose(image)
            preview.thumbnail(settings.preview_max_size)
            if preview.mode not in ("RGB", "RGBA"):
                preview = preview.convert("RGB")
            preview.save(destination_path, format="PNG")


preview_service = PreviewService()
