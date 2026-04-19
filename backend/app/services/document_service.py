from __future__ import annotations

from pathlib import Path
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.schemas.document import (
    AutoDetectDocumentRequest,
    CropRect,
    DocumentMetadata,
    DocumentResponse,
    UpdateEraseRequest,
    UpdateToneRequest,
    UpdateTransformRequest,
)
from app.services.crop import CropError, full_crop_rect, validate_crop_rect
from app.services.erase import EraseError, erase_service
from app.schemas.session import SessionMetadata, SessionResponse
from app.services.detect_document import detect_document_service
from app.services.perspective import PerspectiveError, normalize_corners, transformed_size
from app.services.preview_service import preview_service
from app.services.render import render_service
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
                source_path = storage.source_path(document_id)
                preview_path = storage.preview_path(document_id)

                self._write_upload(upload, original_path)
                created_paths.append(original_path)
                created_paths.append(source_path)

                normalized_image = self._load_normalized_image(original_path)
                width, height = normalized_image.size
                detection_result = detect_document_service.detect(normalized_image)
                initial_crop_rect = self._full_crop_rect(detection_result.corners)
                preview_service.generate_document_assets(
                    original_path=original_path,
                    source_destination_path=source_path,
                    preview_destination_path=preview_path,
                    corners=detection_result.corners,
                    crop_rect=initial_crop_rect,
                    tone_preset=DocumentMetadata.model_fields["tone_preset"].default,
                    brightness=0,
                    contrast=0,
                    erase_paths=[],
                )
                created_paths.append(preview_path)
                now = storage.utcnow()

                document = DocumentMetadata(
                    id=document_id,
                    session_id=session_id,
                    filename=filename,
                    original_path=storage.public_path(original_path),
                    preview_path=storage.public_path(preview_path),
                    order_index=next_order_index + offset,
                    normalized_width=width,
                    normalized_height=height,
                    auto_detect_status=detection_result.status,
                    auto_corners=detection_result.corners,
                    crop_rect=initial_crop_rect,
                    updated_at=now,
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
            self._regenerate_preview(document)
        return preview_path

    def render_preview_bytes(self, document_id: str, *, include_crop: bool) -> bytes:
        document = self._get_document(document_id)
        normalized_image = self._load_normalized_image(storage.root_dir / document.original_path)
        rendered_preview = render_service.render_preview_image(
            normalized_image,
            corners=self._effective_corners(document),
            crop_rect=document.crop_rect,
            tone_preset=document.tone_preset,
            brightness=document.brightness,
            contrast=document.contrast,
            erase_paths=document.erase_paths if include_crop else [],
            include_crop=include_crop,
        )

        buffer = BytesIO()
        rendered_preview.save(buffer, format="PNG")
        return buffer.getvalue()

    def get_source_path(self, document_id: str) -> Path:
        document = self._get_document(document_id)
        source_path = storage.source_path(document_id)
        if not source_path.is_file():
            preview_service.generate_source_image(
                storage.root_dir / document.original_path,
                source_path,
            )
        return source_path

    def auto_detect_document(
        self,
        document_id: str,
        request: AutoDetectDocumentRequest | None = None,
    ) -> DocumentResponse:
        document = self._get_document(document_id)
        normalized_image = self._load_normalized_image(storage.root_dir / document.original_path)
        detection_result = detect_document_service.detect(normalized_image)
        original_effective_corners = self._effective_corners(document)
        original_crop_rect = document.crop_rect.model_copy()

        document.auto_corners = detection_result.corners
        document.auto_detect_status = detection_result.status
        if request is not None and request.apply_to_user_corners:
            document.user_corners = detection_result.corners

        effective_corners = self._effective_corners(document)
        if effective_corners != original_effective_corners:
            document.crop_rect = self._full_crop_rect(effective_corners)
        else:
            document.crop_rect = self._validated_crop_rect(
                document.crop_rect,
                corners=effective_corners,
            )
        if effective_corners != original_effective_corners or document.crop_rect != original_crop_rect:
            self._clear_erase_paths(document)
        document.updated_at = storage.utcnow()
        storage.save_document(document)
        storage.touch_session(document.session_id, document.updated_at)
        self._regenerate_preview(document)
        return session_service.to_document_response(document)

    def update_transform(
        self,
        document_id: str,
        request: UpdateTransformRequest,
    ) -> DocumentResponse:
        document = self._get_document(document_id)
        original_effective_corners = self._effective_corners(document)
        original_crop_rect = document.crop_rect.model_copy()
        fields_set = request.model_fields_set
        corners_changed = False

        try:
            if "user_corners" in fields_set:
                corners_changed = True
                if request.user_corners is None:
                    document.user_corners = None
                else:
                    document.user_corners = normalize_corners(
                        request.user_corners,
                        width=document.normalized_width,
                        height=document.normalized_height,
                    )

            effective_corners = self._effective_corners(document)
            if "crop_rect" in fields_set:
                if request.crop_rect is None:
                    document.crop_rect = self._full_crop_rect(effective_corners)
                else:
                    document.crop_rect = self._validated_crop_rect(
                        request.crop_rect,
                        corners=effective_corners,
                    )
            elif corners_changed and effective_corners != original_effective_corners:
                document.crop_rect = self._full_crop_rect(effective_corners)
            else:
                document.crop_rect = self._validated_crop_rect(
                    document.crop_rect,
                    corners=effective_corners,
                )
        except (PerspectiveError, CropError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        if (
            self._effective_corners(document) != original_effective_corners
            or document.crop_rect != original_crop_rect
        ):
            self._clear_erase_paths(document)

        document.updated_at = storage.utcnow()
        storage.save_document(document)
        storage.touch_session(document.session_id, document.updated_at)

        self._regenerate_preview(document)
        return session_service.to_document_response(document)

    def update_erase(
        self,
        document_id: str,
        request: UpdateEraseRequest,
    ) -> DocumentResponse:
        document = self._get_document(document_id)

        try:
            document.erase_paths = erase_service.validate_erase_paths(
                request.erase_paths,
                image_width=document.crop_rect.width,
                image_height=document.crop_rect.height,
            )
        except EraseError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        document.updated_at = storage.utcnow()
        storage.save_document(document)
        storage.touch_session(document.session_id, document.updated_at)
        self._regenerate_preview(document)
        return session_service.to_document_response(document)

    def update_tone(
        self,
        document_id: str,
        request: UpdateToneRequest,
    ) -> DocumentResponse:
        document = self._get_document(document_id)

        document.tone_preset = request.tone_preset
        document.brightness = request.brightness
        document.contrast = request.contrast
        document.updated_at = storage.utcnow()
        storage.save_document(document)
        storage.touch_session(document.session_id, document.updated_at)

        self._regenerate_preview(document)
        return session_service.to_document_response(document)

    def _get_session_metadata(self, session_id: str) -> SessionMetadata:
        session = storage.get_session(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )
        return session

    def _get_document(self, document_id: str) -> DocumentMetadata:
        document = storage.get_document(document_id)
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_id}' was not found.",
            )
        return document

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

    def _load_normalized_image(self, path: Path) -> Image.Image:
        try:
            return render_service.load_normalized_image(path)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{path.name}' could not be read as an image.",
            ) from exc

    def _effective_corners(self, document: DocumentMetadata):
        return document.user_corners or document.auto_corners

    def _full_crop_rect(self, corners):
        crop_width, crop_height = transformed_size(corners)
        return full_crop_rect(crop_width, crop_height)

    def _validated_crop_rect(self, crop_rect: CropRect, *, corners) -> CropRect:
        crop_width, crop_height = transformed_size(corners)
        return validate_crop_rect(
            crop_rect,
            image_width=crop_width,
            image_height=crop_height,
        )

    def _regenerate_preview(self, document: DocumentMetadata) -> None:
        preview_service.generate_preview(
            storage.root_dir / document.original_path,
            storage.root_dir / document.preview_path,
            corners=self._effective_corners(document),
            crop_rect=document.crop_rect,
            tone_preset=document.tone_preset,
            brightness=document.brightness,
            contrast=document.contrast,
            erase_paths=document.erase_paths,
        )

    def _clear_erase_paths(self, document: DocumentMetadata) -> None:
        if document.erase_paths:
            document.erase_paths = []

    def _cleanup_paths(self, paths: list[Path], session_id: str) -> None:
        for path in reversed(paths):
            storage.remove_file(path)
        storage.remove_directory_if_empty(storage.uploads_session_dir(session_id))


document_service = DocumentService()
