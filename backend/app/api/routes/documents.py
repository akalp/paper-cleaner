from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services.document_service import document_service

router = APIRouter()


@router.get("/documents/{document_id}/preview", response_model=None)
async def get_document_preview(document_id: str) -> FileResponse:
    return FileResponse(document_service.get_preview_path(document_id), media_type="image/png")
