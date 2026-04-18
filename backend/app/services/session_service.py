from fastapi import HTTPException, status

from app.schemas.document import DocumentResponse
from app.schemas.session import SessionResponse
from app.storage.storage import StorageConsistencyError, storage


class SessionService:
    def create_session(self) -> SessionResponse:
        session = storage.create_session()
        return SessionResponse(
            id=session.id,
            created_at=session.created_at,
            updated_at=session.updated_at,
            documents=[],
        )

    def get_session_response(self, session_id: str) -> SessionResponse:
        session = storage.get_session(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )

        try:
            documents = [
                DocumentResponse(
                    id=document.id,
                    filename=document.filename,
                    order_index=document.order_index,
                    auto_corners=document.auto_corners,
                    user_corners=document.user_corners,
                    crop_rect=document.crop_rect,
                    tone_preset=document.tone_preset,
                    brightness=document.brightness,
                    contrast=document.contrast,
                    erase_paths=document.erase_paths,
                    preview_url=f"/api/documents/{document.id}/preview",
                )
                for document in storage.list_documents(session.document_ids)
            ]
        except StorageConsistencyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc

        return SessionResponse(
            id=session.id,
            created_at=session.created_at,
            updated_at=session.updated_at,
            documents=documents,
        )


session_service = SessionService()
