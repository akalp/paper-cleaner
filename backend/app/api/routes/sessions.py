from fastapi import APIRouter, File, Response, UploadFile

from app.schemas.session import (
    ReorderSessionDocumentsRequest,
    SessionHistoryResponse,
    SessionResponse,
)
from app.services.document_service import document_service
from app.services.export_pdf import export_pdf_service
from app.services.export_zip import export_zip_service
from app.services.session_service import session_service

router = APIRouter()


@router.get("/sessions", response_model=SessionHistoryResponse)
async def list_sessions() -> SessionHistoryResponse:
    return session_service.list_sessions()


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session() -> SessionResponse:
    return session_service.create_session()


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    return session_service.get_session_response(session_id)


@router.delete("/sessions/{session_id}", status_code=204, response_model=None)
async def delete_session(session_id: str) -> Response:
    session_service.delete_session(session_id)
    return Response(status_code=204)


@router.post("/sessions/{session_id}/documents", response_model=SessionResponse)
async def upload_documents(
    session_id: str,
    files: list[UploadFile] = File(...),
) -> SessionResponse:
    return document_service.upload_documents(session_id, files)


@router.post("/sessions/{session_id}/reorder", response_model=SessionResponse)
async def reorder_session_documents(
    session_id: str,
    request: ReorderSessionDocumentsRequest,
) -> SessionResponse:
    return session_service.reorder_documents(session_id, request)


@router.get("/sessions/{session_id}/export/pdf", response_model=None)
async def export_session_pdf(session_id: str) -> Response:
    return Response(
        content=export_pdf_service.render_session_pdf(session_id),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="paper-cleaner-{session_id}.pdf"',
        },
    )


@router.get("/sessions/{session_id}/export/zip", response_model=None)
async def export_session_zip(session_id: str) -> Response:
    return Response(
        content=export_zip_service.render_session_zip(session_id),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="paper-cleaner-{session_id}.zip"',
        },
    )
