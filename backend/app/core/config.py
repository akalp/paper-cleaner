from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "paper-cleaner"
    base_dir: Path = Path(__file__).resolve().parents[2]
    static_dir: Path = base_dir / "app" / "static"
    data_dir: Path = base_dir.parent / "data"
    uploads_dir: Path = data_dir / "uploads"
    rendered_dir: Path = data_dir / "rendered"
    previews_dir: Path = rendered_dir / "previews"
    temp_dir: Path = data_dir / "temp"
    metadata_dir: Path = data_dir / "metadata"
    session_metadata_dir: Path = metadata_dir / "sessions"
    document_metadata_dir: Path = metadata_dir / "documents"
    preview_max_size: tuple[int, int] = (1600, 1600)


settings = Settings()
