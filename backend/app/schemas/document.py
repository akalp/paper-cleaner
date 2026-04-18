from pydantic import BaseModel, Field


type Point = tuple[float, float]


class CropRect(BaseModel):
    x: int
    y: int
    width: int
    height: int


class ErasePath(BaseModel):
    points: list[Point]
    mode: str = "fill_white"


class DocumentMetadata(BaseModel):
    id: str
    session_id: str
    filename: str
    original_path: str
    preview_path: str
    order_index: int
    auto_corners: list[Point]
    user_corners: list[Point] | None = None
    crop_rect: CropRect
    tone_preset: str = "printer_friendly"
    brightness: int = 0
    contrast: int = 0
    erase_paths: list[ErasePath] = Field(default_factory=list)


class DocumentResponse(BaseModel):
    id: str
    filename: str
    order_index: int
    auto_corners: list[Point]
    user_corners: list[Point] | None = None
    crop_rect: CropRect
    tone_preset: str
    brightness: int
    contrast: int
    erase_paths: list[ErasePath]
    preview_url: str


class UploadDocumentsResponse(BaseModel):
    documents: list[DocumentResponse]

