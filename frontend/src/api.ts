import type {
  CropRect,
  DocumentResponse,
  ErasePath,
  ExportFileResponse,
  SessionHistoryResponse,
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

async function requestEmpty(input: RequestInfo, init?: RequestInit): Promise<void> {
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
}

async function requestExportFile(
  input: RequestInfo,
  fallbackFilename: string,
): Promise<ExportFileResponse> {
  const response = await fetch(input);

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

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(
      response.headers.get("Content-Disposition"),
      fallbackFilename,
    ),
  };
}

function getFilenameFromDisposition(
  contentDisposition: string | null,
  fallbackFilename: string,
): string {
  if (contentDisposition === null) {
    return fallbackFilename;
  }

  const filenameMatch = /filename="([^"]+)"/.exec(contentDisposition);
  return filenameMatch?.[1] ?? fallbackFilename;
}

export function createSession(): Promise<SessionResponse> {
  return requestJson<SessionResponse>("/api/sessions", {
    method: "POST",
  });
}

export function listSessions(): Promise<SessionHistoryResponse> {
  return requestJson<SessionHistoryResponse>("/api/sessions");
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/api/sessions/${sessionId}`);
}

export function deleteSession(sessionId: string): Promise<void> {
  return requestEmpty(`/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function uploadDocuments(sessionId: string, files: File[]): Promise<SessionResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  return requestJson<SessionResponse>(`/api/sessions/${sessionId}/documents`, {
    method: "POST",
    body: formData,
  });
}

export function reorderSessionDocuments(
  sessionId: string,
  documentIds: string[],
): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/api/sessions/${sessionId}/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document_ids: documentIds }),
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

export function exportDocumentImage(documentId: string): Promise<ExportFileResponse> {
  return requestExportFile(
    `/api/documents/${documentId}/export/image`,
    `paper-cleaner-${documentId}.png`,
  );
}

export function exportSessionZip(sessionId: string): Promise<ExportFileResponse> {
  return requestExportFile(
    `/api/sessions/${sessionId}/export/zip`,
    `paper-cleaner-${sessionId}.zip`,
  );
}

export function exportSessionPdf(sessionId: string): Promise<ExportFileResponse> {
  return requestExportFile(
    `/api/sessions/${sessionId}/export/pdf`,
    `paper-cleaner-${sessionId}.pdf`,
  );
}
