from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.main import create_app
from app.storage.storage import storage


@pytest.fixture()
def backend_workspace(tmp_path: Path) -> Iterator[Path]:
    workspace_root = tmp_path / "workspace"
    backend_root = workspace_root / "backend"
    data_root = workspace_root / "data"
    static_root = backend_root / "app" / "static"

    original_settings = {
        "base_dir": settings.base_dir,
        "static_dir": settings.static_dir,
        "data_dir": settings.data_dir,
        "uploads_dir": settings.uploads_dir,
        "rendered_dir": settings.rendered_dir,
        "previews_dir": settings.previews_dir,
        "temp_dir": settings.temp_dir,
        "metadata_dir": settings.metadata_dir,
        "session_metadata_dir": settings.session_metadata_dir,
        "document_metadata_dir": settings.document_metadata_dir,
        "metadata_db_path": settings.metadata_db_path,
        "preview_max_size": settings.preview_max_size,
    }
    original_root_dir = storage.root_dir

    backend_root.mkdir(parents=True, exist_ok=True)
    static_root.mkdir(parents=True, exist_ok=True)

    settings.base_dir = backend_root
    settings.static_dir = static_root
    settings.data_dir = data_root
    settings.uploads_dir = data_root / "uploads"
    settings.rendered_dir = data_root / "rendered"
    settings.previews_dir = settings.rendered_dir / "previews"
    settings.temp_dir = data_root / "temp"
    settings.metadata_dir = data_root / "metadata"
    settings.session_metadata_dir = settings.metadata_dir / "sessions"
    settings.document_metadata_dir = settings.metadata_dir / "documents"
    settings.metadata_db_path = settings.metadata_dir / "paper_cleaner.sqlite"
    settings.preview_max_size = (1600, 1600)
    storage.root_dir = workspace_root
    storage.ensure_directories()

    try:
        yield workspace_root
    finally:
        for key, value in original_settings.items():
            setattr(settings, key, value)
        storage.root_dir = original_root_dir


@pytest.fixture()
def client(backend_workspace: Path) -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def fixture_dir() -> Path:
    return Path(__file__).parent / "fixtures"
