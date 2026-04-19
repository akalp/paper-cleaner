from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException, status

from app.services.export_image import export_image_service
from app.storage.storage import StorageConsistencyError, storage


class ExportZipService:
    def render_session_zip(self, session_id: str) -> bytes:
        session = storage.get_session(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )
        if not session.document_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session has no documents to export.",
            )

        try:
            documents = storage.list_documents(session.document_ids)
        except StorageConsistencyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc

        buffer = BytesIO()
        try:
            with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
                for index, document in enumerate(documents):
                    archive.writestr(
                        export_image_service.filename_for_document(document, index=index),
                        export_image_service.render_png_bytes(document),
                    )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Session '{session_id}' could not be exported as a ZIP archive.",
            ) from exc

        return buffer.getvalue()


export_zip_service = ExportZipService()
