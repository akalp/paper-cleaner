from fastapi import APIRouter, File, UploadFile

from app.schemas.session import SessionResponse
from app.services.document_service import document_service
from app.services.session_service import session_service

router = APIRouter()


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session() -> SessionResponse:
    return session_service.create_session()


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    return session_service.get_session_response(session_id)


@router.post("/sessions/{session_id}/documents", response_model=SessionResponse)
async def upload_documents(
    session_id: str,
    files: list[UploadFile] = File(...),
) -> SessionResponse:
    return document_service.upload_documents(session_id, files)
