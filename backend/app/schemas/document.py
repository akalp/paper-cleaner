from enum import StrEnum

from pydantic import BaseModel, Field


type Point = tuple[float, float]


class AutoDetectStatus(StrEnum):
    DETECTED = "detected"
    FALLBACK_FULL_IMAGE = "fallback_full_image"


class TonePreset(StrEnum):
    NATURAL = "natural"
    GRAYSCALE = "grayscale"
    HIGH_CONTRAST_BW = "high_contrast_bw"
    PRINTER_FRIENDLY = "printer_friendly"


class ErasePathMode(StrEnum):
    FILL_WHITE = "fill_white"


class CropRect(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class ErasePath(BaseModel):
    points: list[Point] = Field(min_length=3)
    mode: ErasePathMode = ErasePathMode.FILL_WHITE


class DocumentMetadata(BaseModel):
    id: str
    session_id: str
    filename: str
    original_path: str
    preview_path: str
    order_index: int
    normalized_width: int = Field(gt=0)
    normalized_height: int = Field(gt=0)
    auto_detect_status: AutoDetectStatus
    auto_corners: list[Point] = Field(min_length=4, max_length=4)
    user_corners: list[Point] | None = Field(default=None, min_length=4, max_length=4)
    crop_rect: CropRect
    tone_preset: TonePreset = TonePreset.PRINTER_FRIENDLY
    brightness: int = Field(default=0, ge=-100, le=100)
    contrast: int = Field(default=0, ge=-100, le=100)
    erase_paths: list[ErasePath] = Field(default_factory=list)
    updated_at: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    order_index: int
    normalized_width: int
    normalized_height: int
    auto_detect_status: AutoDetectStatus
    auto_corners: list[Point]
    user_corners: list[Point] | None = None
    crop_rect: CropRect
    tone_preset: TonePreset
    brightness: int = Field(ge=-100, le=100)
    contrast: int = Field(ge=-100, le=100)
    erase_paths: list[ErasePath]
    source_url: str
    preview_url: str
    transformed_preview_url: str
    preview_version: str


class AutoDetectDocumentRequest(BaseModel):
    apply_to_user_corners: bool = False


class UpdateTransformRequest(BaseModel):
    user_corners: list[Point] | None = Field(default=None, min_length=4, max_length=4)
    crop_rect: CropRect | None = None


class UpdateToneRequest(BaseModel):
    tone_preset: TonePreset
    brightness: int = Field(ge=-100, le=100)
    contrast: int = Field(ge=-100, le=100)


class UpdateEraseRequest(BaseModel):
    erase_paths: list[ErasePath] = Field(default_factory=list)


class UploadDocumentsResponse(BaseModel):
    documents: list[DocumentResponse]
