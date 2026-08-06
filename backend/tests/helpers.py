from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.config import settings
from app.storage.storage import storage


def _workspace_setting_values(workspace_root: Path) -> dict[str, Any]:
    backend_root = workspace_root / "backend"
    data_root = workspace_root / "data"
    metadata_root = data_root / "metadata"
    static_root = backend_root / "app" / "static"
    backend_root.mkdir(parents=True, exist_ok=True)
    static_root.mkdir(parents=True, exist_ok=True)
    return {
        "base_dir": backend_root,
        "static_dir": static_root,
        "data_dir": data_root,
        "uploads_dir": data_root / "uploads",
        "rendered_dir": data_root / "rendered",
        "previews_dir": data_root / "rendered" / "previews",
        "temp_dir": data_root / "temp",
        "metadata_dir": metadata_root,
        "session_metadata_dir": metadata_root / "sessions",
        "document_metadata_dir": metadata_root / "documents",
        "metadata_db_path": metadata_root / "paper_cleaner.sqlite",
        "preview_max_size": (1600, 1600),
    }


def apply_test_workspace(workspace_root: Path) -> tuple[dict[str, Any], Path]:
    values = _workspace_setting_values(workspace_root)
    original_settings = {key: getattr(settings, key) for key in values}
    original_root_dir = storage.root_dir
    for key, value in values.items():
        setattr(settings, key, value)
    storage.root_dir = workspace_root
    return original_settings, original_root_dir


def restore_test_workspace(original_settings: dict[str, Any], original_root_dir: Path) -> None:
    for key, value in original_settings.items():
        setattr(settings, key, value)
    storage.root_dir = original_root_dir
