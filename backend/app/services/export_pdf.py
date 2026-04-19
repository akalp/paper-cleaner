from __future__ import annotations

from fastapi import HTTPException, status
import img2pdf

from app.services.export_image import export_image_service
from app.storage.storage import StorageConsistencyError, storage


class ExportPdfService:
    def render_session_pdf(self, session_id: str) -> bytes:
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
            image_bytes = [
                export_image_service.render_png_bytes(document)
                for document in documents
            ]
            return img2pdf.convert(image_bytes)
        except HTTPException:
            raise
        except StorageConsistencyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Session '{session_id}' could not be exported as a PDF.",
            ) from exc


export_pdf_service = ExportPdfService()
