from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "paper-cleaner"
    base_dir: Path = Path(__file__).resolve().parents[2]
    static_dir: Path = base_dir / "app" / "static"
    data_dir: Path = base_dir.parent / "data"


settings = Settings()
