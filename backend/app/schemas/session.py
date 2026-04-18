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

