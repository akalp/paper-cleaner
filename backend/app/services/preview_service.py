from __future__ import annotations

from pathlib import Path

from app.schemas.document import Point
from app.services.render import render_service


class PreviewService:
    def generate_document_assets(
        self,
        original_path: Path,
        source_destination_path: Path,
        preview_destination_path: Path,
        corners: list[Point],
    ) -> tuple[int, int]:
        normalized_image = render_service.load_normalized_image(original_path)
        normalized_width, normalized_height = normalized_image.size

        self._save_png(
            render_service.render_source_image(normalized_image),
            source_destination_path,
        )
        self._save_png(
            render_service.render_preview_image(normalized_image, corners),
            preview_destination_path,
        )
        return normalized_width, normalized_height

    def generate_preview(self, source_path: Path, destination_path: Path, corners: list[Point]) -> None:
        normalized_image = render_service.load_normalized_image(source_path)
        self._save_png(
            render_service.render_preview_image(normalized_image, corners),
            destination_path,
        )

    def generate_source_image(self, source_path: Path, destination_path: Path) -> tuple[int, int]:
        normalized_image = render_service.load_normalized_image(source_path)
        self._save_png(
            render_service.render_source_image(normalized_image),
            destination_path,
        )
        return normalized_image.size

    def _save_png(self, image, destination_path: Path) -> None:
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination_path, format="PNG")


preview_service = PreviewService()
