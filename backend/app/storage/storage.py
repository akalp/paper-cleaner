from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.schemas.document import CropRect, DocumentMetadata
from app.schemas.session import SessionMetadata, SessionSummary


class StorageConsistencyError(Exception):
    pass


class FileSystemStorage:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir

    def ensure_directories(self) -> None:
        for path in (
            settings.uploads_dir,
            self.sources_dir(),
            settings.previews_dir,
            settings.temp_dir,
            settings.metadata_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)
        self._ensure_database()

    def new_session_id(self) -> str:
        return f"session_{uuid4().hex[:12]}"

    def new_document_id(self) -> str:
        return f"doc_{uuid4().hex[:12]}"

    def session_metadata_path(self, session_id: str) -> Path:
        return settings.session_metadata_dir / f"{session_id}.json"

    def document_metadata_path(self, document_id: str) -> Path:
        return settings.document_metadata_dir / f"{document_id}.json"

    def database_path(self) -> Path:
        return settings.metadata_db_path

    def uploads_session_dir(self, session_id: str) -> Path:
        return settings.uploads_dir / session_id

    def preview_path(self, document_id: str) -> Path:
        return settings.previews_dir / f"{document_id}.png"

    def source_path(self, document_id: str) -> Path:
        return self.sources_dir() / f"{document_id}.png"

    def sources_dir(self) -> Path:
        return settings.rendered_dir / "sources"

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
        self.ensure_directories()
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id, created_at, updated_at FROM sessions WHERE id = ?",
                (session_id,),
            ).fetchone()
            if row is None:
                return None
            document_rows = connection.execute(
                """
                SELECT id
                FROM documents
                WHERE session_id = ?
                ORDER BY order_index ASC, id ASC
                """,
                (session_id,),
            ).fetchall()
        return SessionMetadata(
            id=row["id"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            document_ids=[document_row["id"] for document_row in document_rows],
        )

    def save_session(self, session: SessionMetadata) -> SessionMetadata:
        self.ensure_directories()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sessions (id, created_at, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                """,
                (session.id, session.created_at, session.updated_at),
            )
        return session

    def touch_session(self, session_id: str, updated_at: str) -> None:
        self.ensure_directories()
        with self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (updated_at, session_id),
            )

    def create_upload_path(self, session_id: str, document_id: str, filename: str) -> Path:
        upload_dir = self.uploads_session_dir(session_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(filename).suffix.lower() or ".bin"
        return upload_dir / f"{document_id}{suffix}"

    def get_document(self, document_id: str) -> DocumentMetadata | None:
        self.ensure_directories()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, session_id, filename, original_path, preview_path, order_index,
                    normalized_width, normalized_height, auto_detect_status, auto_corners,
                    user_corners, crop_rect, tone_preset, brightness, contrast, erase_paths,
                    updated_at
                FROM documents
                WHERE id = ?
                """,
                (document_id,),
            ).fetchone()
        if row is None:
            return None
        return self._document_from_row(row)

    def save_document(self, document: DocumentMetadata) -> DocumentMetadata:
        self.ensure_directories()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO documents (
                    id, session_id, filename, original_path, preview_path, order_index,
                    normalized_width, normalized_height, auto_detect_status, auto_corners,
                    user_corners, crop_rect, tone_preset, brightness, contrast, erase_paths,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    session_id = excluded.session_id,
                    filename = excluded.filename,
                    original_path = excluded.original_path,
                    preview_path = excluded.preview_path,
                    order_index = excluded.order_index,
                    normalized_width = excluded.normalized_width,
                    normalized_height = excluded.normalized_height,
                    auto_detect_status = excluded.auto_detect_status,
                    auto_corners = excluded.auto_corners,
                    user_corners = excluded.user_corners,
                    crop_rect = excluded.crop_rect,
                    tone_preset = excluded.tone_preset,
                    brightness = excluded.brightness,
                    contrast = excluded.contrast,
                    erase_paths = excluded.erase_paths,
                    updated_at = excluded.updated_at
                """,
                self._document_to_record(document),
            )
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

    def list_session_summaries(self) -> list[SessionSummary]:
        self.ensure_directories()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    sessions.id,
                    sessions.created_at,
                    sessions.updated_at,
                    COUNT(documents.id) AS document_count,
                    (
                        SELECT first_document.filename
                        FROM documents AS first_document
                        WHERE first_document.session_id = sessions.id
                        ORDER BY first_document.order_index ASC, first_document.id ASC
                        LIMIT 1
                    ) AS first_document_filename
                FROM sessions
                LEFT JOIN documents ON documents.session_id = sessions.id
                GROUP BY sessions.id
                ORDER BY sessions.updated_at DESC, sessions.id DESC
                """
            ).fetchall()
        return [
            SessionSummary(
                id=row["id"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                document_count=row["document_count"],
                first_document_filename=row["first_document_filename"],
            )
            for row in rows
        ]

    def delete_session(self, session_id: str) -> bool:
        self.ensure_directories()
        session = self.get_session(session_id)
        if session is None:
            return False
        documents = self.list_documents(session.document_ids)

        with self._connect() as connection:
            connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

        shutil.rmtree(self.uploads_session_dir(session_id), ignore_errors=True)
        for document in documents:
            self.remove_file(self.root_dir / document.preview_path)
            self.remove_file(self.source_path(document.id))
        return True

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

    def _ensure_database(self) -> None:
        settings.metadata_db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL,
                    original_path TEXT NOT NULL,
                    preview_path TEXT NOT NULL,
                    order_index INTEGER NOT NULL,
                    normalized_width INTEGER NOT NULL,
                    normalized_height INTEGER NOT NULL,
                    auto_detect_status TEXT NOT NULL,
                    auto_corners TEXT NOT NULL,
                    user_corners TEXT,
                    crop_rect TEXT NOT NULL,
                    tone_preset TEXT NOT NULL,
                    brightness INTEGER NOT NULL,
                    contrast INTEGER NOT NULL,
                    erase_paths TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_documents_session_order
                    ON documents(session_id, order_index);

                CREATE TABLE IF NOT EXISTS storage_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                """
            )
            legacy_import = connection.execute(
                "SELECT value FROM storage_metadata WHERE key = 'legacy_json_imported'"
            ).fetchone()
            if legacy_import is None:
                self._import_legacy_json(connection)
                connection.execute(
                    """
                    INSERT INTO storage_metadata (key, value)
                    VALUES ('legacy_json_imported', ?)
                    """,
                    (self.utcnow(),),
                )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(settings.metadata_db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _import_legacy_json(self, connection: sqlite3.Connection) -> None:
        for session_path in sorted(settings.session_metadata_dir.glob("*.json")):
            try:
                session = SessionMetadata.model_validate_json(session_path.read_text())
            except Exception:
                continue
            connection.execute(
                """
                INSERT OR IGNORE INTO sessions (id, created_at, updated_at)
                VALUES (?, ?, ?)
                """,
                (session.id, session.created_at, session.updated_at),
            )

        for document_path in sorted(settings.document_metadata_dir.glob("*.json")):
            try:
                document = DocumentMetadata.model_validate_json(document_path.read_text())
            except Exception:
                continue
            try:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO documents (
                        id, session_id, filename, original_path, preview_path, order_index,
                        normalized_width, normalized_height, auto_detect_status, auto_corners,
                        user_corners, crop_rect, tone_preset, brightness, contrast, erase_paths,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    self._document_to_record(document),
                )
            except sqlite3.IntegrityError:
                continue

    def _document_to_record(self, document: DocumentMetadata) -> tuple[object, ...]:
        return (
            document.id,
            document.session_id,
            document.filename,
            document.original_path,
            document.preview_path,
            document.order_index,
            document.normalized_width,
            document.normalized_height,
            document.auto_detect_status.value,
            json.dumps(document.auto_corners),
            json.dumps(document.user_corners),
            json.dumps(document.crop_rect.model_dump(mode="json")),
            document.tone_preset.value,
            document.brightness,
            document.contrast,
            json.dumps([erase_path.model_dump(mode="json") for erase_path in document.erase_paths]),
            document.updated_at,
        )

    def _document_from_row(self, row: sqlite3.Row) -> DocumentMetadata:
        return DocumentMetadata(
            id=row["id"],
            session_id=row["session_id"],
            filename=row["filename"],
            original_path=row["original_path"],
            preview_path=row["preview_path"],
            order_index=row["order_index"],
            normalized_width=row["normalized_width"],
            normalized_height=row["normalized_height"],
            auto_detect_status=row["auto_detect_status"],
            auto_corners=json.loads(row["auto_corners"]),
            user_corners=json.loads(row["user_corners"]) if row["user_corners"] is not None else None,
            crop_rect=CropRect.model_validate(json.loads(row["crop_rect"])),
            tone_preset=row["tone_preset"],
            brightness=row["brightness"],
            contrast=row["contrast"],
            erase_paths=json.loads(row["erase_paths"]),
            updated_at=row["updated_at"],
        )


storage = FileSystemStorage(settings.base_dir.parent)
