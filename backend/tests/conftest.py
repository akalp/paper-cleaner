from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import create_app
from app.storage.storage import storage

from helpers import apply_test_workspace, restore_test_workspace


@pytest.fixture()
def backend_workspace(tmp_path: Path) -> Iterator[Path]:
    workspace_root = tmp_path / "workspace"
    original_settings, original_root_dir = apply_test_workspace(workspace_root)
    storage.ensure_directories()

    try:
        yield workspace_root
    finally:
        restore_test_workspace(original_settings, original_root_dir)


@pytest.fixture()
def client(backend_workspace: Path) -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def fixture_dir() -> Path:
    return Path(__file__).parent / "fixtures"
