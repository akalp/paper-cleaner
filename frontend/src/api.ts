import type {
  CropRect,
  DocumentResponse,
  ErasePath,
  Point,
  SessionResponse,
  TonePreset,
} from "./types";

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;

    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (typeof errorBody.detail === "string" && errorBody.detail.trim().length > 0) {
        detail = errorBody.detail;
      }
    } catch {
      // Ignore non-JSON error bodies and fall back to the default message.
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export function createSession(): Promise<SessionResponse> {
  return requestJson<SessionResponse>("/api/sessions", {
    method: "POST",
  });
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/api/sessions/${sessionId}`);
}

export function uploadDocuments(
  sessionId: string,
  files: File[],
): Promise<SessionResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  return requestJson<SessionResponse>(`/api/sessions/${sessionId}/documents`, {
    method: "POST",
    body: formData,
  });
}

interface UpdateTransformRequest {
  user_corners: Point[] | null;
  crop_rect?: CropRect | null;
}

interface AutoDetectRequest {
  apply_to_user_corners?: boolean;
}

interface UpdateToneRequest {
  tone_preset: TonePreset;
  brightness: number;
  contrast: number;
}

interface UpdateEraseRequest {
  erase_paths: ErasePath[];
}

export function updateDocumentTransform(
  documentId: string,
  payload: UpdateTransformRequest,
): Promise<DocumentResponse> {
  return requestJson<DocumentResponse>(`/api/documents/${documentId}/update-transform`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function rerunDocumentAutoDetect(
  documentId: string,
  payload: AutoDetectRequest = {},
): Promise<DocumentResponse> {
  return requestJson<DocumentResponse>(`/api/documents/${documentId}/auto-detect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateDocumentTone(
  documentId: string,
  payload: UpdateToneRequest,
): Promise<DocumentResponse> {
  return requestJson<DocumentResponse>(`/api/documents/${documentId}/update-tone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateDocumentErase(
  documentId: string,
  payload: UpdateEraseRequest,
): Promise<DocumentResponse> {
  return requestJson<DocumentResponse>(`/api/documents/${documentId}/erase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
