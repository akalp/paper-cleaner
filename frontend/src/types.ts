export type Point = [number, number];

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
  auto_corners: Point[];
  user_corners: Point[] | null;
  crop_rect: CropRect;
  tone_preset: string;
  brightness: number;
  contrast: number;
  erase_paths: ErasePath[];
  preview_url: string;
}

export interface SessionResponse {
  id: string;
  created_at: string;
  updated_at: string;
  documents: DocumentResponse[];
}
