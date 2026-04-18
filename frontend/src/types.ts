export type Point = [number, number];
export type AutoDetectStatus = "detected" | "fallback_full_image";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ErasePath {
  points: Point[];
  mode: string;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  order_index: number;
  normalized_width: number;
  normalized_height: number;
  auto_detect_status: AutoDetectStatus;
  auto_corners: Point[];
  user_corners: Point[] | null;
  crop_rect: CropRect;
  tone_preset: string;
  brightness: number;
  contrast: number;
  erase_paths: ErasePath[];
  source_url: string;
  preview_url: string;
  preview_version: string;
}

export interface SessionResponse {
  id: string;
  created_at: string;
  updated_at: string;
  documents: DocumentResponse[];
}
