from pydantic import BaseModel, Field

from app.schemas.document import DocumentResponse


class SessionMetadata(BaseModel):
    id: str
    created_at: str
    updated_at: str
    document_ids: list[str] = Field(default_factory=list)


class SessionResponse(BaseModel):
    id: str
    created_at: str
    updated_at: str
    documents: list[DocumentResponse] = Field(default_factory=list)


class SessionSummary(BaseModel):
    id: str
    created_at: str
    updated_at: str
    document_count: int = Field(ge=0)
    first_document_filename: str | None = None


class SessionHistoryResponse(BaseModel):
    sessions: list[SessionSummary] = Field(default_factory=list)


class ReorderSessionDocumentsRequest(BaseModel):
    document_ids: list[str] = Field(default_factory=list)
