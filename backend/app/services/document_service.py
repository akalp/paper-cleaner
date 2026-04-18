from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

from app.schemas.document import CropRect, DocumentMetadata
from app.schemas.session import SessionMetadata, SessionResponse
from app.services.preview_service import preview_service
from app.services.session_service import session_service
from app.storage.storage import storage

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


class DocumentService:
    def upload_documents(self, session_id: str, files: list[UploadFile]) -> SessionResponse:
        session = self._get_session_metadata(session_id)
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one image file is required.",
            )

        next_order_index = len(session.document_ids)
        created_document_ids: list[str] = []
        created_paths: list[Path] = []

        try:
            for offset, upload in enumerate(files):
                filename = self._normalized_filename(upload.filename)
                self._validate_upload(upload, filename)

                document_id = storage.new_document_id()
                original_path = storage.create_upload_path(session_id, document_id, filename)
                preview_path = storage.preview_path(document_id)

                self._write_upload(upload, original_path)
                created_paths.append(original_path)

                width, height = self._read_image_size(original_path)
                preview_service.generate_preview(original_path, preview_path)
                created_paths.append(preview_path)

                document = DocumentMetadata(
                    id=document_id,
                    session_id=session_id,
                    filename=filename,
                    original_path=storage.public_path(original_path),
                    preview_path=storage.public_path(preview_path),
                    order_index=next_order_index + offset,
                    auto_corners=[
                        (0.0, 0.0),
                        (float(width), 0.0),
                        (float(width), float(height)),
                        (0.0, float(height)),
                    ],
                    crop_rect=CropRect(x=0, y=0, width=width, height=height),
                )
                storage.save_document(document)
                created_paths.append(storage.document_metadata_path(document_id))
                created_document_ids.append(document_id)

            session.document_ids.extend(created_document_ids)
            session.updated_at = storage.utcnow()
            storage.save_session(session)
        except Exception:
            self._cleanup_paths(created_paths, session_id)
            raise

        return session_service.get_session_response(session_id)

    def get_preview_path(self, document_id: str) -> Path:
        document = storage.get_document(document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_id}' was not found.",
            )

        preview_path = storage.root_dir / document.preview_path
        if not preview_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Preview for document '{document_id}' was not found.",
            )
        return preview_path

    def _get_session_metadata(self, session_id: str) -> SessionMetadata:
        session = storage.get_session(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )
        return session

    def _normalized_filename(self, filename: str | None) -> str:
        cleaned_name = Path(filename or "upload").name.strip()
        return cleaned_name or "upload"

    def _validate_upload(self, upload: UploadFile, filename: str) -> None:
        extension = Path(filename).suffix.lower()
        has_valid_extension = extension in ALLOWED_IMAGE_EXTENSIONS
        has_image_content_type = bool(upload.content_type and upload.content_type.startswith("image/"))
        if not has_valid_extension and not has_image_content_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{filename}' is not a supported image upload.",
            )

    def _write_upload(self, upload: UploadFile, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        upload.file.seek(0)
        with destination.open("wb") as output:
            while chunk := upload.file.read(1024 * 1024):
                output.write(chunk)

    def _read_image_size(self, path: Path) -> tuple[int, int]:
        try:
            with Image.open(path) as image:
                normalized = ImageOps.exif_transpose(image)
                return normalized.size
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{path.name}' could not be read as an image.",
            ) from exc

    def _cleanup_paths(self, paths: list[Path], session_id: str) -> None:
        for path in reversed(paths):
            storage.remove_file(path)
        storage.remove_directory_if_empty(storage.uploads_session_dir(session_id))


document_service = DocumentService()
