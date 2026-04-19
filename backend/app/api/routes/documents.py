from typing import Literal

from fastapi import APIRouter, Query, Response
from fastapi.responses import FileResponse

from app.schemas.document import (
    AutoDetectDocumentRequest,
    DocumentResponse,
    UpdateEraseRequest,
    UpdateToneRequest,
    UpdateTransformRequest,
)
from app.services.document_service import document_service

router = APIRouter()


@router.get("/documents/{document_id}/source", response_model=None)
async def get_document_source(document_id: str) -> FileResponse:
    return FileResponse(document_service.get_source_path(document_id), media_type="image/png")


@router.get("/documents/{document_id}/preview", response_model=None)
async def get_document_preview(
    document_id: str,
    stage: Literal["final", "transformed"] = Query(default="final"),
) -> Response:
    if stage == "transformed":
        return Response(
            content=document_service.render_preview_bytes(document_id, include_crop=False),
            media_type="image/png",
        )
    return FileResponse(document_service.get_preview_path(document_id), media_type="image/png")


@router.post("/documents/{document_id}/auto-detect", response_model=DocumentResponse)
async def auto_detect_document(
    document_id: str,
    request: AutoDetectDocumentRequest | None = None,
) -> DocumentResponse:
    return document_service.auto_detect_document(document_id, request)


@router.post("/documents/{document_id}/update-transform", response_model=DocumentResponse)
async def update_document_transform(
    document_id: str,
    request: UpdateTransformRequest,
) -> DocumentResponse:
    return document_service.update_transform(document_id, request)


@router.post("/documents/{document_id}/update-tone", response_model=DocumentResponse)
async def update_document_tone(
    document_id: str,
    request: UpdateToneRequest,
) -> DocumentResponse:
    return document_service.update_tone(document_id, request)


@router.post("/documents/{document_id}/erase", response_model=DocumentResponse)
async def update_document_erase(
    document_id: str,
    request: UpdateEraseRequest,
) -> DocumentResponse:
    return document_service.update_erase(document_id, request)
