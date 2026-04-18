from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.schemas.document import DocumentMetadata
from app.schemas.session import SessionMetadata


class StorageConsistencyError(Exception):
    pass


class FileSystemStorage:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir

    def ensure_directories(self) -> None:
        for path in (
            settings.uploads_dir,
            settings.previews_dir,
            settings.temp_dir,
            settings.session_metadata_dir,
            settings.document_metadata_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)

    def new_session_id(self) -> str:
        return f"session_{uuid4().hex[:12]}"

    def new_document_id(self) -> str:
        return f"doc_{uuid4().hex[:12]}"

    def session_metadata_path(self, session_id: str) -> Path:
        return settings.session_metadata_dir / f"{session_id}.json"

    def document_metadata_path(self, document_id: str) -> Path:
        return settings.document_metadata_dir / f"{document_id}.json"

    def uploads_session_dir(self, session_id: str) -> Path:
        return settings.uploads_dir / session_id

    def preview_path(self, document_id: str) -> Path:
        return settings.previews_dir / f"{document_id}.png"

    def public_path(self, path: Path) -> str:
        return str(path.relative_to(self.root_dir))

    def utcnow(self) -> str:
        return datetime.now(UTC).isoformat()

    def create_session(self) -> SessionMetadata:
        self.ensure_directories()
        now = self.utcnow()
        session = SessionMetadata(
            id=self.new_session_id(),
            created_at=now,
            updated_at=now,
            document_ids=[],
        )
        self.save_session(session)
        return session

    def get_session(self, session_id: str) -> SessionMetadata | None:
        path = self.session_metadata_path(session_id)
        if not path.is_file():
            return None
        return SessionMetadata.model_validate_json(path.read_text())

    def save_session(self, session: SessionMetadata) -> SessionMetadata:
        self.ensure_directories()
        path = self.session_metadata_path(session.id)
        self._write_json_atomic(path, session.model_dump(mode="json"))
        return session

    def create_upload_path(self, session_id: str, document_id: str, filename: str) -> Path:
        upload_dir = self.uploads_session_dir(session_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(filename).suffix.lower() or ".bin"
        return upload_dir / f"{document_id}{suffix}"

    def get_document(self, document_id: str) -> DocumentMetadata | None:
        path = self.document_metadata_path(document_id)
        if not path.is_file():
            return None
        return DocumentMetadata.model_validate_json(path.read_text())

    def save_document(self, document: DocumentMetadata) -> DocumentMetadata:
        self.ensure_directories()
        path = self.document_metadata_path(document.id)
        self._write_json_atomic(path, document.model_dump(mode="json"))
        return document

    def list_documents(self, document_ids: list[str]) -> list[DocumentMetadata]:
        documents: list[DocumentMetadata] = []
        for document_id in document_ids:
            document = self.get_document(document_id)
            if document is None:
                raise StorageConsistencyError(
                    f"Session references missing document metadata '{document_id}'."
                )
            documents.append(document)
        return documents

    def remove_file(self, path: Path) -> None:
        if path.is_file():
            path.unlink()

    def remove_directory_if_empty(self, path: Path) -> None:
        if not path.is_dir():
            return
        try:
            path.rmdir()
        except OSError:
            return

    def _write_json_atomic(self, path: Path, payload: dict[str, object]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = path.with_suffix(f"{path.suffix}.tmp")
        try:
            temporary_path.write_text(
                json.dumps(payload, indent=2) + "\n",
                encoding="utf-8",
            )
            temporary_path.replace(path)
        finally:
            if temporary_path.exists():
                temporary_path.unlink()


storage = FileSystemStorage(settings.base_dir.parent)
