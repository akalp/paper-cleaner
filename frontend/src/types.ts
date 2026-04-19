export type Point = [number, number];
export type AutoDetectStatus = "detected" | "fallback_full_image";
export const TONE_PRESETS = [
  "natural",
  "grayscale",
  "high_contrast_bw",
  "printer_friendly",
] as const;
export type TonePreset = (typeof TONE_PRESETS)[number];
export type ErasePathMode = "fill_white";
export type DocumentMutationAction =
  | "save-perspective"
  | "reset-perspective"
  | "auto-detect"
  | "save-crop"
  | "reset-crop"
  | "save-tone"
  | "reset-tone"
  | "save-erase";

export interface ActiveDocumentAction {
  action: DocumentMutationAction;
  documentId: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ErasePath {
  points: Point[];
  mode: ErasePathMode;
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
  tone_preset: TonePreset;
  brightness: number;
  contrast: number;
  erase_paths: ErasePath[];
  source_url: string;
  preview_url: string;
  transformed_preview_url: string;
  preview_version: string;
}

export interface SessionResponse {
  id: string;
  created_at: string;
  updated_at: string;
  documents: DocumentResponse[];
}
