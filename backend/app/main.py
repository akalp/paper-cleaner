from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.storage.storage import storage


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    storage.ensure_directories()
    app.include_router(api_router, prefix="/api")

    static_dir = Path(settings.static_dir)
    assets_dir = static_dir / "assets"
    index_path = static_dir / "index.html"

    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False, response_model=None)
    async def serve_index():
        if index_path.is_file():
            return FileResponse(index_path)
        return JSONResponse({"app": settings.app_name, "status": "backend-ready"})

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
    async def serve_spa(full_path: str):
        candidate_path = static_dir / full_path
        if candidate_path.is_file():
            return FileResponse(candidate_path)
        if index_path.is_file():
            return FileResponse(index_path)
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    return app


app = create_app()
