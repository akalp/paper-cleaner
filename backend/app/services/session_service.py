from fastapi import HTTPException, status

from app.schemas.document import DocumentResponse
from app.schemas.session import ReorderSessionDocumentsRequest, SessionResponse
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
            documents = [self.to_document_response(document) for document in storage.list_documents(session.document_ids)]
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

    def reorder_documents(
        self,
        session_id: str,
        request: ReorderSessionDocumentsRequest,
    ) -> SessionResponse:
        session = storage.get_session(session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{session_id}' was not found.",
            )

        requested_ids = request.document_ids
        if len(requested_ids) != len(set(requested_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document order must not contain duplicate document ids.",
            )

        current_ids = set(session.document_ids)
        requested_id_set = set(requested_ids)
        if requested_id_set != current_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document order must include exactly the documents in the session.",
            )

        try:
            documents_by_id = {
                document.id: document for document in storage.list_documents(session.document_ids)
            }
        except StorageConsistencyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc

        now = storage.utcnow()
        for index, document_id in enumerate(requested_ids):
            document = documents_by_id[document_id]
            document.order_index = index
            document.updated_at = now
            storage.save_document(document)

        session.document_ids = list(requested_ids)
        session.updated_at = now
        storage.save_session(session)
        return self.get_session_response(session_id)

    def to_document_response(self, document) -> DocumentResponse:
        return DocumentResponse(
            id=document.id,
            filename=document.filename,
            order_index=document.order_index,
            normalized_width=document.normalized_width,
            normalized_height=document.normalized_height,
            auto_detect_status=document.auto_detect_status,
            auto_corners=document.auto_corners,
            user_corners=document.user_corners,
            crop_rect=document.crop_rect,
            tone_preset=document.tone_preset,
            brightness=document.brightness,
            contrast=document.contrast,
            erase_paths=document.erase_paths,
            source_url=f"/api/documents/{document.id}/source",
            preview_url=f"/api/documents/{document.id}/preview",
            transformed_preview_url=f"/api/documents/{document.id}/preview?stage=transformed",
            preview_version=document.updated_at,
        )


session_service = SessionService()
