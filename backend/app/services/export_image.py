from __future__ import annotations

from io import BytesIO
from pathlib import Path
import re

from fastapi import HTTPException, status
from PIL import Image

from app.schemas.document import DocumentMetadata
from app.services.render import render_service
from app.storage.storage import storage


class ExportImageService:
    def get_document(self, document_id: str) -> DocumentMetadata:
        document = storage.get_document(document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_id}' was not found.",
            )
        return document

    def render_document(self, document: DocumentMetadata) -> Image.Image:
        try:
            normalized_image = render_service.load_normalized_image(
                storage.root_dir / document.original_path,
            )
            return render_service.render_document_image(
                normalized_image,
                corners=document.user_corners or document.auto_corners,
                crop_rect=document.crop_rect,
                tone_preset=document.tone_preset,
                brightness=document.brightness,
                contrast=document.contrast,
                erase_paths=document.erase_paths,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document '{document.id}' could not be rendered for export.",
            ) from exc

    def render_png_bytes(self, document: DocumentMetadata) -> bytes:
        return self.image_to_png_bytes(self.render_document(document))

    def image_to_png_bytes(self, image: Image.Image) -> bytes:
        export_image = image.convert("RGB") if image.mode != "RGB" else image
        buffer = BytesIO()
        export_image.save(buffer, format="PNG")
        return buffer.getvalue()

    def filename_for_document(self, document: DocumentMetadata, *, index: int | None = None) -> str:
        stem = Path(document.filename).stem.strip() or document.id
        safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
        if not safe_stem:
            safe_stem = document.id

        if index is None:
            return f"{safe_stem}.png"
        return f"{index + 1:03d}-{safe_stem}.png"


export_image_service = ExportImageService()
